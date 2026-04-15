/**
 * Lead Priority Service (V3)
 *
 * Computes priority signals using V4 qualification completeness + engagement.
 */

import { LeadPrioritySignal, LeadPriorityTier } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";

interface PriorityComputation {
  tier: LeadPriorityTier;
  signals: string[];
  scoreRaw: number;
  isHotLead: boolean;
  isAtRisk: boolean;
  needsImmediateResponse: boolean;
  isQualifiedForTour: boolean;
}

async function _computePrioritySignals(leadId: string): Promise<PriorityComputation> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      tours: { take: 1, orderBy: { scheduledAt: "desc" } },
      conversations: {
        include: { messages: { orderBy: { sentAt: "desc" }, take: 3 } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!lead) {
    return {
      tier: "NORMAL",
      signals: [],
      scoreRaw: 0.5,
      isHotLead: false,
      isAtRisk: false,
      needsImmediateResponse: false,
      isQualifiedForTour: false,
    };
  }

  const { score: qualScore, missing } = await getQualificationCompleteness(leadId);
  const signals: string[] = [];
  let score = 0.35 + qualScore * 0.45;

  const hasFirstResponse = lead.firstResponseAt !== null;
  const hasTour = lead.tours.length > 0;
  const lastMsg = lead.conversations[0]?.messages[0];
  const hoursSinceLastMessage = lastMsg
    ? (Date.now() - new Date(lastMsg.sentAt).getTime()) / 3_600_000
    : Infinity;

  signals.push(`Qualification completeness ~${Math.round(qualScore * 100)}% (${missing.length} fields open)`);

  if (qualScore >= 0.85) {
    signals.push("Strong qualification coverage");
    score += 0.12;
  } else if (qualScore < 0.35) {
    signals.push("Early-stage discovery");
    score -= 0.05;
  }

  if (hasTour) {
    signals.push("Tour on calendar");
    score += 0.12;
  }
  if (!hasFirstResponse) {
    signals.push("Awaiting first response");
    score += 0.08;
  }
  if (hoursSinceLastMessage < 2) {
    signals.push("Fresh thread activity");
    score += 0.08;
  }

  if (hoursSinceLastMessage > 48) {
    signals.push("No activity in 48h");
    score -= 0.12;
  }
  if (!hasFirstResponse && hoursSinceLastMessage > 24) {
    signals.push("First response delayed over 24h");
    score -= 0.15;
  }

  if (lead.automationPaused) {
    signals.push("Automation paused — human lane");
    score -= 0.05;
  }

  score = Math.max(0, Math.min(1, score));

  let tier: LeadPriorityTier = "NORMAL";
  if (score >= 0.82) tier = "URGENT";
  else if (score >= 0.68) tier = "HIGH";
  else if (score <= 0.22) tier = "COLD";
  else if (score <= 0.34) tier = "LOW";

  const isQualifiedForTour = qualScore >= 0.5 && !hasTour;
  const isHotLead = tier === "URGENT" || tier === "HIGH";
  const isAtRisk = hoursSinceLastMessage > 48 || tier === "COLD";
  const needsImmediateResponse = !hasFirstResponse && hoursSinceLastMessage < 3;

  return {
    tier,
    signals,
    scoreRaw: score,
    isHotLead,
    isAtRisk,
    isQualifiedForTour,
    needsImmediateResponse,
  };
}

export async function computeLeadPriority(
  ctx: OrgContext,
  leadId: string,
): Promise<LeadPrioritySignal> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead not found");

  const computed = await _computePrioritySignals(leadId);

  const signal = await prisma.leadPrioritySignal.upsert({
    where: { leadId },
    update: {
      priorityTier: computed.tier,
      signals: computed.signals,
      scoreRaw: computed.scoreRaw,
      isHotLead: computed.isHotLead,
      isAtRisk: computed.isAtRisk,
      needsImmediateResponse: computed.needsImmediateResponse,
      isQualifiedForTour: computed.isQualifiedForTour,
      modelId: "heuristic-v4",
      computedAt: new Date(),
    },
    create: {
      organizationId: ctx.organizationId,
      leadId,
      priorityTier: computed.tier,
      signals: computed.signals,
      scoreRaw: computed.scoreRaw,
      isHotLead: computed.isHotLead,
      isAtRisk: computed.isAtRisk,
      needsImmediateResponse: computed.needsImmediateResponse,
      isQualifiedForTour: computed.isQualifiedForTour,
      modelId: "heuristic-v4",
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_PRIORITY_COMPUTED,
    entityType: "Lead",
    entityId: leadId,
    metadata: { tier: computed.tier, score: computed.scoreRaw },
  });

  return signal;
}
