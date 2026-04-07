/**
 * Lead Priority Service (V3)
 *
 * Computes and persists priority signals for a lead.
 * Upserts a single LeadPrioritySignal row per lead.
 * Replace `_computePrioritySignals` with a real scoring model when ready.
 */

import { LeadPrioritySignal, LeadPriorityTier } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

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
      qualifications: true,
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

  const signals: string[] = [];
  let score = 0.5;

  const qualCount = lead.qualifications.length;
  const hasFirstResponse = lead.firstResponseAt !== null;
  const hasTour = lead.tours.length > 0;
  const lastMsg = lead.conversations[0]?.messages[0];
  const hoursSinceLastMessage = lastMsg
    ? (Date.now() - new Date(lastMsg.sentAt).getTime()) / 3_600_000
    : Infinity;

  // Boost signals
  if (qualCount >= 4) { signals.push("Highly qualified"); score += 0.2; }
  if (hasTour) { signals.push("Tour scheduled"); score += 0.15; }
  if (!hasFirstResponse) { signals.push("Awaiting first response"); score += 0.1; }
  if (hoursSinceLastMessage < 1) { signals.push("Recent message activity"); score += 0.1; }

  // Risk signals
  if (hoursSinceLastMessage > 48) { signals.push("No activity in 48h"); score -= 0.15; }
  if (!hasFirstResponse && hoursSinceLastMessage > 24) {
    signals.push("First response delayed > 24h");
    score -= 0.2;
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));

  let tier: LeadPriorityTier = "NORMAL";
  if (score >= 0.8) tier = "URGENT";
  else if (score >= 0.65) tier = "HIGH";
  else if (score <= 0.25) tier = "COLD";
  else if (score <= 0.35) tier = "LOW";

  const isQualifiedForTour = qualCount >= 3 && !hasTour;
  const isHotLead = tier === "URGENT" || tier === "HIGH";
  const isAtRisk = hoursSinceLastMessage > 48 || tier === "COLD";
  const needsImmediateResponse = !hasFirstResponse && hoursSinceLastMessage < 2;

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
      computedAt: new Date(),
      modelId: "placeholder-v1",
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
      modelId: "placeholder-v1",
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_PRIORITY_COMPUTED,
    entityType: "Lead",
    entityId: leadId,
    metadata: { tier: computed.tier, score: computed.scoreRaw, signals: computed.signals },
  });

  return signal;
}

export async function getLeadPriority(
  ctx: OrgContext,
  leadId: string,
): Promise<LeadPrioritySignal | null> {
  return prisma.leadPrioritySignal.findUnique({
    where: { leadId },
  });
}
