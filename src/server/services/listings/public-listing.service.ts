import {
  ChannelPublishState,
  ListingChannelType,
  ListingStatus,
} from "@prisma/client";

import { prisma } from "@/server/db/client";

/**
 * Published, bookable listing for the public microsite (no auth).
 * Requires ACTIVE status, a public slug, and WEBSITE channel in PUBLISHED state.
 */
export async function getPublishedPublicListing(orgSlug: string, listingSlug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!org) return null;

  return prisma.listing.findFirst({
    where: {
      organizationId: org.id,
      publicSlug: listingSlug,
      status: ListingStatus.ACTIVE,
      channels: {
        some: {
          channelType: ListingChannelType.WEBSITE,
          publishState: ChannelPublishState.PUBLISHED,
        },
      },
    },
    include: {
      organization: { select: { name: true, slug: true } },
      unit: { include: { property: true } },
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });
}
