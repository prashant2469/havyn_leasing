/**
 * Reply Draft Service (V3)
 *
 * AI-suggested reply drafts with heuristic base + optional OpenAI enrichment.
 */

import { AIReplyDraft, AIReplyDraftStatus, MessageChannel } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { generateContextualReply } from "@/server/services/ai/contextual-reply.service";
import { sendToProspect } from "@/server/services/outbound/dispatch.service";

function compactSmsDraft(input: string, maxChars = 300): string {
  const oneLine = input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n/g, "\n")
    .trim();
  if (oneLine.length <= maxChars) return oneLine;
  return `${oneLine.slice(0, maxChars - 1).trimEnd()}…`;
}

async function _generateDraftBody(
  ctx: OrgContext,
  conversationId: string,
  leadId: string,
): Promise<{
  body: string;
  suggestedChannel: MessageChannel;
  contextNote: string;
  modelNote: string;
  confidence: number;
}> {
  const generated = await generateContextualReply(ctx, {
    conversationId,
    leadId,
  });
  return {
    body: generated.suggestedChannel === "SMS" ? compactSmsDraft(generated.body) : generated.body,
    suggestedChannel: generated.suggestedChannel,
    contextNote: generated.contextNote,
    modelNote: generated.modelId,
    confidence: generated.confidence,
  };
}

export async function suggestReplyDraft(
  ctx: OrgContext,
  conversationId: string,
): Promise<AIReplyDraft> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: ctx.organizationId },
    select: { id: true, leadId: true },
  });
  if (!conversation) throw new Error("Conversation not found");
  if (!conversation.leadId) throw new Error("Conversation has no lead");
  const leadId = conversation.leadId;

  const content = await _generateDraftBody(ctx, conversationId, conversation.leadId);

  const draft = await prisma.$transaction(async (tx) => {
    await tx.aIReplyDraft.updateMany({
      where: { conversationId, status: "SUGGESTED" },
      data: { status: "SUPERSEDED" },
    });

    return tx.aIReplyDraft.create({
      data: {
        organizationId: ctx.organizationId,
        leadId,
        conversationId,
        body: content.body,
        suggestedChannel: content.suggestedChannel,
        contextNote: content.contextNote,
        automationConfidence: content.confidence,
        status: "SUGGESTED",
        modelId: content.modelNote ?? undefined,
        promptVersion: "v4.1",
      },
    });
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_DRAFT_SUGGESTED,
    entityType: "Lead",
    entityId: leadId,
    metadata: { draftId: draft.id, conversationId },
  });

  return draft;
}

export async function approveReplyDraft(
  ctx: OrgContext,
  draftId: string,
): Promise<AIReplyDraft> {
  const draft = await prisma.aIReplyDraft.findFirst({
    where: { id: draftId, organizationId: ctx.organizationId },
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "SUGGESTED") throw new Error("Draft is not in SUGGESTED state");

  const updated = await prisma.aIReplyDraft.update({
    where: { id: draftId },
    data: {
      status: "APPROVED",
      reviewedByUserId: ctx.userId,
      reviewedAt: new Date(),
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_DRAFT_APPROVED,
    entityType: "Lead",
    entityId: draft.leadId,
    metadata: { draftId, conversationId: draft.conversationId },
  });

  return updated;
}

export async function rejectReplyDraft(
  ctx: OrgContext,
  draftId: string,
): Promise<AIReplyDraft> {
  const draft = await prisma.aIReplyDraft.findFirst({
    where: { id: draftId, organizationId: ctx.organizationId },
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "SUGGESTED") throw new Error("Draft is not in SUGGESTED state");

  const updated = await prisma.aIReplyDraft.update({
    where: { id: draftId },
    data: {
      status: "REJECTED",
      reviewedByUserId: ctx.userId,
      reviewedAt: new Date(),
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_DRAFT_REJECTED,
    entityType: "Lead",
    entityId: draft.leadId,
    metadata: { draftId, conversationId: draft.conversationId },
  });

  return updated;
}

export async function sendApprovedDraft(
  ctx: OrgContext,
  draftId: string,
): Promise<{ draft: AIReplyDraft; messageId: string }> {
  const draft = await prisma.aIReplyDraft.findFirst({
    where: { id: draftId, organizationId: ctx.organizationId },
    include: {
      lead: {
        select: {
          id: true,
          listing: { select: { title: true } },
        },
      },
    },
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "APPROVED") throw new Error("Draft must be approved before sending");

  const sent = await sendToProspect(ctx, {
    leadId: draft.leadId,
    conversationId: draft.conversationId,
    body: draft.body,
    subject: draft.lead.listing?.title
      ? `Re: ${draft.lead.listing.title} — Havyn Leasing`
      : "Re: your message — Havyn Leasing",
    preferredChannel:
      draft.suggestedChannel === "EMAIL" || draft.suggestedChannel === "SMS"
        ? draft.suggestedChannel
        : "AUTO",
    authorType: "AI",
    authorUserId: ctx.userId,
    isAiGenerated: true,
    provider: draft.modelId ?? "heuristic",
    fallbackLabel: "Draft not sent — no deliverable channel configured",
  });

  const updated = await prisma.aIReplyDraft.update({
    where: { id: draftId },
    data: { status: "SENT", sentMessageId: sent.messageId },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_DRAFT_SENT,
    entityType: "Lead",
    entityId: draft.leadId,
    metadata: {
      draftId,
      messageId: sent.messageId,
      conversationId: draft.conversationId,
      delivered: sent.delivered,
      deliveryChannel: sent.channel,
    },
  });

  return { draft: updated, messageId: sent.messageId };
}

export async function getActiveDraftForConversation(
  ctx: OrgContext,
  conversationId: string,
): Promise<AIReplyDraft | null> {
  return prisma.aIReplyDraft.findFirst({
    where: {
      conversationId,
      organizationId: ctx.organizationId,
      status: { in: ["SUGGESTED", "APPROVED"] as AIReplyDraftStatus[] },
    },
    orderBy: { generatedAt: "desc" },
  });
}
