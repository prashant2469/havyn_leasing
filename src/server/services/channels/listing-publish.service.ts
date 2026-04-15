import {
  ChannelPublishState,
  ChannelPublishStatus,
  ChannelSyncOperation,
  ChannelSyncStatus,
  Prisma,
} from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";

import type { PublishListingInput } from "./adapter.interface";
import { getAdapter } from "./channel-registry.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getChannel(organizationId: string, listingChannelId: string) {
  const channel = await prisma.listingChannel.findFirst({
    where: {
      id: listingChannelId,
      listing: { organizationId },
    },
    include: {
      listing: {
        include: {
          organization: { select: { slug: true } },
        },
      },
    },
  });
  if (!channel) throw new Error("Listing channel not found");
  return channel;
}

async function startSyncRun(
  listingChannelId: string,
  operation: ChannelSyncOperation,
  requestPayload: Record<string, unknown>,
  requestedByUserId?: string,
) {
  return prisma.listingChannelSync.create({
    data: {
      listingChannelId,
      operation,
      status: ChannelSyncStatus.RUNNING,
      requestPayload: requestPayload as Prisma.InputJsonValue,
      requestedByUserId: requestedByUserId ?? null,
    },
  });
}

async function completeSyncRun(
  syncId: string,
  channelId: string,
  result: {
    status: ChannelSyncStatus;
    errorMessage?: string;
    resultPayload?: Record<string, unknown>;
    publishState?: ChannelPublishState;
    externalListingId?: string;
    lastSyncError?: string | null;
    lastSyncedAt?: Date;
    lastPublishedAt?: Date;
    lastUnpublishedAt?: Date;
  },
) {
  await prisma.listingChannelSync.update({
    where: { id: syncId },
    data: {
      status: result.status,
      completedAt: new Date(),
      errorMessage: result.errorMessage ?? null,
      resultPayload: (result.resultPayload ?? {}) as Prisma.InputJsonValue,
    },
  });

  const channelUpdate: Record<string, unknown> = {
    lastSyncedAt: new Date(),
    lastSyncError: result.lastSyncError ?? null,
  };

  if (result.publishState !== undefined) {
    channelUpdate.publishState = result.publishState;
    // Keep V1 compat field in sync
    channelUpdate.publishStatus = publishStateToV1Status(result.publishState);
  }
  if (result.externalListingId !== undefined) {
    channelUpdate.externalListingId = result.externalListingId;
  }
  if (result.lastPublishedAt) channelUpdate.lastPublishedAt = result.lastPublishedAt;
  if (result.lastUnpublishedAt) channelUpdate.lastUnpublishedAt = result.lastUnpublishedAt;

  await prisma.listingChannel.update({
    where: { id: channelId },
    data: channelUpdate,
  });
}

