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
import { qualificationGapLabelsForLead } from "@/server/services/ai/copilot-qual-gaps";
import { tryLlmReplyDraft } from "@/server/services/ai/llm/copilot-llm";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";

async function _generateDraftBody(conversationId: string, leadId: string): Promise<{
  body: string;
  suggestedChannel: MessageChannel;
  contextNote: string;
  modelNote: string;
}> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 15 },
      lead: {
        select: {
          firstName: true,
          lastName: true,
          listing: { select: { title: true } },
        },
      },
    },
  });

  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const firstName = conversation.lead?.firstName ?? "there";
  const listingTitle = conversation.lead?.listing?.title;
  const messageCount = conversation.messages.length;
  const isFirstReply = messageCount <= 1;
  const { score, missing } = await getQualificationCompleteness(leadId);
  const gaps = await qualificationGapLabelsForLead(leadId);
  const gapClause =
    gaps.length > 0
      ? `To help us match you${listingTitle ? ` with ${listingTitle}` : ""}, could you share: ${gaps.slice(0, 2).join(" · ")}?`
      : "If anything about timing or budget has shifted, just let us know so we can keep options accurate.";

  const body = isFirstReply
    ? `Hi ${firstName},\n\nThanks for reaching out${listingTitle ? ` about ${listingTitle}` : ""}. We're on it and will help you find the right fit.\n\n${gapClause}\n\nWe typically reply within one business day — watch your inbox.`
    : `Hi ${firstName},\n\nThanks for the update. We're noting everything on our side.\n\n${gapClause}\n\nIf you'd like to see the home in person, say the word and we'll send a few tour times that match the calendar.`;

  const suggestedChannel: MessageChannel =
    conversation.channelType === "EMAIL"
      ? "EMAIL"
      : conversation.channelType === "SMS"
        ? "SMS"
        : "IN_APP";

  const contextNote = isFirstReply
    ? `Heuristic draft (completeness ~${Math.round(score * 100)}%, ${missing.length} open fields).`
    : "Heuristic follow-up — references qualification gaps when present.";

  const transcript = conversation.messages.map((m) => `${m.direction}: ${m.body}`).join("\n");

  const llm = await tryLlmReplyDraft({
    transcript,
    firstName,
    listingTitle: listingTitle ?? undefined,
    heuristicBody: body,
  });

  if (llm) {
    return {
      body: llm.body,
      suggestedChannel,
      contextNote: [contextNote, llm.contextNote].filter(Boolean).join(" "),
      modelNote: "openai-json",
    };
  }

  return { body, suggestedChannel, contextNote, modelNote: "heuristic-v4" };
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

  await prisma.aIReplyDraft.updateMany({
    where: { conversationId, status: "SUGGESTED" },
    data: { status: "SUPERSEDED" },
  });

  const content = await _generateDraftBody(conversationId, conversation.leadId);

  const draft = await prisma.aIReplyDraft.create({
    data: {
      organizationId: ctx.organizationId,
      leadId: conversation.leadId,
      conversationId,
      body: content.body,
      suggestedChannel: content.suggestedChannel,
      contextNote: content.contextNote,
      status: "SUGGESTED",
      modelId: content.modelNote,
      promptVersion: "v4.1",
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
      provider: draft.modelId ?? "heuristic",
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
