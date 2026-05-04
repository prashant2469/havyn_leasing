import { MessageChannel, type InboundIntentType } from "@prisma/client";
import { addDays } from "date-fns";

import { qualificationGapLabelsForLead } from "@/server/services/ai/copilot-qual-gaps";
import { classifyInboundIntent } from "@/server/services/ai/intent-classifier.service";
import { tryLlmReplyDraft } from "@/server/services/ai/llm/copilot-llm";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import {
  getFactsForAI,
  importStructuredPropertyFacts,
} from "@/server/services/properties/property-fact.service";
import { getBusyRangesForProperty } from "@/server/services/tours/availability.service";
import { generateAvailableTourSlots } from "@/server/services/tours/slot-generator.service";

export type ContextualReplyResult = {
  body: string;
  suggestedChannel: MessageChannel;
  intent: InboundIntentType;
  confidence: number;
  contextNote: string;
  modelId: string;
  selectedTourSlot: Date | null;
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

const QUESTION_CATEGORY_MAP: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(pet|dog|cat|animal)\b/i, category: "PET_POLICY" },
  { pattern: /\b(park|garage|carport|car)\b/i, category: "PARKING" },
  { pattern: /\b(utilit|electric|gas|water|trash|sewer|internet|wifi)\b/i, category: "UTILITIES" },
  { pattern: /\b(amenit|gym|pool|fitness|rooftop|lounge)\b/i, category: "AMENITIES" },
  { pattern: /\b(lease|term|month-to-month|renewal)\b/i, category: "LEASE_TERMS" },
  { pattern: /\b(move[- ]?in|deposit|security deposit|first month)\b/i, category: "MOVE_IN" },
  { pattern: /\b(fee|cost|application fee|admin fee)\b/i, category: "FEES_AND_COSTS" },
  { pattern: /\b(mainten|repair|request|fix)\b/i, category: "MAINTENANCE" },
  { pattern: /\b(rule|polic|quiet hour|noise|smoking|guest)\b/i, category: "RULES_AND_POLICIES" },
  { pattern: /\b(neighbor|area|nearby|walk|transit|school)\b/i, category: "NEIGHBORHOOD" },
];

function matchFactToQuestion(
  message: string,
  facts: Array<{ question: string; answer: string; category?: string }>,
): { question: string; answer: string } | null {
  if (facts.length === 0) return null;
  const lower = message.toLowerCase();
  for (const { pattern, category } of QUESTION_CATEGORY_MAP) {
    if (pattern.test(lower)) {
      const match = facts.find(
        (f) => (f as { category?: string }).category === category && f.answer.trim(),
      );
      if (match) return match;
    }
  }
  const keywordMatch = facts.find((f) => {
    const qWords = f.question.toLowerCase().split(/\s+/);
    return qWords.some((w) => w.length > 3 && lower.includes(w));
  });
  if (keywordMatch?.answer.trim()) return keywordMatch;
  return facts.find((f) => f.answer.trim()) ?? null;
}

function formatMoney(v: unknown): string | null {
  const amount = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatSlotLabel(slot: Date): string {
  return slot.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseTourTimePreference(message: string): {
  meridiem: "AM" | "PM" | null;
  hour: number | null;
  minute: number;
  weekday: number | null;
  monthDay: { month: number; day: number } | null;
} {
  const lower = message.toLowerCase();
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let hour: number | null = null;
  let minute = 0;
  let meridiem: "AM" | "PM" | null = null;
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    meridiem = timeMatch[3].toUpperCase() as "AM" | "PM";
  }

  const weekdays: Array<{ key: string; day: number }> = [
    { key: "sunday", day: 0 },
    { key: "monday", day: 1 },
    { key: "tuesday", day: 2 },
    { key: "wednesday", day: 3 },
    { key: "thursday", day: 4 },
    { key: "friday", day: 5 },
    { key: "saturday", day: 6 },
  ];
  const weekday = weekdays.find((w) => lower.includes(w.key))?.day ?? null;

  const monthMap: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  let monthDay: { month: number; day: number } | null = null;
  const monthDayMatch = lower.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/,
  );
  if (monthDayMatch) {
    monthDay = {
      month: monthMap[monthDayMatch[1]],
      day: Number(monthDayMatch[2]),
    };
  }

  return { meridiem, hour, minute, weekday, monthDay };
}

