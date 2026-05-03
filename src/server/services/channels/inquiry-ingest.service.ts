import {
  ConversationReplyMode,
  type Lead,
  LeadInboxStage,
  ListingChannelType,
  MessageAuthorType,
  MessageChannel,
  MessageDirection,
  Prisma,
} from "@prisma/client";

import { defaultReplyModeForChannel } from "@/domains/channels/constants";
import { ActivityVerbs } from "@/domains/activity/verbs";
import { normalizePhoneToE164 } from "@/lib/phone";
import type { ActivitySourceContext } from "@/server/services/activity/activity.service";
import { shouldBypassPhoneLeadDedupe } from "@/server/services/channels/application-phone-dedupe-bypass";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import { enqueueLeadIngested, enqueueMessageReceived } from "@/server/jobs/events";

type DbClient = Prisma.TransactionClient | typeof prisma;

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

async function upsertLeadContactIdentities(input: {
  db: DbClient;
  leadId: string;
  email?: string | null;
  phone?: string | null;
}) {
  const writes: Promise<unknown>[] = [];
  const email = input.email?.trim().toLowerCase();
  if (email) {
    writes.push(
      input.db.contactChannelIdentity.upsert({
        where: {
          leadId_channelType_handle: {
            leadId: input.leadId,
            channelType: ListingChannelType.EMAIL,
            handle: email,
          },
        },
        update: {},
        create: {
          leadId: input.leadId,
          channelType: ListingChannelType.EMAIL,
          handle: email,
        },
      }),
    );
  }

  const normalizedPhone = normalizePhoneToE164(input.phone);
  if (normalizedPhone) {
    writes.push(
      input.db.contactChannelIdentity.upsert({
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
      }),
    );
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }
}

export async function resolveLeadByPhone(params: {
  organizationId: string;
  phone: string;
  listingId?: string | null;
}) {
  const normalizedPhone = normalizePhoneToE164(params.phone);
  if (!normalizedPhone) return null;

  const byIdentity = await prisma.contactChannelIdentity.findFirst({
    where: {
      channelType: ListingChannelType.SMS,
      handle: normalizedPhone,
      lead: {
        organizationId: params.organizationId,
        ...(params.listingId ? { listingId: params.listingId } : {}),
      },
    },
    select: { leadId: true },
  });
  if (byIdentity?.leadId) {
    return prisma.lead.findFirst({
      where: {
        id: byIdentity.leadId,
        organizationId: params.organizationId,
      },
    });
  }

  return prisma.lead.findFirst({
    where: {
      organizationId: params.organizationId,
      phone: normalizedPhone,
      ...(params.listingId ? { listingId: params.listingId } : {}),
    },
  });
}

/**
 * Core ingestion coordinator — creates or upserts a Lead, Conversation, and
 * first Message from any channel source. Channel adapters call this after
 * normalising their payload.
 */
export async function ingestInquiry(
  ctx: ActivitySourceContext,
  params: IngestInquiryParams,
): Promise<IngestInquiryResult> {
  const replyMode =
    defaultReplyModeForChannel[params.channelType] ?? ConversationReplyMode.MANUAL_ONLY;

  const normalizedEmail = params.contact.email?.trim().toLowerCase() ?? null;
  const normalizedPhone = normalizePhoneToE164(params.contact.phone) ?? params.contact.phone ?? null;

  const dedupeKey = [
    ctx.organizationId,
    normalizedEmail ?? "",
    normalizedPhone ?? "",
    params.externalThreadId ?? "",
    params.externalLeadId ?? "",
  ].join("|");

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

  const bypassLeadDedupeForQaPhone = shouldBypassPhoneLeadDedupe({
    organizationId: ctx.organizationId,
    contactPhoneRaw: params.contact.phone,
  });

  const { lead, conversation, message, isNewLead } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeKey}))`;

    // --- Lead dedup: match by email, then phone identity / lead.phone (unless QA allowlist) ---
    let lead: Lead | null = null;
    if (!bypassLeadDedupeForQaPhone && normalizedEmail) {
      lead = await tx.lead.findFirst({
        where: {
          organizationId: ctx.organizationId,
          email: normalizedEmail,
          ...(params.listingId ? { listingId: params.listingId } : {}),
        },
      });
    }

    const skipPhoneLeadDedupe = bypassLeadDedupeForQaPhone;

    if (!lead && normalizedPhone && !skipPhoneLeadDedupe) {
      const byIdentity = await tx.contactChannelIdentity.findFirst({
        where: {
          channelType: ListingChannelType.SMS,
          handle: normalizedPhone,
          lead: {
            organizationId: ctx.organizationId,
            ...(params.listingId ? { listingId: params.listingId } : {}),
          },
        },
        select: { leadId: true },
      });
      if (byIdentity?.leadId) {
        lead = await tx.lead.findFirst({
          where: {
            id: byIdentity.leadId,
            organizationId: ctx.organizationId,
          },
        });
      }
      if (!lead) {
        lead = await tx.lead.findFirst({
          where: {
            organizationId: ctx.organizationId,
            phone: normalizedPhone,
            ...(params.listingId ? { listingId: params.listingId } : {}),
          },
        });
      }
    }

    const isNewLead = !lead;
    if (!lead) {
      const listing = params.listingId
        ? await tx.listing.findFirst({
            where: { id: params.listingId, organizationId: ctx.organizationId },
            include: { unit: { include: { property: true } } },
          })
        : null;
      lead = await tx.lead.create({
        data: {
          organizationId: ctx.organizationId,
          listingId: params.listingId ?? null,
          propertyId: listing?.unit?.property?.id ?? null,
          primaryUnitId: listing?.unitId ?? null,
          firstName: params.contact.firstName,
          lastName: params.contact.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          inboxStage: LeadInboxStage.NEW_INQUIRY,
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
    }

    await upsertLeadContactIdentities({
      db: tx,
      leadId: lead.id,
      email: normalizedEmail ?? lead.email,
      phone: normalizedPhone ?? lead.phone,
    });

    const conversation = await tx.conversation.upsert({
      where: {
        organizationId_leadId: { organizationId: ctx.organizationId, leadId: lead.id },
      },
      update: {
        listingId: params.listingId ?? null,
        channelType: params.channelType,
        replyMode,
        externalThreadId: params.externalThreadId ?? undefined,
        sourceMetadata: (params.sourceMetadata ?? {}) as Prisma.InputJsonValue,
      },
      create: {
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

    const message = await tx.message.create({
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

    return { lead, conversation, message, isNewLead };
  });

  if (isNewLead) {
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
  }

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

  try {
    const payload = {
      organizationId: ctx.organizationId,
      leadId: lead.id,
      conversationId: conversation.id,
      messageId: message.id,
    };
    if (isNewLead) {
      await enqueueLeadIngested(payload);
    } else {
      await enqueueMessageReceived(payload);
    }
  } catch (err) {
    console.error("[ingestInquiry] automation enqueue failed:", err);
  }

  return {
    leadId: lead.id,
    conversationId: conversation.id,
    messageId: message.id,
    isNewLead,
    replyMode,
  };
}
