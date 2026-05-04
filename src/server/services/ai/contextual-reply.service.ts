import { MessageChannel, type InboundIntentType } from "@prisma/client";

import { qualificationGapLabelsForLead } from "@/server/services/ai/copilot-qual-gaps";
import { classifyInboundIntent } from "@/server/services/ai/intent-classifier.service";
import { tryLlmReplyDraft } from "@/server/services/ai/llm/copilot-llm";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { getFactsForAI } from "@/server/services/properties/property-fact.service";

export type ContextualReplyResult = {
  body: string;
  suggestedChannel: MessageChannel;
  intent: InboundIntentType;
  confidence: number;
  contextNote: string;
  modelId: string;
};

function compactSmsDraft(input: string, maxChars = 280): string {
  const oneLine = input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n/g, "\n")
    .trim();
  if (oneLine.length <= maxChars) return oneLine;
  return `${oneLine.slice(0, maxChars - 1).trimEnd()}…`;
}

function parseTourPreference(message: string): string | null {
  const lower = message.toLowerCase();
  const segments: string[] = [];
  if (/\bmorning(s)?\b/.test(lower)) segments.push("mornings");
  if (/\bafternoon(s)?\b/.test(lower)) segments.push("afternoons");
  if (/\bevening(s)?\b/.test(lower)) segments.push("evenings");
  if (/\bweekdays?\b/.test(lower)) segments.push("weekdays");
  if (/\bweekends?\b/.test(lower)) segments.push("weekends");
  if (/\bnext week\b/.test(lower)) segments.push("next week");
  else if (/\bthis week\b/.test(lower)) segments.push("this week");
  if (segments.length === 0) return null;
  return segments.join(" ");
}

function parseQualificationHighlights(message: string): string[] {
  const lower = message.toLowerCase();
  const highlights: string[] = [];
  const moveInDate = message.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0];
  if (moveInDate) {
    highlights.push(`move-in date ${moveInDate}`);
  } else if (/\bnext week\b/.test(lower)) {
    highlights.push("a next-week move-in");
  } else if (/\bthis month\b/.test(lower)) {
    highlights.push("a move-in this month");
  }

  if (/\bno pets?\b/.test(lower)) highlights.push("no pets");
  else if (/\bpets?\b/.test(lower)) highlights.push("pets");

  const budgetMatch = lower.match(/\b(under|around|about)\s+\$?\d{3,5}\b/)?.[0] ?? message.match(/\$\d{3,5}/)?.[0];
  if (budgetMatch) highlights.push(`budget ${budgetMatch}`);
  return highlights;
}

function heuristicReply(input: {
  firstName: string;
  listingTitle?: string;
  intent: InboundIntentType;
  latestInbound: string;
  gapLabels: string[];
  propertyFacts: Array<{ question: string; answer: string }>;
}): string {
  const baseGreeting = `Hi ${input.firstName},`;
  const leadRef = input.listingTitle ? ` about ${input.listingTitle}` : "";
  const topGap = input.gapLabels.slice(0, 2).join(" and ");
  const fact = input.propertyFacts[0];

  if (input.intent === "PROPERTY_QUESTION") {
    if (fact) {
      return `${baseGreeting}\n\nGreat question${leadRef}. ${fact.answer}\n\nIf helpful, I can also share current tour times.`;
    }
    return `${baseGreeting}\n\nGreat question${leadRef}. I want to confirm the exact detail before I answer — I’ll follow up shortly with the verified info.`;
  }

  if (input.intent === "TOUR_INTEREST" || input.intent === "TOUR_CONFIRMATION") {
    const pref = parseTourPreference(input.latestInbound);
    const prefAck = pref ? `Great, ${pref} works.` : "Great, happy to help with a tour.";
    return `${baseGreeting}\n\n${prefAck} I can send 2-3 available times${leadRef} that match the showing calendar.`;
  }

  if (input.intent === "APPLICATION_QUESTION") {
    return `${baseGreeting}\n\nHappy to help with the application process${leadRef}. I can walk you through timeline, required documents, and next steps.`;
  }

  if (input.intent === "QUALIFICATION_RESPONSE") {
    const highlights = parseQualificationHighlights(input.latestInbound);
    const highlightText = highlights.length > 0 ? `I noted ${highlights.join(" and ")}. ` : "";
    return `${baseGreeting}\n\nThanks for sharing those details${leadRef}. ${highlightText}${topGap ? `To keep options accurate, can you also share ${topGap}?` : "I’ll use this to narrow your best options and tour times."}`;
  }

  if (input.intent === "ACKNOWLEDGMENT") {
    return `${baseGreeting}\n\nSounds good. Whenever you’re ready, I can send next steps or tour options.`;
  }

  return `${baseGreeting}\n\nThanks for reaching out${leadRef}. ${topGap ? `To help match the right options, could you share ${topGap}?` : "If you’d like, I can share next-step tour times."}`;
}

export async function generateContextualReply(
  ctx: OrgContext,
  input: { conversationId: string; leadId: string },
): Promise<ContextualReplyResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 20 },
      lead: {
        select: {
          firstName: true,
          listing: { select: { title: true, unit: { select: { id: true, propertyId: true } } } },
        },
      },
    },
  });
  if (!conversation) throw new Error("Conversation not found");

  const suggestedChannel: MessageChannel =
    conversation.channelType === "EMAIL"
      ? "EMAIL"
      : conversation.channelType === "SMS"
        ? "SMS"
        : "IN_APP";
  const relevantMessages =
    conversation.channelType === "SMS"
      ? conversation.messages.filter((m) => m.channel === "SMS")
      : conversation.messages;
  const messagesForReply = relevantMessages.length > 0 ? relevantMessages : conversation.messages;
  const latestInbound =
    [...messagesForReply].reverse().find((m) => m.direction === "INBOUND")?.body ?? "";
  const classified = classifyInboundIntent(latestInbound);
  const gapLabels = await qualificationGapLabelsForLead(input.leadId);
  const propertyId = conversation.lead?.listing?.unit?.propertyId ?? null;
  const unitId = conversation.lead?.listing?.unit?.id ?? null;
  const kb = propertyId ? await getFactsForAI(ctx, { propertyId, unitId, maxFacts: 20 }) : null;
  const heuristicBody = heuristicReply({
    firstName: conversation.lead?.firstName ?? "there",
    listingTitle: conversation.lead?.listing?.title ?? undefined,
    intent: classified.intent,
    latestInbound,
    gapLabels,
    propertyFacts: kb?.facts ?? [],
  });
  const transcript = messagesForReply.map((m) => `${m.direction}: ${m.body}`).join("\n");
  const llm = await tryLlmReplyDraft({
    transcript,
    firstName: conversation.lead?.firstName ?? "there",
    listingTitle: conversation.lead?.listing?.title ?? undefined,
    heuristicBody,
    propertyFactsBlock: kb?.promptBlock,
  });
  const llmBody = llm?.body || heuristicBody;
  const body = suggestedChannel === "SMS" ? compactSmsDraft(llmBody, 280) : llmBody;
  const confidence = llm
    ? Math.max(0.55, Math.min(0.95, classified.confidence + 0.12))
    : Math.max(0.4, classified.confidence - 0.1);

  return {
    body,
    suggestedChannel,
    intent: classified.intent,
    confidence,
    contextNote: [llm?.contextNote, `intent=${classified.intent}`].filter(Boolean).join(" · "),
    modelId: llm ? "openai-json-contextual" : "heuristic-contextual-v1",
  };
}

