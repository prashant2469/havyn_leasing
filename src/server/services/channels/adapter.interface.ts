import type {
  ChannelPublishState,
  ChannelSyncOperation,
  ConversationReplyMode,
  ListingChannelType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared result types
// ---------------------------------------------------------------------------

export type AdapterResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; retryable: boolean };

export interface PublishListingInput {
  organizationId: string;
  /** Org URL slug — used for public microsite links on WEBSITE channel. */
  organizationSlug?: string;
  listingChannelId: string;
  listingId: string;
  channelType: ListingChannelType;
  listing: {
    title: string;
    description?: string | null;
    monthlyRent: string; // serialized Decimal
    bedrooms?: number | null;
    bathrooms?: number | null;
    availableFrom?: Date | null;
    petPolicy?: string | null;
    amenities: unknown;
    publicSlug?: string | null;
  };
  metadata: Record<string, unknown>;
  requestedByUserId?: string;
}

export interface PublishListingOutput {
  publishState: ChannelPublishState;
  externalListingId?: string;
  channelMetadata?: Record<string, unknown>;
}

export interface UnpublishListingInput {
  organizationId: string;
  listingChannelId: string;
  listingId: string;
  channelType: ListingChannelType;
  externalListingId?: string | null;
  requestedByUserId?: string;
}

export interface IngestInquiryInput {
  organizationId: string;
  channelType: ListingChannelType;
  listingId?: string | null;
  externalLeadId?: string;
  externalThreadId?: string;
  contact: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
  message: string;
  sourceMetadata?: Record<string, unknown>;
}

export interface IngestInquiryOutput {
  leadId: string;
  conversationId: string;
  messageId: string;
  isNewLead: boolean;
  replyMode: ConversationReplyMode;
}

export interface SendReplyInput {
  organizationId: string;
  conversationId: string;
  channelType: ListingChannelType;
  externalThreadId?: string | null;
  body: string;
  authorUserId?: string;
}

// ---------------------------------------------------------------------------
// Capability flags — returned by adapters so UI can conditionally render actions
// ---------------------------------------------------------------------------

export interface AdapterCapabilities {
  canPublish: boolean;
  canUnpublish: boolean;
  canUpdate: boolean;
  canIngestInquiries: boolean;
  canSendReply: boolean;
  isExternal: boolean; // requires real third-party API
}

// ---------------------------------------------------------------------------
// Core adapter interface — all channel adapters implement this
// ---------------------------------------------------------------------------

export interface ChannelAdapter {
  channelType: ListingChannelType;
  capabilities: AdapterCapabilities;

  publishListing(input: PublishListingInput): Promise<AdapterResult<PublishListingOutput>>;
  updateListing(input: PublishListingInput): Promise<AdapterResult<PublishListingOutput>>;
  unpublishListing(input: UnpublishListingInput): Promise<AdapterResult<void>>;

  ingestInquiry(input: IngestInquiryInput): Promise<AdapterResult<IngestInquiryOutput>>;

  sendReply?(input: SendReplyInput): Promise<AdapterResult<void>>;
}

export type SyncOperationContext = {
  operation: ChannelSyncOperation;
  listingChannelId: string;
  requestedByUserId?: string;
};
