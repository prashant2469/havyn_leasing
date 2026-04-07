import { ChannelPublishState, ConversationReplyMode, ListingChannelType } from "@prisma/client";

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
 * Manual adapter — represents manually-managed channels (phone, walk-in, spreadsheet imports).
 * Publish always succeeds locally. Inquiries are always new leads.
 */
export class ManualAdapter implements ChannelAdapter {
  readonly channelType = ListingChannelType.MANUAL;

  readonly capabilities: AdapterCapabilities = {
    canPublish: true,
    canUnpublish: true,
    canUpdate: true,
    canIngestInquiries: true,
    canSendReply: false,
    isExternal: false,
  };

  async publishListing(
    input: PublishListingInput,
  ): Promise<AdapterResult<PublishListingOutput>> {
    return {
      success: true,
      data: {
        publishState: ChannelPublishState.PUBLISHED,
        externalListingId: `manual-${input.listingId}`,
        channelMetadata: { note: "Manually activated" },
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
        externalListingId: `manual-${input.listingId}`,
      },
    };
  }

  async unpublishListing(
    _input: UnpublishListingInput,
  ): Promise<AdapterResult<void>> {
    return { success: true, data: undefined };
  }

  async ingestInquiry(
    _input: IngestInquiryInput,
  ): Promise<AdapterResult<IngestInquiryOutput>> {
    return {
      success: true,
      data: {
        leadId: "__new__",
        conversationId: "__new__",
        messageId: "__new__",
        isNewLead: true,
        replyMode: ConversationReplyMode.MANUAL_ONLY,
      },
    };
  }
}
