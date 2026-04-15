/**
 * Conversation Summary Service (V3)
 *
 * Generates structured AI summaries per conversation.
 * Uses V4 qualification completeness for gaps; optional LLM enrichment in llm layer.
 */

import { AIUrgency, ConversationSummary, TourStatus } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { qualificationGapLabelsForLead } from "@/server/services/ai/copilot-qual-gaps";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import { tryLlmConversationSummary } from "@/server/services/ai/llm/copilot-llm";

export interface SummaryContent {
  summaryText: string;
  currentIntent: string;
  urgency: AIUrgency;
  qualificationGaps: string[];
  recommendedNextStep: string;
}

async function _generateSummaryContent(
  leadId: string,
  conversationId: string,
): Promise<SummaryContent> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 30 },
      lead: {
        include: {
          qualifications: true,
          tours: { take: 2, orderBy: { scheduledAt: "desc" } },
          listing: { select: { title: true, monthlyRent: true } },
        },
      },
    },
  });

  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const lead = conversation.lead;
  if (!lead) throw new Error("Conversation has no lead");

  const messages = conversation.messages;
  const messageCount = messages.length;
  const inbound = messages.filter((m) => m.direction === "INBOUND").length;
  const outbound = messages.filter((m) => m.direction === "OUTBOUND").length;
  const latestMessage = messages.at(-1);
  const lastInbound = [...messages].reverse().find((m) => m.direction === "INBOUND");
  const snippet = (lastInbound?.body ?? latestMessage?.body ?? "").slice(0, 140).replace(/\s+/g, " ").trim();

  const upcomingTour = lead.tours.find(
    (t) => t.scheduledAt > new Date() && t.status === TourStatus.SCHEDULED,
  );
  const hasUpcomingTour = Boolean(upcomingTour);

  const [gaps, completeness, openEscalations] = await Promise.all([
    qualificationGapLabelsForLead(leadId),
    getQualificationCompleteness(leadId),
    prisma.aIEscalationFlag.count({
      where: {
        leadId: lead.id,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
    }),
  ]);

  const lastMsgBody = (latestMessage?.body ?? "").toLowerCase();
  const hasUrgentSignal =
    lastMsgBody.includes("urgent") || lastMsgBody.includes("asap") || lastMsgBody.includes("immediately");
  const hasUpsetSignal =
    lastMsgBody.includes("frustrated") ||
    lastMsgBody.includes("unacceptable") ||
    lastMsgBody.includes("terrible") ||
    lastMsgBody.includes("angry");

  let urgency: AIUrgency = "NORMAL";
  if (hasUrgentSignal || hasUpsetSignal) urgency = "HIGH";
  if (hasUpsetSignal && messageCount > 5) urgency = "URGENT";
  if (openEscalations > 0) urgency = urgency === "NORMAL" ? "HIGH" : urgency;

  const listingTitle = lead.listing?.title;
  const rentStr = lead.listing?.monthlyRent ? `$${lead.listing.monthlyRent.toString()}` : null;
  const channelStr = conversation.channelType ? String(conversation.channelType) : "unknown channel";

  const firstName = lead.firstName ?? "The prospect";
  const intent = hasUpcomingTour
    ? "tour_scheduling"
    : messageCount <= 1
      ? "initial_inquiry"
      : completeness.score >= 0.85
        ? "ready_to_convert"
        : completeness.score >= 0.5
          ? "qualifying"
          : "early_discovery";

  const qualLine =
    gaps.length === 0
      ? "V4 qualification set looks complete."
      : `${gaps.length} qualification topic(s) still open — see gap list.`;

  const automationNote = lead.automationPaused
    ? "Outbound automation is paused (escalation or manual hold)."
    : "Automation is eligible to assist on owned channels.";

  const summaryText = [
    `${firstName} is engaged on ${listingTitle ?? "a listing"}${rentStr ? ` (${rentStr}/mo ask)` : ""} via ${channelStr}.`,
    `Thread: ${messageCount} messages (${inbound} inbound, ${outbound} outbound).`,
    snippet ? `Latest inbound snippet: “${snippet}${snippet.length >= 140 ? "…" : ""}”` : null,
    qualLine,
    hasUpcomingTour
      ? `Upcoming tour scheduled for ${upcomingTour!.scheduledAt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
      : lead.tours.length > 0
        ? "Past or non-active tours exist — confirm follow-up."
        : null,
    openEscalations > 0 ? `${openEscalations} open escalation(s) require human attention.` : null,
    automationNote,
  ]
    .filter(Boolean)
    .join("\n\n");

  const nextStep =
    openEscalations > 0
      ? "Resolve or acknowledge escalations before sending more automated outreach."
      : hasUpcomingTour
        ? "Send a concise pre-tour reminder with parking / access instructions."
        : gaps.length > 0
          ? "Capture the remaining qualification topics in one focused reply."
          : completeness.score >= 0.5 && !hasUpcomingTour
            ? "Offer 2–3 concrete tour windows that match the property schedule."
            : "Reply with a warm acknowledgment and two clarifying questions to move discovery forward.";

  const base: SummaryContent = {
    summaryText,
    currentIntent: intent,
    urgency,
    qualificationGaps: gaps,
    recommendedNextStep: nextStep,
  };

  const llm = await tryLlmConversationSummary({
    transcript: messages.map((m) => `${m.direction}: ${m.body}`).join("\n"),
    listingTitle: listingTitle ?? undefined,
    rentStr: rentStr ?? undefined,
    channel: channelStr,
    gapLabels: gaps,
    baseSummary: base.summaryText,
    recommendedNextStep: base.recommendedNextStep,
  });

  if (llm) {
    return {
      ...base,
      summaryText: llm.summaryText,
      recommendedNextStep: llm.recommendedNextStep ?? base.recommendedNextStep,
      qualificationGaps: llm.qualificationGaps?.length ? llm.qualificationGaps : gaps,
    };
  }

  return base;
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
      modelId: process.env.ENABLE_AI_SUGGESTIONS === "true" && process.env.OPENAI_API_KEY ? "openai-json" : "heuristic-v4",
      promptVersion: "v4.1",
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