function publishStateToV1Status(state: ChannelPublishState): ChannelPublishStatus {
  switch (state) {
    case ChannelPublishState.PUBLISHED:
      return ChannelPublishStatus.LIVE;
    case ChannelPublishState.PAUSED:
      return ChannelPublishStatus.PAUSED;
    case ChannelPublishState.SYNC_ERROR:
      return ChannelPublishStatus.ERROR;
    case ChannelPublishState.QUEUED:
      return ChannelPublishStatus.PENDING;
    default:
      return ChannelPublishStatus.NOT_CONNECTED;
  }
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export async function publishListingToChannel(
  ctx: OrgContext,
  listingChannelId: string,
) {
  const channel = await getChannel(ctx.organizationId, listingChannelId);
  const adapter = getAdapter(channel.channelType);

  await logActivity({
    ctx,
    verb: ActivityVerbs.LISTING_CHANNEL_PUBLISH_REQUESTED,
    entityType: "ListingChannel",
    entityId: channel.id,
    metadata: {
      listingId: channel.listingId,
      channelType: channel.channelType,
    },
  });

  const syncRun = await startSyncRun(
    channel.id,
    ChannelSyncOperation.PUBLISH,
    { listingId: channel.listingId, channelType: channel.channelType },
    ctx.userId,
  );

  // Set channel to QUEUED while running
  await prisma.listingChannel.update({
    where: { id: channel.id },
    data: { publishState: ChannelPublishState.QUEUED },
  });

  const input: PublishListingInput = {
    organizationId: ctx.organizationId,
    organizationSlug: channel.listing.organization.slug,
    listingChannelId: channel.id,
    listingId: channel.listingId,
    channelType: channel.channelType,
    listing: {
      title: channel.listing.title,
      description: channel.listing.description,
      monthlyRent: channel.listing.monthlyRent.toString(),
      bedrooms: channel.listing.bedrooms ?? null,
      bathrooms: channel.listing.bathrooms ?? null,
      availableFrom: channel.listing.availableFrom,
      petPolicy: channel.listing.petPolicy,
      amenities: channel.listing.amenities,
      publicSlug: channel.listing.publicSlug,
    },
    metadata: channel.metadata as Record<string, unknown>,
    requestedByUserId: ctx.userId,
  };

  const result = await adapter.publishListing(input);

  if (result.success) {
    await completeSyncRun(syncRun.id, channel.id, {
      status: ChannelSyncStatus.SUCCEEDED,
      resultPayload: result.data as unknown as Record<string, unknown>,
      publishState: result.data.publishState,
      externalListingId: result.data.externalListingId,
      lastSyncError: null,
      lastPublishedAt: new Date(),
    });

    // If listing status is DRAFT, promote it to ACTIVE
    if (channel.listing.status === "DRAFT") {
      await prisma.listing.update({
        where: { id: channel.listingId },
        data: { status: "ACTIVE", publishedAt: new Date() },
      });
    }

    await logActivity({
      ctx,
      verb: ActivityVerbs.LISTING_CHANNEL_PUBLISHED,
      entityType: "ListingChannel",
      entityId: channel.id,
      metadata: {
        listingId: channel.listingId,
        channelType: channel.channelType,
        externalListingId: result.data.externalListingId,
      },
    });
  } else {
    await completeSyncRun(syncRun.id, channel.id, {
      status: ChannelSyncStatus.FAILED,
      errorMessage: result.error,
      publishState: ChannelPublishState.SYNC_ERROR,
      lastSyncError: result.error,
    });

    await logActivity({
      ctx,
      verb: ActivityVerbs.LISTING_CHANNEL_PUBLISH_FAILED,
      entityType: "ListingChannel",
      entityId: channel.id,
      metadata: {
        listingId: channel.listingId,
        channelType: channel.channelType,
        error: result.error,
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

export async function pauseListingChannel(ctx: OrgContext, listingChannelId: string) {
  const channel = await getChannel(ctx.organizationId, listingChannelId);

  await prisma.listingChannel.update({
    where: { id: channel.id },
    data: {
      publishState: ChannelPublishState.PAUSED,
      publishStatus: ChannelPublishStatus.PAUSED,
    },
  });

  const syncRun = await startSyncRun(
    channel.id,
    ChannelSyncOperation.UNPUBLISH,
    { reason: "paused" },
    ctx.userId,
  );

  await prisma.listingChannelSync.update({
    where: { id: syncRun.id },
    data: { status: ChannelSyncStatus.SUCCEEDED, completedAt: new Date() },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LISTING_CHANNEL_PAUSED,
    entityType: "ListingChannel",
    entityId: channel.id,
    metadata: { listingId: channel.listingId, channelType: channel.channelType },
  });

  return channel;
}

// ---------------------------------------------------------------------------
// Unpublish
// ---------------------------------------------------------------------------

export async function unpublishListingChannel(ctx: OrgContext, listingChannelId: string) {
  const channel = await getChannel(ctx.organizationId, listingChannelId);
  const adapter = getAdapter(channel.channelType);

  const syncRun = await startSyncRun(
    channel.id,
    ChannelSyncOperation.UNPUBLISH,
    { listingId: channel.listingId },
    ctx.userId,
  );

  const result = await adapter.unpublishListing({
    organizationId: ctx.organizationId,
    listingChannelId: channel.id,
    listingId: channel.listingId,
    channelType: channel.channelType,
    externalListingId: channel.externalListingId,
    requestedByUserId: ctx.userId,
  });

  if (result.success) {
    await completeSyncRun(syncRun.id, channel.id, {
      status: ChannelSyncStatus.SUCCEEDED,
      publishState: ChannelPublishState.UNPUBLISHED,
      lastSyncError: null,
      lastUnpublishedAt: new Date(),
    });

    await logActivity({
      ctx,
      verb: ActivityVerbs.LISTING_CHANNEL_UNPUBLISHED,
      entityType: "ListingChannel",
      entityId: channel.id,
      metadata: { listingId: channel.listingId, channelType: channel.channelType },
    });
  } else {
    await completeSyncRun(syncRun.id, channel.id, {
      status: ChannelSyncStatus.FAILED,
      errorMessage: result.error,
      publishState: ChannelPublishState.SYNC_ERROR,
      lastSyncError: result.error,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Retry sync
// ---------------------------------------------------------------------------

export async function retryListingChannelSync(ctx: OrgContext, listingChannelId: string) {
  await logActivity({
    ctx,
    verb: ActivityVerbs.LISTING_CHANNEL_RETRY_REQUESTED,
    entityType: "ListingChannel",
    entityId: listingChannelId,
    metadata: { listingChannelId },
  });

  // Reset error state before retrying
  await prisma.listingChannel.update({
    where: { id: listingChannelId },
    data: { publishState: ChannelPublishState.DRAFT, lastSyncError: null },
  });

  return publishListingToChannel(ctx, listingChannelId);
}
