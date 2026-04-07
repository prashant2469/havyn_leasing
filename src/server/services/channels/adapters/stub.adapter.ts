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
 * Stub adapter for external channels not yet integrated (Zillow, Facebook, etc.).
 * All operations return a structured "not supported" error so the UI can show
 * appropriate state without crashing.
 *
 * TODO: Replace each stub with a real adapter when the external API integration is ready.
 */
export class StubAdapter implements ChannelAdapter {
  constructor(public readonly channelType: ListingChannelType) {}

  readonly capabilities: AdapterCapabilities = {
    canPublish: false,
    canUnpublish: false,
    canUpdate: false,
    canIngestInquiries: false,
    canSendReply: false,
    isExternal: true,
  };

  private notSupported(): AdapterResult<never> {
    return {
      success: false,
      error: `${this.channelType} integration is not yet available. Configure it when the adapter is implemented.`,
      retryable: false,
    };
  }

  async publishListing(
    _input: PublishListingInput,
  ): Promise<AdapterResult<PublishListingOutput>> {
    return this.notSupported() as AdapterResult<PublishListingOutput>;
  }

  async updateListing(
    _input: PublishListingInput,
  ): Promise<AdapterResult<PublishListingOutput>> {
    return this.notSupported() as AdapterResult<PublishListingOutput>;
  }

  async unpublishListing(
    _input: UnpublishListingInput,
  ): Promise<AdapterResult<void>> {
    return this.notSupported() as AdapterResult<void>;
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
        // External channels default to manual-only until integration is live
        replyMode: ConversationReplyMode.MANUAL_ONLY,
      },
    };
  }
}
