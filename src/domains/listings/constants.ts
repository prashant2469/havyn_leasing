import {
  ChannelPublishState,
  ChannelPublishStatus,
  ChannelSyncOperation,
  ChannelSyncStatus,
  ListingChannelType,
  ListingStatus,
} from "@prisma/client";

export const listingStatusLabel: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  RENTED: "Rented",
  ARCHIVED: "Archived",
};

export const listingStatusColor: Record<ListingStatus, string> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  PAUSED: "outline",
  RENTED: "default",
  ARCHIVED: "secondary",
};

export const channelTypeLabel: Record<ListingChannelType, string> = {
  WEBSITE: "Website",
  ZILLOW: "Zillow",
  FACEBOOK_MARKETPLACE: "Facebook",
  EMAIL: "Email",
  SMS: "SMS",
  MANUAL: "Manual",
  OTHER: "Other",
};

/** Short emoji/icon hint for channel type badges */
export const channelTypeIcon: Record<ListingChannelType, string> = {
  WEBSITE: "🌐",
  ZILLOW: "🏠",
  FACEBOOK_MARKETPLACE: "📘",
  EMAIL: "✉️",
  SMS: "💬",
  MANUAL: "📋",
  OTHER: "•",
};

/** V1 compat labels */
export const publishStatusLabel: Record<ChannelPublishStatus, string> = {
  NOT_CONNECTED: "Not connected",
  PENDING: "Pending",
  LIVE: "Live",
  ERROR: "Error",
  PAUSED: "Paused",
};

/** V2 richer publish state labels */
export const channelPublishStateLabel: Record<ChannelPublishState, string> = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  UNPUBLISHED: "Unpublished",
  SYNC_ERROR: "Sync Error",
};

export const channelPublishStateColor: Record<ChannelPublishState, string> = {
  DRAFT: "secondary",
  QUEUED: "outline",
  PUBLISHED: "default",
  PAUSED: "outline",
  UNPUBLISHED: "secondary",
  SYNC_ERROR: "destructive",
};

export const syncOperationLabel: Record<ChannelSyncOperation, string> = {
  PUBLISH: "Publish",
  UPDATE: "Update",
  UNPUBLISH: "Unpublish",
  RETRY: "Retry",
  INGEST_TEST: "Ingest Test",
};

export const syncStatusLabel: Record<ChannelSyncStatus, string> = {
  IDLE: "Idle",
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
};

export const syncStatusColor: Record<ChannelSyncStatus, string> = {
  IDLE: "secondary",
  RUNNING: "outline",
  SUCCEEDED: "default",
  FAILED: "destructive",
};
