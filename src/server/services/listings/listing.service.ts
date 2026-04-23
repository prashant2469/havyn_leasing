import { ChannelPublishStatus, ListingChannelType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import type {
  AttachListingChannelInput,
  CreateListingInput,
  UpdateListingInput,
} from "@/server/validation/listing";

async function assertUnitInOrg(ctx: OrgContext, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { organizationId: ctx.organizationId } },
    include: { property: true },
  });
  if (!unit) throw new Error("Unit not found");
  return unit;
}

export async function listListings(ctx: OrgContext) {
  return prisma.listing.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      organization: { select: { slug: true, name: true } },
      unit: { include: { property: { select: { id: true, name: true } } } },
      channels: true,
      photos: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { id: true, url: true, caption: true, sortOrder: true, isPrimary: true },
      },
      _count: { select: { photos: true, leads: true } },
    },
  });
}

export async function getListingById(ctx: OrgContext, id: string) {
  return prisma.listing.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      organization: { select: { slug: true, name: true } },
      unit: { include: { property: true } },
      photos: { orderBy: { sortOrder: "asc" } },
      channels: { include: { syncs: { orderBy: { startedAt: "desc" }, take: 5 } } },
    },
  });
}

export async function createListing(ctx: OrgContext, input: CreateListingInput) {
  await assertUnitInOrg(ctx, input.unitId);

  const listing = await prisma.listing.create({
    data: {
      organizationId: ctx.organizationId,
      unitId: input.unitId,
      title: input.title,
      description: input.description || null,
      monthlyRent: new Decimal(input.monthlyRent),
      availableFrom: input.availableFrom ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      amenities: input.amenities ?? [],
      petPolicy: input.petPolicy || null,
      metadata: input.metadata ?? {},
      status: input.status,
    },
  });

  await prisma.listingChannel.createMany({
    data: [
      {
        listingId: listing.id,
        channelType: ListingChannelType.WEBSITE,
        publishStatus: ChannelPublishStatus.NOT_CONNECTED,
      },
      {
        listingId: listing.id,
        channelType: ListingChannelType.MANUAL,
        publishStatus: ChannelPublishStatus.LIVE,
        metadata: { note: "Inquiries logged manually or from unified inbox" },
      },
    ],
    skipDuplicates: true,
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LISTING_CREATED,
    entityType: "Listing",
    entityId: listing.id,
    payloadAfter: { title: listing.title, unitId: listing.unitId },
  });

  return getListingById(ctx, listing.id) as Promise<NonNullable<Awaited<ReturnType<typeof getListingById>>>>;
}

export async function updateListing(ctx: OrgContext, input: UpdateListingInput) {
  const existing = await prisma.listing.findFirst({
    where: { id: input.id, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Listing not found");

  if (input.unitId) await assertUnitInOrg(ctx, input.unitId);

  if (input.publicSlug !== undefined && input.publicSlug !== null) {
    const clash = await prisma.listing.findFirst({
      where: {
        organizationId: ctx.organizationId,
        publicSlug: input.publicSlug,
        NOT: { id: input.id },
      },
    });
    if (clash) throw new Error("That public slug is already used by another listing in your organization.");
  }

  await prisma.listing.update({
    where: { id: input.id },
    data: {
      ...(input.unitId && { unitId: input.unitId }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description || null }),
      ...(input.monthlyRent !== undefined && { monthlyRent: new Decimal(input.monthlyRent) }),
      ...(input.availableFrom !== undefined && { availableFrom: input.availableFrom }),
      ...(input.bedrooms !== undefined && { bedrooms: input.bedrooms }),
      ...(input.bathrooms !== undefined && { bathrooms: input.bathrooms }),
      ...(input.amenities !== undefined && { amenities: input.amenities }),
      ...(input.petPolicy !== undefined && { petPolicy: input.petPolicy || null }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.publicSlug !== undefined && { publicSlug: input.publicSlug }),
      ...(input.metadata !== undefined && {
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) ?? {}),
          ...input.metadata,
        },
      }),
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LISTING_UPDATED,
    entityType: "Listing",
    entityId: input.id,
    payloadBefore: { title: existing.title },
    payloadAfter: { title: input.title ?? existing.title },
  });

  return getListingById(ctx, input.id);
}

export async function attachListingChannel(ctx: OrgContext, input: AttachListingChannelInput) {
  const listing = await prisma.listing.findFirst({
    where: { id: input.listingId, organizationId: ctx.organizationId },
  });
  if (!listing) throw new Error("Listing not found");

  const row = await prisma.listingChannel.upsert({
    where: {
      listingId_channelType: { listingId: input.listingId, channelType: input.channelType },
    },
    create: {
      listingId: input.listingId,
      channelType: input.channelType,
      publishStatus: ChannelPublishStatus.NOT_CONNECTED,
    },
    update: {},
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LISTING_CHANNEL_ATTACHED,
    entityType: "ListingChannel",
    entityId: row.id,
    metadata: { listingId: listing.id, channelType: input.channelType },
  });

  return row;
}
