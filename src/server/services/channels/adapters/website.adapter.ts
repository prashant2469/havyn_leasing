import { ChannelPublishState, ConversationReplyMode, ListingChannelType } from "@prisma/client";

import { defaultReplyModeForChannel } from "@/domains/channels/constants";
import { prisma } from "@/server/db/client";

import type {
  AdapterCapabilities,
  AdapterResult,
  ChannelAdapter,
  IngestInquiryInput,
  IngestInquiryOutput,
  PublishListingInput,
  PublishListingOutput,
  UnpublishListingInput,
} from "../adapter.interface";

/**
 * Website adapter — simulates publishing to your own website/portal.
 * All operations succeed locally with no external API calls.
 */
export class WebsiteAdapter implements ChannelAdapter {
  readonly channelType = ListingChannelType.WEBSITE;

  readonly capabilities: AdapterCapabilities = {
    canPublish: true,
    canUnpublish: true,
    canUpdate: true,
    canIngestInquiries: true,
    canSendReply: false, // website form leads reply via in-app or email
    isExternal: false,
  };

  async publishListing(
    input: PublishListingInput,
  ): Promise<AdapterResult<PublishListingOutput>> {
    // Local simulation: mark as published, set an internal "external" id
    const externalListingId = `web-${input.listingId}`;
    return {
      success: true,
      data: {
        publishState: ChannelPublishState.PUBLISHED,
        externalListingId,
        channelMetadata: {
          url: `/listings/${input.listingId}`,
          publishedAt: new Date().toISOString(),
        },
      },
    };
  }

  async updateListing(
    input: PublishListingInput,
  ): Promise<AdapterResult<PublishListingOutput>> {
    return {
      success: true,
      data: {
        publishState: ChannelPublishState.PUBLISHED,
        externalListingId: `web-${input.listingId}`,
        channelMetadata: { updatedAt: new Date().toISOString() },
      },
    };
  }

  async unpublishListing(
    _input: UnpublishListingInput,
  ): Promise<AdapterResult<void>> {
    return { success: true, data: undefined };
  }

  async ingestInquiry(
    input: IngestInquiryInput,
  ): Promise<AdapterResult<IngestInquiryOutput>> {
    // Delegate to shared ingestion logic in inquiry-ingest.service
    // The adapter itself just validates/normalises the channel-specific payload.
    const replyMode: ConversationReplyMode =
      defaultReplyModeForChannel[ListingChannelType.WEBSITE] ??
      ConversationReplyMode.IN_CHANNEL_REPLY;

    const existing = input.contact.email
      ? await prisma.lead.findFirst({
          where: {
            organizationId: input.organizationId,
            email: input.contact.email,
            ...(input.listingId ? { listingId: input.listingId } : {}),
          },
        })
      : null;

    if (existing) {
      const conversation = await prisma.conversation.findFirst({
        where: { leadId: existing.id },
      });
      return {
        success: true,
        data: {
          leadId: existing.id,
          conversationId: conversation?.id ?? "",
          messageId: "",
          isNewLead: false,
          replyMode,
        },
      };
    }

    // Signal to ingest service: new lead needed
    return {
      success: true,
      data: {
        leadId: "__new__",
        conversationId: "__new__",
        messageId: "__new__",
        isNewLead: true,
        replyMode,
      },
    };
  }
}
