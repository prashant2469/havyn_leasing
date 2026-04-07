import {
  ConversationReplyMode,
  MessageAuthorType,
  MessageChannel,
  MessageDirection,
  Prisma,
} from "@prisma/client";

import { defaultReplyModeForChannel } from "@/domains/channels/constants";
import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";

export interface IngestInquiryParams {
  channelType: import("@prisma/client").ListingChannelType;
  listingId?: string | null;
  contact: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
  message: string;
  externalLeadId?: string;
  externalThreadId?: string;
  sourceMetadata?: Record<string, unknown>;
}

export interface IngestInquiryResult {
  leadId: string;
  conversationId: string;
  messageId: string;
  isNewLead: boolean;
  replyMode: ConversationReplyMode;
}

/**
 * Core ingestion coordinator — creates or upserts a Lead, Conversation, and
 * first Message from any channel source. Channel adapters call this after
 * normalising their payload.
 */
export async function ingestInquiry(
  ctx: OrgContext,
  params: IngestInquiryParams,
): Promise<IngestInquiryResult> {
  const replyMode =
    defaultReplyModeForChannel[params.channelType] ?? ConversationReplyMode.MANUAL_ONLY;

  // --- Lead dedup: match by email within the org (and optionally listing) ---
  let lead = params.contact.email
    ? await prisma.lead.findFirst({
        where: {
          organizationId: ctx.organizationId,
          email: params.contact.email,
          ...(params.listingId ? { listingId: params.listingId } : {}),
        },
      })
    : null;

  const isNewLead = !lead;

  if (!lead) {
    // Resolve listing → property chain for enrichment
    const listing = params.listingId
      ? await prisma.listing.findFirst({
          where: { id: params.listingId, organizationId: ctx.organizationId },
          include: { unit: { include: { property: true } } },
        })
      : null;

    lead = await prisma.lead.create({
      data: {
        organizationId: ctx.organizationId,
        listingId: params.listingId ?? null,
        propertyId: listing?.unit?.property?.id ?? null,
        primaryUnitId: listing?.unitId ?? null,
        firstName: params.contact.firstName,
        lastName: params.contact.lastName,
        email: params.contact.email ?? null,
        phone: params.contact.phone ?? null,
        source: params.channelType,
        sourceChannelType: params.channelType,
        sourceChannelRefId: params.externalLeadId ?? null,
        sourceAttribution: {
          channelType: params.channelType,
          externalLeadId: params.externalLeadId ?? null,
          ingestedAt: new Date().toISOString(),
          ...(params.sourceMetadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    await logActivity({
      ctx,
      verb: ActivityVerbs.LEAD_CREATED,
      entityType: "Lead",
      entityId: lead.id,
      metadata: {
        source: params.channelType,
        isNewLead: true,
      },
    });

    await logActivity({
      ctx,
      verb: ActivityVerbs.LEAD_SOURCE_ATTRIBUTED,
      entityType: "Lead",
      entityId: lead.id,
      metadata: {
        sourceChannelType: params.channelType,
        externalLeadId: params.externalLeadId,
      },
    });
  } else {
    // Update funnel timestamps on existing lead
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastResponseAt: new Date() },
    });
  }

  // --- Conversation: one per lead (dedup by leadId) ---
  let conversation = await prisma.conversation.findFirst({
    where: { organizationId: ctx.organizationId, leadId: lead.id },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: ctx.organizationId,
        leadId: lead.id,
        listingId: params.listingId ?? null,
        subject: `${params.contact.firstName} ${params.contact.lastName}`,
        channelType: params.channelType,
        replyMode,
        externalThreadId: params.externalThreadId ?? null,
        sourceMetadata: (params.sourceMetadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  // --- Message: first inbound ---
  const messageChannelMap: Record<
    import("@prisma/client").ListingChannelType,
    MessageChannel
  > = {
    WEBSITE: MessageChannel.IN_APP,
    ZILLOW: MessageChannel.OTHER,
    FACEBOOK_MARKETPLACE: MessageChannel.OTHER,
    EMAIL: MessageChannel.EMAIL,
    SMS: MessageChannel.SMS,
    MANUAL: MessageChannel.IN_APP,
    OTHER: MessageChannel.OTHER,
  };

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      channel: messageChannelMap[params.channelType] ?? MessageChannel.OTHER,
      body: params.message,
      authorType: MessageAuthorType.CONTACT,
      isAiGenerated: false,
      channelMetadata: {
        sourceChannelType: params.channelType,
        externalLeadId: params.externalLeadId ?? null,
        externalThreadId: params.externalThreadId ?? null,
      },
    },
  });

  // Update firstResponseAt if not set
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      firstResponseAt: lead.firstResponseAt ?? new Date(),
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.INQUIRY_INGESTED,
    entityType: "Lead",
    entityId: lead.id,
    metadata: {
      channelType: params.channelType,
      conversationId: conversation.id,
      messageId: message.id,
      isNewLead,
      replyMode,
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.MESSAGE_RECEIVED,
    entityType: "Message",
    entityId: message.id,
    metadata: { leadId: lead.id, channel: params.channelType },
  });

  return {
    leadId: lead.id,
    conversationId: conversation.id,
    messageId: message.id,
    isNewLead,
    replyMode,
  };
}
