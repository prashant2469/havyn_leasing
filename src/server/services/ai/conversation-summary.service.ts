/**
 * Conversation Summary Service (V3)
 *
 * Generates and manages structured AI summaries per conversation.
 * Currently uses deterministic placeholder generation; swap `_generateSummaryContent`
 * with a real LLM call (OpenAI, Anthropic, etc.) when ready.
 */

import { AIUrgency, ConversationSummary } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

export interface SummaryContent {
  summaryText: string;
  currentIntent: string;
  urgency: AIUrgency;
  qualificationGaps: string[];
  recommendedNextStep: string;
}

/**
 * Placeholder generator — produces realistic-looking content based on lead state.
 * Replace this function body with a real LLM call.
 */
async function _generateSummaryContent(
  leadId: string,
  conversationId: string,
): Promise<SummaryContent> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 20 },
      lead: {
        include: {
          qualifications: true,
          tours: { take: 1, orderBy: { scheduledAt: "desc" } },
        },
      },
    },
  });

  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const lead = conversation.lead;
  const messageCount = conversation.messages.length;
  const hasTour = (lead?.tours?.length ?? 0) > 0;
  const qualCount = lead?.qualifications?.length ?? 0;
  const latestMessage = conversation.messages.at(-1);

  // Determine urgency from message recency and content signals
  const lastMsgBody = (latestMessage?.body ?? "").toLowerCase();
  const hasUrgentSignal =
    lastMsgBody.includes("urgent") ||
    lastMsgBody.includes("asap") ||
    lastMsgBody.includes("immediately");
  const hasUpsetSignal =
    lastMsgBody.includes("frustrated") ||
    lastMsgBody.includes("unacceptable") ||
    lastMsgBody.includes("terrible");

  let urgency: AIUrgency = "NORMAL";
  if (hasUrgentSignal || hasUpsetSignal) urgency = "HIGH";
  if (hasUpsetSignal && messageCount > 5) urgency = "URGENT";

  // Build qualification gaps
  const gaps: string[] = [];
  const qualKeys = lead?.qualifications?.map((q) => q.key) ?? [];
  if (!qualKeys.includes("desiredMoveIn")) gaps.push("Move-in date not provided");
  if (!qualKeys.includes("bedrooms")) gaps.push("Bedroom preference unknown");
  if (!qualKeys.includes("monthlyBudget")) gaps.push("Budget not confirmed");
  if (!qualKeys.includes("occupants")) gaps.push("Occupant count missing");
  if (!qualKeys.includes("hasPets")) gaps.push("Pet status unclear");

  // Build summary text
  const firstName = lead?.firstName ?? "The lead";
  const intent = hasTour ? "schedule a tour" : messageCount > 3 ? "learn more" : "initial inquiry";
  const channelStr = conversation.channelType ? ` via ${conversation.channelType}` : "";

  const summaryText = hasTour
    ? `${firstName} has an active tour scheduled. ${messageCount} messages exchanged${channelStr}. Qualification data is ${qualCount >= 3 ? "largely complete" : "incomplete — several key fields missing"}.`
    : messageCount === 1
      ? `${firstName} submitted an initial inquiry${channelStr}. No follow-up yet. Lead is awaiting first response.`
      : `${firstName} is actively engaged with ${messageCount} messages${channelStr}. They appear interested in ${intent}. Follow-up is required.`;

  const nextStep = hasTour
    ? "Send tour confirmation and pre-tour questionnaire"
    : qualCount < 3
      ? "Capture missing qualification fields before advancing"
      : "Offer available tour times to advance the pipeline";

  return {
    summaryText,
    currentIntent: intent,
    urgency,
    qualificationGaps: gaps,
    recommendedNextStep: nextStep,
  };
}

export async function generateConversationSummary(
  ctx: OrgContext,
  conversationId: string,
): Promise<ConversationSummary> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: ctx.organizationId },
    select: { id: true, leadId: true },
  });
  if (!conversation) throw new Error("Conversation not found");
  if (!conversation.leadId) throw new Error("Conversation has no lead");

  // Mark existing summaries for this conversation as stale
  await prisma.conversationSummary.updateMany({
    where: { conversationId, isStale: false },
    data: { isStale: true },
  });

  const content = await _generateSummaryContent(conversation.leadId, conversationId);

  const summary = await prisma.conversationSummary.create({
    data: {
      organizationId: ctx.organizationId,
      leadId: conversation.leadId,
      conversationId,
      summaryText: content.summaryText,
      currentIntent: content.currentIntent,
      urgency: content.urgency,
      qualificationGaps: content.qualificationGaps,
      recommendedNextStep: content.recommendedNextStep,
      modelId: "placeholder-v1",
      promptVersion: "v3.0",
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_SUMMARY_GENERATED,
    entityType: "Lead",
    entityId: conversation.leadId,
    metadata: { summaryId: summary.id, urgency: content.urgency, conversationId },
  });

  return summary;
}

export async function getLatestConversationSummary(
  ctx: OrgContext,
  conversationId: string,
): Promise<ConversationSummary | null> {
  return prisma.conversationSummary.findFirst({
    where: { conversationId, organizationId: ctx.organizationId, isStale: false },
    orderBy: { generatedAt: "desc" },
  });
}
