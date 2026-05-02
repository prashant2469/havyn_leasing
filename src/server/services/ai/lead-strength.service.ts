import { InboundIntentType, LeadStrengthSignal, LeadStrengthTier } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { classifyInboundIntent } from "@/server/services/ai/intent-classifier.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function numberFromJson(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function tierFromScore(score: number): LeadStrengthTier {
  if (score >= 0.75) return "STRONG";
  if (score >= 0.55) return "PROMISING";
  if (score >= 0.35) return "UNCERTAIN";
  if (score >= 0.15) return "WEAK";
  return "DISQUALIFIED";
}

type StrengthComputation = {
  strengthTier: LeadStrengthTier;
  overallScore: number;
  financialFitScore: number;
  intentScore: number;
  completenessScore: number;
  budgetToRentRatio: number | null;
  latestIntent: InboundIntentType | null;
  reasons: string[];
};

async function computeLeadStrengthSignals(leadId: string): Promise<StrengthComputation> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      listing: { select: { monthlyRent: true } },
      qualifications: true,
      conversations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          messages: { orderBy: { sentAt: "desc" }, take: 8 },
        },
      },
      channelIdentities: { take: 4, select: { id: true } },
    },
  });
  if (!lead) {
    return {
      strengthTier: "UNCERTAIN",
      overallScore: 0.4,
      financialFitScore: 0.4,
      intentScore: 0.4,
      completenessScore: 0.4,
      budgetToRentRatio: null,
      latestIntent: null,
      reasons: ["lead_not_found_fallback"],
    };
  }

  const reasons: string[] = [];
  const { score: completenessScore } = await getQualificationCompleteness(leadId);
  const budgetAnswer = lead.qualifications.find((q) => q.key === "monthlyBudget");
  const budget = numberFromJson(budgetAnswer?.value);
  const rent = lead.listing ? Number(lead.listing.monthlyRent) : null;
  const ratio = budget && rent ? budget / rent : null;
  let financialFitScore = 0.5;
  if (ratio != null) {
    if (ratio >= 1) financialFitScore = 1;
    else if (ratio >= 0.85) financialFitScore = 0.7;
    else if (ratio >= 0.7) financialFitScore = 0.35;
    else financialFitScore = 0.05;
    reasons.push(`budget_ratio=${ratio.toFixed(2)}`);
  } else {
    reasons.push("budget_or_rent_missing");
  }

  const latestInbound =
    lead.conversations[0]?.messages.find((m) => m.direction === "INBOUND")?.body ?? "";
  const intent = latestInbound ? classifyInboundIntent(latestInbound) : null;
  let intentScore = 0.45;
  if (intent) {
    if (intent.intent === "TOUR_INTEREST" || intent.intent === "TOUR_CONFIRMATION") intentScore = 0.9;
    else if (intent.intent === "APPLICATION_QUESTION") intentScore = 0.82;
    else if (intent.intent === "QUALIFICATION_RESPONSE") intentScore = 0.72;
    else if (intent.intent === "PROPERTY_QUESTION") intentScore = 0.65;
    else if (intent.intent === "GENERAL_INQUIRY") intentScore = 0.58;
    else if (intent.intent === "ACKNOWLEDGMENT") intentScore = 0.4;
    else if (intent.intent === "COMPLAINT") intentScore = 0.2;
    else if (intent.intent === "SENSITIVE") intentScore = 0.1;
    reasons.push(`intent=${intent.intent}`);
  } else {
    reasons.push("intent_missing");
  }

  if (!!lead.email?.trim() && !!lead.phone?.trim()) {
    reasons.push("dual_channel_contact");
  }
  if (lead.channelIdentities.length > 0) {
    reasons.push("verified_channel_identity");
  }

  const overallScore = clamp01(financialFitScore * 0.4 + intentScore * 0.35 + completenessScore * 0.25);
  const strengthTier = tierFromScore(overallScore);
  return {
    strengthTier,
    overallScore,
    financialFitScore,
    intentScore,
    completenessScore,
    budgetToRentRatio: ratio,
    latestIntent: intent?.intent ?? null,
    reasons,
  };
}

export async function computeLeadStrength(
  ctx: OrgContext,
  leadId: string,
): Promise<LeadStrengthSignal> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead not found");

  const computed = await computeLeadStrengthSignals(leadId);
  return prisma.leadStrengthSignal.upsert({
    where: { leadId },
    update: {
      strengthTier: computed.strengthTier,
      overallScore: computed.overallScore,
      financialFitScore: computed.financialFitScore,
      intentScore: computed.intentScore,
      completenessScore: computed.completenessScore,
      budgetToRentRatio: computed.budgetToRentRatio,
      latestIntent: computed.latestIntent,
      reasons: computed.reasons,
      modelId: "heuristic-strength-v1",
      computedAt: new Date(),
    },
    create: {
      organizationId: ctx.organizationId,
      leadId,
      strengthTier: computed.strengthTier,
      overallScore: computed.overallScore,
      financialFitScore: computed.financialFitScore,
      intentScore: computed.intentScore,
      completenessScore: computed.completenessScore,
      budgetToRentRatio: computed.budgetToRentRatio,
      latestIntent: computed.latestIntent,
      reasons: computed.reasons,
      modelId: "heuristic-strength-v1",
    },
  });
}

