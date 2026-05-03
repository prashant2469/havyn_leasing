import {
  LeadInboxStage,
  LeadStatus,
  ListingChannelType,
  MessageChannel,
  NextActionType,
  Prisma,
} from "@prisma/client";
import { addHours } from "date-fns";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logOutboundAutomationMessage } from "@/server/services/communications/conversation.service";
import { evaluateAutomationDecision } from "@/server/services/ai/automation-decision.service";
import { generateContextualReply } from "@/server/services/ai/contextual-reply.service";
import { computeLeadStrength } from "@/server/services/ai/lead-strength.service";
import { hasOpenEscalationFlags } from "@/server/services/escalation/escalation-rules.service";
import { getNextQualificationPrompt } from "@/server/services/leasing/guided-qualification.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import {
  transitionAfterFirstOutreach,
  transitionOnProspectReply,
  transitionOnQualificationThreshold,
} from "@/server/services/leasing/stage-machine.service";
import { getBusyRangesForProperty } from "@/server/services/tours/availability.service";
import { generateAvailableTourSlots } from "@/server/services/tours/slot-generator.service";
import { sendTransactionalEmail } from "@/server/services/outbound/resend.service";
import { sendTransactionalSms } from "@/server/services/outbound/twilio.service";
import { getFactsForAI } from "@/server/services/properties/property-fact.service";
import { resolveAndExecuteStrategy } from "@/server/services/strategy/strategy-orchestrator.service";
import { normalizePhoneToE164 } from "@/lib/phone";

