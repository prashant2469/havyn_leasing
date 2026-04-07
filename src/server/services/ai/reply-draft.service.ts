/**
 * Reply Draft Service (V3)
 *
 * Generates AI-suggested reply drafts, manages approval/rejection lifecycle,
 * and creates the actual Message record when a draft is sent.
 * Swap `_generateDraftBody` with a real LLM call when ready.
 */

import { AIReplyDraft, AIReplyDraftStatus, MessageChannel } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

/**
 * Placeholder draft generator.
 * Replace this body with a real LLM prompt against conversation history.
 */
async function _generateDraftBody(conversationId: string): Promise<{
  body: string;
  suggestedChannel: MessageChannel;
  contextNote: string;
}> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 10 },
      lead: { select: { firstName: true, lastName: true } },
    },
  });

  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const firstName = conversation.lead?.firstName ?? "there";
  const messageCount = conversation.messages.length;
  const isFirstReply = messageCount <= 1;

  const body = isFirstReply
    ? `Hi ${firstName},\n\nThank you for reaching out! I'd love to help you find the perfect home.\n\nCould you share a bit more about what you're looking for — your desired move-in date, the number of bedrooms, and your budget range? That'll help me match you with the best available options.\n\nLooking forward to hearing from you!`
    : `Hi ${firstName},\n\nThanks for your message. Based on what you've shared, I think we have some great options for you.\n\nWould you like to schedule a tour this week? I have availability on Tuesday and Thursday afternoons. Let me know what works for you!\n\nBest regards`;

  const suggestedChannel: MessageChannel =
    conversation.channelType === "EMAIL"
      ? "EMAIL"
      : conversation.channelType === "SMS"
        ? "SMS"
        : "IN_APP";

  const contextNote = isFirstReply
    ? "First-touch reply — requesting qualification details."
    : "Follow-up reply — offering tour availability.";

  return { body, suggestedChannel, contextNote };
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

  // Supersede any pending drafts
  await prisma.aIReplyDraft.updateMany({
    where: { conversationId, status: "SUGGESTED" },
    data: { status: "SUPERSEDED" },
  });

  const content = await _generateDraftBody(conversationId);

  const draft = await prisma.aIReplyDraft.create({
    data: {
      organizationId: ctx.organizationId,
      leadId: conversation.leadId,
      conversationId,
      body: content.body,
      suggestedChannel: content.suggestedChannel,
      contextNote: content.contextNote,
      status: "SUGGESTED",
      modelId: "placeholder-v1",
      promptVersion: "v3.0",
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_DRAFT_SUGGESTED,
    entityType: "Lead",
    entityId: conversation.leadId,
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
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "APPROVED") throw new Error("Draft must be approved before sending");

  const message = await prisma.message.create({
    data: {
      conversationId: draft.conversationId,
      direction: "OUTBOUND",
      channel: draft.suggestedChannel,
      body: draft.body,
      authorType: "AI",
      authorUserId: ctx.userId,
      isAiGenerated: true,
      provider: draft.modelId ?? "placeholder",
    },
  });

  const updated = await prisma.aIReplyDraft.update({
    where: { id: draftId },
    data: { status: "SENT", sentMessageId: message.id },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_DRAFT_SENT,
    entityType: "Lead",
    entityId: draft.leadId,
    metadata: { draftId, messageId: message.id, conversationId: draft.conversationId },
  });

  return { draft: updated, messageId: message.id };
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
