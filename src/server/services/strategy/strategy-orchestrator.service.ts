import { AIEscalationReason, LeadInboxStage, ListingChannelType } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { evaluateAutomationDecision } from "@/server/services/ai/automation-decision.service";
import { generateContextualReply } from "@/server/services/ai/contextual-reply.service";
import { classifyInboundIntent } from "@/server/services/ai/intent-classifier.service";
import { computeLeadStrength } from "@/server/services/ai/lead-strength.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import { createTour } from "@/server/services/leasing/tour.service";
import { getFactsForAI } from "@/server/services/properties/property-fact.service";
import {
  transitionAfterFirstOutreach,
  transitionOnQualificationThreshold,
  transitionOnProspectReply,
} from "@/server/services/leasing/stage-machine.service";
import { sendToProspect } from "@/server/services/outbound/dispatch.service";
import { generateRecommendations } from "@/server/services/recommendations/recommendation.service";
import { resolveStrategyDecision } from "@/server/services/strategy/strategy-decision.service";
import { generateStrategyMessage } from "@/server/services/strategy/strategy-message.service";

function compactSmsBody(input: string, maxChars = 320): string {
  const oneLine = input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n/g, "\n")
    .trim();
  if (oneLine.length <= maxChars) return oneLine;
  return `${oneLine.slice(0, maxChars - 1).trimEnd()}…`;
}