async function buildTourOfferLines(
  organizationId: string,
  propertyId: string,
  propertySchedule: unknown,
  listingTitle: string,
  maxSlots = 3,
): Promise<string> {
  const now = new Date();
  const internalBusy = await getBusyRangesForProperty(
    organizationId,
    propertyId,
    now,
    addHours(now, 24 * 21),
  );
  const slots = generateAvailableTourSlots(propertySchedule, now, maxSlots, internalBusy);
  if (slots.length === 0) return "";
  const lines = slots.map(
    (d) =>
      `• ${d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
  );
  return `Here are a few tour times that work for ${listingTitle}:\n${lines.join("\n")}\nReply with the option you prefer, or suggest another time.`;
}

async function buildPropertyFactLines(
  ctx: OrgContext,
  input: { propertyId?: string | null; unitId?: string | null },
): Promise<string> {
  if (!input.propertyId) return "";
  const kb = await getFactsForAI(ctx, {
    propertyId: input.propertyId,
    unitId: input.unitId ?? undefined,
    maxFacts: 10,
  });
  if (kb.facts.length === 0) return "";
  const highlights = kb.facts.slice(0, 3).map((f) => `• ${f.question}: ${f.answer}`);
  return `Helpful details:\n${highlights.join("\n")}`;
}

type PreferredOutboundChannel = "EMAIL" | "SMS" | "AUTO";

type SendAttempt = {
  channel: "EMAIL" | "SMS";
  outcome: "sent" | "skipped";
  provider: "resend" | "twilio";
  providerMessageId?: string;
  reason?: string;
};

export type SendToProspectResult = {
  messageId: string;
  delivered: boolean;
  channel: MessageChannel;
  attempts: SendAttempt[];
};

function buildOutboundSubject(
  lead: { listing?: { title: string } | null },
  variant: "inquiry" | "reply" | "follow-up" = "reply",
): string {
  if (variant === "inquiry") {
    return lead.listing?.title
      ? `Re: ${lead.listing.title} — Havyn Leasing`
      : "Thanks for your inquiry — Havyn Leasing";
  }
  if (variant === "follow-up") {
    return lead.listing?.title
      ? `Checking in on ${lead.listing.title} — Havyn Leasing`
      : "Quick follow-up — Havyn Leasing";
  }
  return lead.listing?.title
    ? `Re: ${lead.listing.title} — Havyn Leasing`
    : "Re: your message — Havyn Leasing";
}

function candidateChannels(
  preferredChannel: PreferredOutboundChannel,
): ("EMAIL" | "SMS")[] {
  if (preferredChannel === "EMAIL") return ["EMAIL", "SMS"];
  if (preferredChannel === "SMS") return ["SMS", "EMAIL"];
  return ["SMS", "EMAIL"];
}

function deliveryMetadata(
  status: "sent" | "skipped",
  attempts: SendAttempt[],
): Prisma.InputJsonValue {
  return {
    delivery: {
      status,
      attempts,
    },
  } as Prisma.InputJsonValue;
}

export async function sendToProspect(
  ctx: OrgContext,
  input: {
    leadId: string;
    conversationId: string;
    body: string;
    subject?: string;
    preferredChannel?: PreferredOutboundChannel;
    authorType?: "USER" | "AI";
    authorUserId?: string | null;
    isAiGenerated?: boolean;
    provider?: string | null;
    fallbackLabel?: string;
  },
): Promise<SendToProspectResult> {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    include: {
      listing: { select: { title: true } },
    },
  });
  if (!lead) throw new Error("Lead not found");

  const attempts: SendAttempt[] = [];
  const preferred = input.preferredChannel ?? "AUTO";
  for (const channel of candidateChannels(preferred)) {
    if (channel === "EMAIL" && lead.email?.trim()) {
      try {
        const sendResult = await sendTransactionalEmail({
          to: lead.email.trim(),
          subject: input.subject ?? buildOutboundSubject(lead),
          text: input.body,
        });
        if (!("id" in sendResult)) {
          attempts.push({
            channel,
            outcome: "skipped",
            provider: "resend",
            reason: sendResult.reason,
          });
          continue;
        }
        attempts.push({
          channel,
          outcome: "sent",
          provider: "resend",
          providerMessageId: sendResult.id,
        });
        const message = await logOutboundAutomationMessage(ctx, {
          conversationId: input.conversationId,
          leadId: input.leadId,
          body: input.body,
          channel,
          authorType: input.authorType,
          authorUserId: input.authorUserId,
          isAiGenerated: input.isAiGenerated,
          provider: input.provider ?? "resend",
          channelMetadata: deliveryMetadata("sent", attempts),
        });
        console.info("[sendToProspect] result", {
          leadId: input.leadId,
          conversationId: input.conversationId,
          delivered: true,
          channel,
          attempts,
        });
        return { messageId: message.id, delivered: true, channel, attempts };
      } catch (error) {
        attempts.push({
          channel,
          outcome: "skipped",
          provider: "resend",
          reason: error instanceof Error ? error.message : "send_failed",
        });
        continue;
      }
    }

    if (channel === "SMS" && lead.phone?.trim()) {
      try {
        const sendResult = await sendTransactionalSms({
          organizationId: ctx.organizationId,
          to: lead.phone.trim(),
          body: input.body,
        });
        if (!("id" in sendResult)) {
          attempts.push({
            channel,
            outcome: "skipped",
            provider: "twilio",
            reason: sendResult.reason,
          });
          continue;
        }
        attempts.push({
          channel,
          outcome: "sent",
          provider: "twilio",
          providerMessageId: sendResult.id,
        });
        const normalizedPhone = normalizePhoneToE164(lead.phone);
        const message = await prisma.$transaction(async (tx) => {
          const logged = await logOutboundAutomationMessage(ctx, {
            conversationId: input.conversationId,
            leadId: input.leadId,
            body: input.body,
            channel,
            authorType: input.authorType,
            authorUserId: input.authorUserId,
            isAiGenerated: input.isAiGenerated,
            provider: input.provider ?? "twilio",
            externalId: sendResult.id,
            channelMetadata: deliveryMetadata("sent", attempts),
          });
          if (normalizedPhone) {
            await tx.contactChannelIdentity.upsert({
              where: {
                leadId_channelType_handle: {
                  leadId: input.leadId,
                  channelType: ListingChannelType.SMS,
                  handle: normalizedPhone,
                },
              },
              update: {},
              create: {
                leadId: input.leadId,
                channelType: ListingChannelType.SMS,
                handle: normalizedPhone,
              },
            });
          }
          return logged;
        });
        console.info("[sendToProspect] result", {
          leadId: input.leadId,
          conversationId: input.conversationId,
          delivered: true,
          channel,
          attempts,
        });
        return { messageId: message.id, delivered: true, channel, attempts };
      } catch (error) {
        attempts.push({
          channel,
          outcome: "skipped",
          provider: "twilio",
          reason: error instanceof Error ? error.message : "send_failed",
        });
        continue;
      }
    }
  }

  const fallbackBody = `[${input.fallbackLabel ?? "Message not sent"}] ${input.body}`;
  const message = await logOutboundAutomationMessage(ctx, {
    conversationId: input.conversationId,
    leadId: input.leadId,
    body: fallbackBody,
    channel: MessageChannel.IN_APP,
    authorType: input.authorType,
    authorUserId: input.authorUserId,
    isAiGenerated: input.isAiGenerated,
    provider: input.provider ?? "none",
    channelMetadata: deliveryMetadata("skipped", attempts),
  });
  console.info("[sendToProspect] result", {
    leadId: input.leadId,
    conversationId: input.conversationId,
    delivered: false,
    channel: MessageChannel.IN_APP,
    attempts,
  });
  return {
    messageId: message.id,
    delivered: false,
    channel: MessageChannel.IN_APP,
    attempts,
  };
}

/**
 * First automated outbound after copilot: send using preferred channel, then advance stage.
 */
export async function dispatchFirstOutreach(
  ctx: OrgContext,
  leadId: string,
  conversationId: string,
): Promise<void> {
  await resolveAndExecuteStrategy(ctx, {
    leadId,
    conversationId,
    phase: "first_outreach",
  });
}

/**
 * After each new inbound message: send one guided follow-up (email when possible).
 * Skips if automation is paused, escalated, or the latest inbound was already answered.
 */
export async function dispatchAutomationReply(
  ctx: OrgContext,
  leadId: string,
  conversationId: string,
): Promise<void> {
  await resolveAndExecuteStrategy(ctx, {
    leadId,
    conversationId,
    phase: "reply",
  });
}

export async function dispatchLeadFollowUp(
  ctx: OrgContext,
  leadId: string,
  options?: { conversationId?: string | null },
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    include: {
      listing: { include: { unit: { include: { property: true } } } },
    },
  });
  if (!lead || lead.automationPaused) return;
  if (lead.status === LeadStatus.CONVERTED || lead.status === LeadStatus.LOST) return;

  const conversationId =
    options?.conversationId ??
    (
      await prisma.conversation.findFirst({
        where: { organizationId: ctx.organizationId, leadId: lead.id },
        select: { id: true },
      })
    )?.id;
  if (!conversationId) return;

  if (await hasOpenEscalationFlags(ctx.organizationId, leadId)) return;

  const guided = await getNextQualificationPrompt(leadId);
  let body = `Hi ${lead.firstName},\n\nQuick follow-up in case this got buried.`;
  if (lead.nextActionType === NextActionType.TOUR) {
    body = `Hi ${lead.firstName},\n\nWanted to follow up with tour options.`;
  } else if (lead.nextActionType === NextActionType.SMS || lead.nextActionType === NextActionType.EMAIL) {
    body = `Hi ${lead.firstName},\n\nFollowing up on your inquiry and next steps.`;
  }
  if (guided) {
    body = `${body}\n\n${guided}`;
  }

  const { score } = await getQualificationCompleteness(leadId);
  const property = lead.listing?.unit?.property;
  if (property && score >= 0.5) {
    const offer = await buildTourOfferLines(
      ctx.organizationId,
      property.id,
      property.showingSchedule,
      lead.listing?.title ?? "this home",
    );
    if (offer) {
      body = `${body}\n\n${offer}`;
    }
  }
  const factLines = await buildPropertyFactLines(ctx, {
    propertyId: property?.id,
    unitId: lead.listing?.unit?.id ?? null,
  });
  if (factLines) body = `${body}\n\n${factLines}`;

  const preferredChannel =
    lead.nextActionType === NextActionType.EMAIL
      ? "EMAIL"
      : lead.nextActionType === NextActionType.SMS
        ? "SMS"
        : "AUTO";

  await sendToProspect(ctx, {
    leadId,
    conversationId,
    body,
    subject: buildOutboundSubject(lead, "follow-up"),
    preferredChannel,
    fallbackLabel: "Follow-up not sent — no deliverable channel configured",
  });

  const nextFollowUpCount = lead.followUpCount + 1;
  const reachedLimit = nextFollowUpCount >= 3;
  await prisma.lead.update({
    where: { id: leadId },
    data: reachedLimit
      ? {
          followUpCount: nextFollowUpCount,
          inboxStage: LeadInboxStage.COLD_LEADS,
          nextActionAt: null,
          nextActionType: null,
        }
      : {
          followUpCount: nextFollowUpCount,
          nextActionAt: addHours(new Date(), nextFollowUpCount === 1 ? 24 : 48),
          nextActionType: NextActionType.FOLLOW_UP,
        },
  });
}