function inferSelectedTourSlot(latestInbound: string, availableSlots: Date[]): Date | null {
  if (availableSlots.length === 0) return null;
  const pref = parseTourTimePreference(latestInbound);
  const lower = latestInbound.toLowerCase();

  // Only auto-select when we have a concrete confirmation signal.
  const hasConfirmationVerb =
    /\b(confirm|book|schedule|works|that works|i'll take|ill take|yes|done)\b/i.test(lower) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(lower);
  if (!hasConfirmationVerb) return null;

  let filtered = [...availableSlots];
  if (pref.weekday != null) {
    filtered = filtered.filter((slot) => slot.getDay() === pref.weekday);
  }
  if (pref.monthDay) {
    filtered = filtered.filter(
      (slot) => slot.getMonth() === pref.monthDay!.month && slot.getDate() === pref.monthDay!.day,
    );
  }
  if (pref.hour != null && pref.meridiem) {
    const hour24 = pref.hour % 12 + (pref.meridiem === "PM" ? 12 : 0);
    filtered = filtered.filter((slot) => slot.getHours() === hour24 && slot.getMinutes() === pref.minute);
  } else if (/\bmorning\b/i.test(lower)) {
    filtered = filtered.filter((slot) => slot.getHours() < 12);
  } else if (/\bafternoon\b/i.test(lower)) {
    filtered = filtered.filter((slot) => slot.getHours() >= 12 && slot.getHours() < 17);
  } else if (/\bevening\b/i.test(lower)) {
    filtered = filtered.filter((slot) => slot.getHours() >= 17);
  }

  return filtered[0] ?? null;
}

function buildListingContextBlock(input: {
  listingTitle?: string;
  monthlyRent?: unknown;
  bedrooms?: number | null;
  bathrooms?: number | null;
  availableFrom?: Date | null;
  description?: string | null;
  listingAmenities?: string[];
  propertyName?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  propertyAmenities?: string[];
  parkingType?: string | null;
  laundryType?: string | null;
  availableSlots: Date[];
}): string {
  const rent = formatMoney(input.monthlyRent);
  const address = [input.street, input.city, input.state, input.postalCode].filter(Boolean).join(", ");
  const layout =
    input.bedrooms != null || input.bathrooms != null
      ? `${input.bedrooms ?? "?"} bed / ${input.bathrooms ?? "?"} bath`
      : null;
  const availableFrom = input.availableFrom
    ? input.availableFrom.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const amenitySet = new Set<string>([...(input.listingAmenities ?? []), ...(input.propertyAmenities ?? [])]);
  const amenities = [...amenitySet].slice(0, 8);
  const detailLines = [
    input.listingTitle ? `- Listing: ${input.listingTitle}` : null,
    input.propertyName ? `- Property: ${input.propertyName}` : null,
    rent ? `- Rent: ${rent}/month` : null,
    address ? `- Address: ${address}` : null,
    layout ? `- Layout: ${layout}` : null,
    availableFrom ? `- Available from: ${availableFrom}` : null,
    amenities.length > 0 ? `- Amenities: ${amenities.join(", ")}` : null,
    input.parkingType ? `- Parking: ${input.parkingType}` : null,
    input.laundryType ? `- Laundry: ${input.laundryType}` : null,
    input.description?.trim() ? `- Description: ${input.description.trim()}` : null,
  ].filter(Boolean);
  const slotLines = input.availableSlots.map((slot) => `- ${formatSlotLabel(slot)}`);
  const parts: string[] = [];
  if (detailLines.length > 0) {
    parts.push(`Listing details (verified):\n${detailLines.join("\n")}`);
  }
  if (slotLines.length > 0) {
    parts.push(`Available tour slots (next ${slotLines.length}):\n${slotLines.join("\n")}`);
  }
  return parts.join("\n\n");
}

function heuristicReply(input: {
  firstName: string;
  listingTitle?: string;
  intent: InboundIntentType;
  latestInbound: string;
  gapLabels: string[];
  propertyFacts: Array<{ question: string; answer: string; category?: string }>;
  availableTourSlots: Date[];
  selectedTourSlot: Date | null;
}): string {
  const baseGreeting = `Hi ${input.firstName},`;
  const leadRef = input.listingTitle ? ` about ${input.listingTitle}` : "";
  const topGap = input.gapLabels.slice(0, 2).join(" and ");

  if (input.intent === "PROPERTY_QUESTION") {
    const fact = matchFactToQuestion(input.latestInbound, input.propertyFacts);
    if (fact) {
      return `${baseGreeting}\n\nGreat question${leadRef}. ${fact.answer}\n\nIf helpful, I can also share current tour times.`;
    }
    return `${baseGreeting}\n\nGreat question${leadRef}. I want to confirm the exact detail before I answer — I’ll follow up shortly with the verified info.`;
  }

  if (input.intent === "TOUR_INTEREST" || input.intent === "TOUR_CONFIRMATION") {
    if (input.selectedTourSlot) {
      return `${baseGreeting}\n\nPerfect — I can confirm your tour${leadRef} for ${formatSlotLabel(input.selectedTourSlot)}.`;
    }
    if (input.availableTourSlots.length > 0) {
      const options = input.availableTourSlots.slice(0, 3).map((slot) => formatSlotLabel(slot)).join(", ");
      return `${baseGreeting}\n\nGreat, I can help with that${leadRef}. I have openings at ${options}. Which one works best for you?`;
    }
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
          listing: {
            select: {
              id: true,
              title: true,
              monthlyRent: true,
              bedrooms: true,
              bathrooms: true,
              availableFrom: true,
              description: true,
              amenities: true,
              unit: {
                select: {
                  id: true,
                  propertyId: true,
                  property: {
                    select: {
                      name: true,
                      street: true,
                      city: true,
                      state: true,
                      postalCode: true,
                      showingSchedule: true,
                      amenities: true,
                      parkingType: true,
                      laundryType: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!conversation) throw new Error("Conversation not found");

  const latestInboundMessage = [...conversation.messages].reverse().find((m) => m.direction === "INBOUND");
  const effectiveInboundChannel = latestInboundMessage?.channel ?? null;
  const suggestedChannel: MessageChannel =
    effectiveInboundChannel === "SMS"
      ? "SMS"
      : conversation.channelType === "EMAIL"
        ? "EMAIL"
        : conversation.channelType === "SMS"
          ? "SMS"
          : "IN_APP";
  const relevantMessages =
    conversation.channelType === "SMS"
      ? conversation.messages.filter((m) => m.channel === "SMS")
      : conversation.messages;
  const messagesForReply = relevantMessages.length > 0 ? relevantMessages : conversation.messages;
  const latestInbound = latestInboundMessage?.body ?? "";
  const classified = classifyInboundIntent(latestInbound);
  const gapLabels = await qualificationGapLabelsForLead(input.leadId);
  const propertyId = conversation.lead?.listing?.unit?.propertyId ?? null;
  const unitId = conversation.lead?.listing?.unit?.id ?? null;
  let kb = propertyId ? await getFactsForAI(ctx, { propertyId, unitId, maxFacts: 20 }) : null;
  if (propertyId && kb && kb.facts.length === 0) {
    try {
      await importStructuredPropertyFacts(ctx, propertyId, { overwriteExistingQuestions: false });
      kb = await getFactsForAI(ctx, { propertyId, unitId, maxFacts: 20 });
    } catch {
      // Non-fatal: keep pipeline alive even if fact import fails.
    }
  }
  const property = conversation.lead?.listing?.unit?.property;
  const availableTourSlots =
    propertyId && property
      ? generateAvailableTourSlots(
          property.showingSchedule,
          new Date(),
          5,
          await getBusyRangesForProperty(ctx.organizationId, propertyId, new Date(), addDays(new Date(), 14)),
        )
      : [];
  const selectedTourSlot = inferSelectedTourSlot(latestInbound, availableTourSlots);
  const listingContextBlock = buildListingContextBlock({
    listingTitle: conversation.lead?.listing?.title ?? undefined,
    monthlyRent: conversation.lead?.listing?.monthlyRent,
    bedrooms: conversation.lead?.listing?.bedrooms ?? null,
    bathrooms: conversation.lead?.listing?.bathrooms ?? null,
    availableFrom: conversation.lead?.listing?.availableFrom ?? null,
    description: conversation.lead?.listing?.description ?? null,
    listingAmenities: Array.isArray(conversation.lead?.listing?.amenities)
      ? conversation.lead?.listing?.amenities.map((a) => String(a))
      : [],
    propertyName: property?.name ?? null,
    street: property?.street ?? null,
    city: property?.city ?? null,
    state: property?.state ?? null,
    postalCode: property?.postalCode ?? null,
    propertyAmenities: Array.isArray(property?.amenities)
      ? property.amenities.map((a) => String(a))
      : [],
    parkingType: property?.parkingType ?? null,
    laundryType: property?.laundryType ?? null,
    availableSlots: availableTourSlots,
  });
  const directPropertyFacts: Array<{ question: string; answer: string; category?: string }> = [];
  const rentFact = formatMoney(conversation.lead?.listing?.monthlyRent);
  if (rentFact) {
    directPropertyFacts.push({
      question: "What is the rent?",
      answer: `The rent is ${rentFact}/month.`,
      category: "FEES_AND_COSTS",
    });
  }
  const addressFact = [property?.street, property?.city, property?.state, property?.postalCode]
    .filter(Boolean)
    .join(", ");
  if (addressFact) {
    directPropertyFacts.push({
      question: "What is the address?",
      answer: `The address is ${addressFact}.`,
      category: "GENERAL",
    });
  }
  if (conversation.lead?.listing?.availableFrom) {
    directPropertyFacts.push({
      question: "When is it available?",
      answer: `The home is available from ${conversation.lead.listing.availableFrom.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}.`,
      category: "MOVE_IN",
    });
  }
  const propertyFactsForReply = [...directPropertyFacts, ...(kb?.facts ?? [])];
  const heuristicBody = heuristicReply({
    firstName: conversation.lead?.firstName ?? "there",
    listingTitle: conversation.lead?.listing?.title ?? undefined,
    intent: classified.intent,
    latestInbound,
    gapLabels,
    propertyFacts: propertyFactsForReply,
    availableTourSlots,
    selectedTourSlot,
  });
  const transcript = messagesForReply.map((m) => `${m.direction}: ${m.body}`).join("\n");
  const shouldBypassLlm = classified.intent === "PROPERTY_QUESTION";
  const llm = shouldBypassLlm
    ? null
    : await tryLlmReplyDraft({
        transcript,
        firstName: conversation.lead?.firstName ?? "there",
        listingTitle: conversation.lead?.listing?.title ?? undefined,
        heuristicBody,
        propertyFactsBlock: kb?.promptBlock,
        listingContextBlock,
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
    selectedTourSlot,
  };
}