function formatMoney(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

async function buildDirectPropertyAnswer(ctx: OrgContext, input: {
  leadId: string;
  latestInbound: string;
}): Promise<string | null> {
  const lower = input.latestInbound.toLowerCase();
  const isDirectInfoQuestion =
    /\b(rent|price|address|location|where is|where's|pet|parking|utility|utilities|deposit|fee|available|availability)\b/i.test(
      lower,
    ) && input.latestInbound.includes("?");
  if (!isDirectInfoQuestion) return null;

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    select: {
      firstName: true,
      listing: {
        select: {
          title: true,
          monthlyRent: true,
          availableFrom: true,
          unit: {
            select: {
              id: true,
              propertyId: true,
              property: {
                select: {
                  street: true,
                  city: true,
                  state: true,
                  postalCode: true,
                  parkingType: true,
                  utilityNotes: true,
                  petRules: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!lead?.listing?.unit?.propertyId) return null;

  const facts = await getFactsForAI(ctx, {
    propertyId: lead.listing.unit.propertyId,
    unitId: lead.listing.unit.id,
    maxFacts: 20,
  });

  const answers: string[] = [];
  if (/\b(rent|price)\b/i.test(lower)) {
    const rent = formatMoney(lead.listing.monthlyRent);
    if (rent) answers.push(`The rent for ${lead.listing.title} is ${rent}/month.`);
  }
  if (/\b(address|location|where is|where's)\b/i.test(lower)) {
    const address = [
      lead.listing.unit.property.street,
      lead.listing.unit.property.city,
      lead.listing.unit.property.state,
      lead.listing.unit.property.postalCode,
    ]
      .filter(Boolean)
      .join(", ");
    if (address) answers.push(`The address is ${address}.`);
  }
  if (/\b(pet|pets|dog|cat)\b/i.test(lower)) {
    const petFact = facts.facts.find((f) => f.category === "PET_POLICY" && f.answer.trim());
    if (petFact) {
      answers.push(petFact.answer);
    } else {
      answers.push("I don't have a verified pet policy detail on file yet, but I can confirm it and follow up.");
    }
  }
  if (/\b(parking)\b/i.test(lower)) {
    const parkingFact = facts.facts.find((f) => f.category === "PARKING" && f.answer.trim());
    if (parkingFact) {
      answers.push(parkingFact.answer);
    } else if (lead.listing.unit.property.parkingType) {
      answers.push(`Parking type is ${lead.listing.unit.property.parkingType}.`);
    }
  }
  if (/\b(utility|utilities)\b/i.test(lower)) {
    const utilityFact = facts.facts.find((f) => f.category === "UTILITIES" && f.answer.trim());
    if (utilityFact) {
      answers.push(utilityFact.answer);
    } else if (lead.listing.unit.property.utilityNotes?.trim()) {
      answers.push(lead.listing.unit.property.utilityNotes.trim());
    }
  }
  if (/\b(available|availability)\b/i.test(lower) && lead.listing.availableFrom) {
    answers.push(
      `Current availability starts ${lead.listing.availableFrom.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}.`,
    );
  }

  if (answers.length === 0) return null;
  return `Hi ${lead.firstName},\n\n${answers.join(" ")}\n\nIf you'd like, I can also share the next available tour times.`;
}

async function sendFallbackReply(
  ctx: OrgContext,
  input: { leadId: string; conversationId: string },
): Promise<void> {
  await sendToProspect(ctx, {
    leadId: input.leadId,
    conversationId: input.conversationId,
    body: "Thanks for your message. A leasing specialist will follow up shortly.",
    preferredChannel: "SMS",
    fallbackLabel: "Fallback SMS not sent — no deliverable channel configured",
  });
}

export async function resolveAndExecuteStrategy(
  ctx: OrgContext,
  input: { leadId: string; conversationId: string; phase: "first_outreach" | "reply" },
): Promise<void> {
  let isSmsConversation = false;
  let willDeliverViaSms = false;
  let tourBookedViaAi = false;
  let selectedTourSlot: Date | null = null;
  try {
    const [lead, conversation] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: input.leadId, organizationId: ctx.organizationId },
        select: { id: true, automationPaused: true, inboxStage: true },
      }),
      prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: ctx.organizationId,
        },
        select: { channelType: true },
      }),
    ]);
    if (!lead) return;
    if (lead.automationPaused) {
      if (input.phase !== "reply") return;
      const latestInbound = await prisma.message.findFirst({
        where: { conversationId: input.conversationId, direction: "INBOUND" },
        orderBy: { sentAt: "desc" },
        select: { channel: true, body: true },
      });
      const intent = classifyInboundIntent(latestInbound?.body ?? "");
      const canResumeAutomation =
        latestInbound?.channel === "SMS" && intent.intent !== "SENSITIVE" && intent.intent !== "COMPLAINT";
      if (!canResumeAutomation) return;
      await prisma.lead.update({
        where: { id: input.leadId },
        data: {
          automationPaused: false,
          inboxStage:
            lead.inboxStage === LeadInboxStage.NEEDS_HUMAN_REVIEW
              ? LeadInboxStage.AWAITING_RESPONSE
              : lead.inboxStage,
        },
      });
      // Auto-resolve stale low-confidence escalation flags so computeLeadStrength
      // doesn't keep setting HUMAN_REQUIRED bucket on every run.
      await prisma.aIEscalationFlag.updateMany({
        where: {
          organizationId: ctx.organizationId,
          leadId: input.leadId,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          reason: AIEscalationReason.UNCLEAR_INTENT,
          confidenceScore: { lt: 0.6 },
        },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: "Auto-resolved: lead re-engaged via SMS" },
      });
    }
    if (input.phase === "reply") {
      const latestInbound = await prisma.message.findFirst({
        where: { conversationId: input.conversationId, direction: "INBOUND" },
        orderBy: { sentAt: "desc" },
        select: { body: true },
      });
      const directPropertyAnswer = await buildDirectPropertyAnswer(ctx, {
        leadId: input.leadId,
        latestInbound: latestInbound?.body ?? "",
      });
      if (directPropertyAnswer) {
        await sendToProspect(ctx, {
          leadId: input.leadId,
          conversationId: input.conversationId,
          body: directPropertyAnswer,
          preferredChannel: "SMS",
          fallbackLabel: "Direct property reply not sent — no deliverable channel configured",
        });
        return;
      }
    }
    isSmsConversation = conversation?.channelType === ListingChannelType.SMS;

    // AUTO delivery prefers SMS when a phone number exists.
    const leadContact = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId: ctx.organizationId },
      select: { email: true, phone: true },
    });
    willDeliverViaSms = isSmsConversation || !!leadContact?.phone?.trim();

    await computeLeadStrength(ctx, input.leadId);
    const strategy = await resolveStrategyDecision(ctx, {
      leadId: input.leadId,
      conversationId: input.conversationId,
    });

    if (strategy.action === "ESCALATE") {
      const isTrulySensitive =
        strategy.intent === "SENSITIVE" || strategy.intent === "COMPLAINT";
      if (isTrulySensitive || !willDeliverViaSms) {
        await prisma.lead.update({
          where: { id: input.leadId },
          data: { automationPaused: true, inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
        });
      }
      return;
    }
    if (strategy.action === "WAIT") return;

    await generateRecommendations(ctx, input.leadId);
    const strategyMessage = await generateStrategyMessage(ctx, {
      leadId: input.leadId,
      decision: strategy,
      smsCompact: input.phase === "first_outreach" && willDeliverViaSms,
    });
    const generated =
      input.phase === "reply"
        ? await (async () => {
            const contextualResult = await generateContextualReply(ctx, {
              conversationId: input.conversationId,
              leadId: input.leadId,
            });
            selectedTourSlot = contextualResult.selectedTourSlot;
            return {
              ...strategyMessage,
              body: contextualResult.body,
              preferredChannel:
                contextualResult.suggestedChannel === "SMS"
                  ? "SMS"
                  : contextualResult.suggestedChannel === "EMAIL"
                    ? "EMAIL"
                    : strategyMessage.preferredChannel,
            } as const;
          })()
        : {
            ...strategyMessage,
            body: willDeliverViaSms ? compactSmsBody(strategyMessage.body, 320) : strategyMessage.body,
          };
    const decision = await evaluateAutomationDecision(ctx, {
      leadId: input.leadId,
      conversationId: input.conversationId,
      intent: strategy.intent,
      confidence: strategy.confidence,
      phase: input.phase,
    });

    if (decision.decision === "ESCALATE") {
      const isTrulySensitive =
        strategy.intent === "SENSITIVE" || strategy.intent === "COMPLAINT";
      if (isTrulySensitive || !willDeliverViaSms) {
        await prisma.lead.update({
          where: { id: input.leadId },
          data: { automationPaused: true, inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
        });
      }
      return;
    }
    if (decision.decision === "WAIT") return;

    if (decision.decision === "DRAFT_FOR_REVIEW") {
      await prisma.aIReplyDraft.updateMany({
        where: { conversationId: input.conversationId, status: "SUGGESTED" },
        data: { status: "SUPERSEDED" },
      });
      await prisma.aIReplyDraft.create({
        data: {
          organizationId: ctx.organizationId,
          leadId: input.leadId,
          conversationId: input.conversationId,
          body: generated.body,
          contextNote: `Strategy ${strategy.action}: ${strategy.reasons.join(", ")}`,
          automationConfidence: strategy.confidence,
          status: "SUGGESTED",
          modelId: "strategy-orchestrator-v1",
          promptVersion: "v1.0",
        },
      });
      return;
    }

    await sendToProspect(ctx, {
      leadId: input.leadId,
      conversationId: input.conversationId,
      body: generated.body,
      subject: generated.subject,
      preferredChannel: generated.preferredChannel,
      fallbackLabel: "Strategy reply not sent — no deliverable channel configured",
    });

    // If the user confirmed a concrete tour slot, create the tour immediately.
    if (
      input.phase === "reply" &&
      strategy.intent === "TOUR_CONFIRMATION" &&
      selectedTourSlot
    ) {
      const existingTour = await prisma.tour.findFirst({
        where: {
          leadId: input.leadId,
          status: "SCHEDULED",
          scheduledAt: selectedTourSlot,
        },
        select: { id: true },
      });
      if (!existingTour) {
        const leadWithListing = await prisma.lead.findFirst({
          where: { id: input.leadId, organizationId: ctx.organizationId },
          select: { listingId: true },
        });
        await createTour(ctx, {
          leadId: input.leadId,
          listingId: leadWithListing?.listingId ?? undefined,
          scheduledAt: selectedTourSlot,
          notes: "Auto-booked from SMS tour confirmation",
        });
        tourBookedViaAi = true;
      }
    }

    if (input.phase === "first_outreach") {
      await transitionAfterFirstOutreach(ctx, input.leadId);
    } else if (!tourBookedViaAi) {
      await transitionOnProspectReply(ctx, input.leadId);
    }

    const { score } = await getQualificationCompleteness(input.leadId);
    await transitionOnQualificationThreshold(ctx, input.leadId, score);
  } catch (error) {
    console.error("[strategy-orchestrator] pipeline failed", {
      leadId: input.leadId,
      conversationId: input.conversationId,
      phase: input.phase,
      error,
    });
    if (input.phase === "reply" && (isSmsConversation || willDeliverViaSms)) {
      await sendFallbackReply(ctx, input);
    }
  }
}
