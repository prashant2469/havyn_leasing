/**
 * Escalation Service (V3)
 *
 * Creates, acknowledges, and resolves AI escalation flags.
 * Flagged leads are routed to the "Needs Human Review" queue.
 */

import { AIEscalationFlag, AIEscalationReason, AIEscalationStatus } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

export interface CreateEscalationInput {
  leadId: string;
  conversationId?: string;
  reason: AIEscalationReason;
  notes?: string;
  confidenceScore?: number;
}

export async function createEscalationFlag(
  ctx: OrgContext,
  input: CreateEscalationInput,
): Promise<AIEscalationFlag> {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead not found");

  const flag = await prisma.aIEscalationFlag.create({
    data: {
      organizationId: ctx.organizationId,
      leadId: input.leadId,
      conversationId: input.conversationId ?? null,
      reason: input.reason,
      notes: input.notes,
      confidenceScore: input.confidenceScore,
      status: "OPEN",
      modelId: "placeholder-v1",
    },
  });

  // Move lead to NEEDS_REVIEW inbox stage
  await prisma.lead.update({
    where: { id: input.leadId },
    data: { inboxStage: "NEEDS_HUMAN_REVIEW" },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_ESCALATION_FLAGGED,
    entityType: "Lead",
    entityId: input.leadId,
    metadata: { flagId: flag.id, reason: input.reason, conversationId: input.conversationId },
  });

  return flag;
}

export async function acknowledgeEscalation(
  ctx: OrgContext,
  flagId: string,
): Promise<AIEscalationFlag> {
  const flag = await prisma.aIEscalationFlag.findFirst({
    where: { id: flagId, organizationId: ctx.organizationId },
  });
  if (!flag) throw new Error("Escalation flag not found");

  return prisma.aIEscalationFlag.update({
    where: { id: flagId },
    data: { status: "ACKNOWLEDGED" },
  });
}

export async function resolveEscalation(
  ctx: OrgContext,
  flagId: string,
  resolutionNote?: string,
  isFalsePositive = false,
): Promise<AIEscalationFlag> {
  const flag = await prisma.aIEscalationFlag.findFirst({
    where: { id: flagId, organizationId: ctx.organizationId },
  });
  if (!flag) throw new Error("Escalation flag not found");

  const status: AIEscalationStatus = isFalsePositive ? "FALSE_POSITIVE" : "RESOLVED";

  const updated = await prisma.aIEscalationFlag.update({
    where: { id: flagId },
    data: {
      status,
      resolvedByUserId: ctx.userId,
      resolvedAt: new Date(),
      resolutionNote,
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_ESCALATION_RESOLVED,
    entityType: "Lead",
    entityId: flag.leadId,
    metadata: { flagId, status, resolutionNote, conversationId: flag.conversationId },
  });

  return updated;
}

export async function getOpenEscalationsForLead(
  ctx: OrgContext,
  leadId: string,
): Promise<AIEscalationFlag[]> {
  return prisma.aIEscalationFlag.findMany({
    where: {
      leadId,
      organizationId: ctx.organizationId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] as AIEscalationStatus[] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function detectEscalationSignals(
  ctx: OrgContext,
  leadId: string,
  conversationId?: string,
): Promise<AIEscalationFlag[]> {
  const messages = conversationId
    ? await prisma.message.findMany({
        where: { conversationId },
        orderBy: { sentAt: "desc" },
        take: 5,
      })
    : [];

  const flags: AIEscalationFlag[] = [];

  for (const msg of messages) {
    const body = msg.body.toLowerCase();
    let reason: AIEscalationReason | null = null;

    if (
      body.includes("frustrated") ||
      body.includes("unacceptable") ||
      body.includes("terrible") ||
      body.includes("angry")
    ) {
      reason = "UPSET_LEAD";
    } else if (body.includes("urgent") && body.includes("legal")) {
      reason = "URGENT_RESPONSE_NEEDED";
    }

    if (reason) {
      const flag = await createEscalationFlag(ctx, {
        leadId,
        conversationId,
        reason,
        notes: `Auto-detected from message content: "${msg.body.slice(0, 100)}"`,
        confidenceScore: 0.7,
      });
      flags.push(flag);
      break; // one flag per analysis run
    }
  }

  return flags;
}
