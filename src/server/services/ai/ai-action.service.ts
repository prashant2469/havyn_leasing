import { AIActionStatus, AIActionType } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";

/**
 * V1: structured placeholders only. Replace body with OpenAI (or similar) calls behind a job queue.
 * TODO: OpenAI — generate draft from conversation + listing context; persist as PENDING_REVIEW.
 */
export async function listAIActionsForLead(ctx: OrgContext, leadId: string) {
  return prisma.aIAction.findMany({
    where: { organizationId: ctx.organizationId, leadId },
    orderBy: { createdAt: "desc" },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });
}

export async function createPlaceholderAIActions(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const convo = await prisma.conversation.findFirst({
    where: { organizationId: ctx.organizationId, leadId },
  });

  const rows = await prisma.$transaction([
    prisma.aIAction.create({
      data: {
        organizationId: ctx.organizationId,
        leadId,
        conversationId: convo?.id,
        type: AIActionType.DRAFT_REPLY,
        status: AIActionStatus.PENDING_REVIEW,
        content: {
          text: "[Placeholder] Thanks for your interest — I can share availability and next steps.",
        },
        modelId: null,
      },
    }),
    prisma.aIAction.create({
      data: {
        organizationId: ctx.organizationId,
        leadId,
        conversationId: convo?.id,
        type: AIActionType.CONVERSATION_SUMMARY,
        status: AIActionStatus.PENDING_REVIEW,
        content: { bullets: ["Prospect asked about touring", "No channel metadata in V1"] },
      },
    }),
    prisma.aIAction.create({
      data: {
        organizationId: ctx.organizationId,
        leadId,
        conversationId: convo?.id,
        type: AIActionType.SUGGESTED_NEXT_ACTION,
        status: AIActionStatus.PENDING_REVIEW,
        content: { action: "Propose two tour slots within 48h." },
      },
    }),
  ]);

  for (const row of rows) {
    await logActivity({
      ctx,
      verb: ActivityVerbs.AI_ACTION_CREATED,
      entityType: "AIAction",
      entityId: row.id,
      metadata: { type: row.type, leadId },
    });
  }

  return rows;
}

export async function reviewAIAction(
  ctx: OrgContext,
  actionId: string,
  status: "APPROVED" | "REJECTED" | "DISMISSED",
) {
  const row = await prisma.aIAction.findFirst({
    where: { id: actionId, organizationId: ctx.organizationId },
  });
  if (!row) throw new Error("AI action not found");

  const updated = await prisma.aIAction.update({
    where: { id: actionId },
    data: {
      status: status as AIActionStatus,
      reviewedByUserId: ctx.userId,
      reviewedAt: new Date(),
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.AI_ACTION_REVIEWED,
    entityType: "AIAction",
    entityId: updated.id,
    metadata: { type: updated.type, decision: status },
  });

  return updated;
}
