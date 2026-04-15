import {
  MessageAuthorType,
  MessageChannel,
  MessageDirection,
} from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type { LogOutboundMessageInput } from "@/server/validation/message";

export async function getOrCreateLeadConversation(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const existing = await prisma.conversation.findFirst({
    where: { organizationId: ctx.organizationId, leadId },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      organizationId: ctx.organizationId,
      leadId,
      listingId: lead.listingId,
      subject: `${lead.firstName} ${lead.lastName}`,
    },
  });
}

export async function listMessagesForLead(ctx: OrgContext, leadId: string) {
  const convo = await prisma.conversation.findFirst({
    where: { organizationId: ctx.organizationId, leadId },
    include: {
      messages: {
        orderBy: { sentAt: "asc" },
        include: { authorUser: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return convo;
}

export async function logOutboundAutomationMessage(
  ctx: OrgContext,
  input: {
    conversationId: string;
    leadId: string;
    body: string;
    channel: import("@prisma/client").MessageChannel;
  },
) {
  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      direction: MessageDirection.OUTBOUND,
      channel: input.channel,
      body: input.body,
      authorType: MessageAuthorType.USER,
      authorUserId: ctx.userId,
      isAiGenerated: true,
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.MESSAGE_SENT,
    entityType: "Message",
    entityId: message.id,
    metadata: { leadId: input.leadId, channel: input.channel, automation: true },
  });

  return message;
}

export async function logOutboundMessage(ctx: OrgContext, input: LogOutboundMessageInput) {
  const convo = await getOrCreateLeadConversation(ctx, input.leadId);

  const message = await prisma.message.create({
    data: {
      conversationId: convo.id,
      direction: MessageDirection.OUTBOUND,
      channel: input.channel,
      body: input.body,
      authorType: MessageAuthorType.USER,
      authorUserId: ctx.userId,
      isAiGenerated: false,
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.MESSAGE_SENT,
    entityType: "Message",
    entityId: message.id,
    metadata: { leadId: input.leadId, channel: input.channel },
  });

  return message;
}

export async function logInboundPlaceholder(ctx: OrgContext, leadId: string, body: string) {
  const convo = await getOrCreateLeadConversation(ctx, leadId);
  const message = await prisma.message.create({
    data: {
      conversationId: convo.id,
      direction: MessageDirection.INBOUND,
      channel: MessageChannel.IN_APP,
      body,
      authorType: MessageAuthorType.CONTACT,
      isAiGenerated: false,
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.MESSAGE_RECEIVED,
    entityType: "Message",
    entityId: message.id,
    metadata: { leadId },
  });

  return message;
}
