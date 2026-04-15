import { LeadInboxStage, MessageChannel } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logOutboundAutomationMessage } from "@/server/services/communications/conversation.service";
import { hasOpenEscalationFlags } from "@/server/services/escalation/escalation-rules.service";
import { getNextQualificationPrompt } from "@/server/services/leasing/guided-qualification.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import { transitionAfterFirstOutreach } from "@/server/services/leasing/stage-machine.service";
import { generateTourSlots } from "@/server/services/tours/slot-generator.service";
import { sendTransactionalEmail } from "@/server/services/outbound/resend.service";

function buildTourOfferLines(propertySchedule: unknown, listingTitle: string): string {
  const slots = generateTourSlots(propertySchedule, new Date(), 3);
  if (slots.length === 0) return "";
  const lines = slots.map((d) => `• ${d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`);
  return `Here are a few tour times that work for ${listingTitle}:\n${lines.join("\n")}\nReply with the option you prefer, or suggest another time.`;
}

/**
 * First automated outbound after copilot: email if possible, then advance stage.
 */
export async function dispatchFirstOutreach(
  ctx: OrgContext,
  leadId: string,
  conversationId: string,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    include: {
      listing: { include: { unit: { include: { property: true } } } },
    },
  });
  if (!lead || lead.automationPaused) return;

  if (
    lead.inboxStage !== LeadInboxStage.NEW_INQUIRY &&
    lead.inboxStage !== LeadInboxStage.NEW_LEADS
  ) {
    return;
  }

  if (await hasOpenEscalationFlags(ctx.organizationId, leadId)) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { automationPaused: true },
    });
    return;
  }

  const outboundCount = await prisma.message.count({
    where: { conversationId, direction: "OUTBOUND" },
  });
  if (outboundCount > 0) return;

  const draft = await prisma.aIReplyDraft.findFirst({
    where: { conversationId, organizationId: ctx.organizationId },
    orderBy: { generatedAt: "desc" },
  });

  const guided = await getNextQualificationPrompt(leadId);
  let body =
    draft?.body ??
    guided ??
    `Hi ${lead.firstName},\n\nThanks for reaching out! We're on it and will help you find the right fit.\n\nWhat's your target move-in date and ideal monthly budget?`;

  const { score } = await getQualificationCompleteness(leadId);
  const property = lead.listing?.unit?.property;
  if (property && score >= 0.5) {
    const offer = buildTourOfferLines(property.showingSchedule, lead.listing?.title ?? "this home");
    if (offer) {
      body = `${body}\n\n${offer}`;
    }
  }

  const email = lead.email?.trim();
  if (!email) {
    await logOutboundAutomationMessage(ctx, {
      conversationId,
      leadId,
      body: `[Email not sent — no address on file] ${body}`,
      channel: MessageChannel.IN_APP,
    });
    await transitionAfterFirstOutreach(ctx, leadId);
    return;
  }

  const subject = lead.listing?.title
    ? `Re: ${lead.listing.title} — Havyn Leasing`
    : `Thanks for your inquiry — Havyn Leasing`;

  const sendResult = await sendTransactionalEmail({
    to: email,
    subject,
    text: body,
  });

  if ("skipped" in sendResult && sendResult.skipped) {
    await logOutboundAutomationMessage(ctx, {
      conversationId,
      leadId,
      body: `[Email not sent — configure RESEND] ${body}`,
      channel: MessageChannel.EMAIL,
    });
  } else {
    await logOutboundAutomationMessage(ctx, {
      conversationId,
      leadId,
      body,
      channel: MessageChannel.EMAIL,
    });
  }

  await transitionAfterFirstOutreach(ctx, leadId);
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
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    include: {
      listing: { include: { unit: { include: { property: true } } } },
    },
  });
  if (!lead || lead.automationPaused) return;

  if (await hasOpenEscalationFlags(ctx.organizationId, leadId)) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { automationPaused: true },
    });
    return;
  }

  const lastInbound = await prisma.message.findFirst({
    where: { conversationId, direction: "INBOUND" },
    orderBy: { sentAt: "desc" },
  });
  const lastOutbound = await prisma.message.findFirst({
    where: { conversationId, direction: "OUTBOUND" },
    orderBy: { sentAt: "desc" },
  });
  if (!lastInbound) return;
  if (lastOutbound && lastOutbound.sentAt >= lastInbound.sentAt) return;

  const guided = await getNextQualificationPrompt(leadId);
  const draft = await prisma.aIReplyDraft.findFirst({
    where: { conversationId, organizationId: ctx.organizationId },
    orderBy: { generatedAt: "desc" },
  });

  let body =
    guided ??
    draft?.body ??
    `Thanks for the update — we're noting this and will follow up shortly.`;

  const { score } = await getQualificationCompleteness(leadId);
  const property = lead.listing?.unit?.property;
  if (property && score >= 0.5) {
    const offer = buildTourOfferLines(property.showingSchedule, lead.listing?.title ?? "this home");
    if (offer) {
      body = `${body}\n\n${offer}`;
    }
  }

  const email = lead.email?.trim();
  if (!email) {
    await logOutboundAutomationMessage(ctx, {
      conversationId,
      leadId,
      body: `[Email not sent — no address on file] ${body}`,
      channel: MessageChannel.IN_APP,
    });
    return;
  }

  const subject = lead.listing?.title
    ? `Re: ${lead.listing.title} — Havyn Leasing`
    : `Re: your message — Havyn Leasing`;

  const sendResult = await sendTransactionalEmail({
    to: email,
    subject,
    text: body,
  });

  if ("skipped" in sendResult && sendResult.skipped) {
    await logOutboundAutomationMessage(ctx, {
      conversationId,
      leadId,
      body: `[Email not sent — configure RESEND] ${body}`,
      channel: MessageChannel.EMAIL,
    });
  } else {
    await logOutboundAutomationMessage(ctx, {
      conversationId,
      leadId,
      body,
      channel: MessageChannel.EMAIL,
    });
  }
}
