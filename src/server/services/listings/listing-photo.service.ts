import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { deleteS3Object, getS3PublicUrl } from "@/lib/s3";

type CreateListingPhotoInput = {
  listingId: string;
  storageKey: string;
  caption?: string | null;
};

async function assertListingInOrg(ctx: OrgContext, listingId: string) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!listing) throw new Error("Listing not found.");
  return listing;
}

export async function createListingPhoto(ctx: OrgContext, input: CreateListingPhotoInput) {
  await assertListingInOrg(ctx, input.listingId);
  const maxSort = await prisma.listingPhoto.aggregate({
    where: { listingId: input.listingId },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const photo = await prisma.listingPhoto.create({
    data: {
      listingId: input.listingId,
      storageKey: input.storageKey,
      caption: input.caption ?? null,
      sortOrder: nextSortOrder,
      url: getS3PublicUrl(input.storageKey),
    },
  });

  const primaryExists = await prisma.listingPhoto.count({
    where: { listingId: input.listingId, isPrimary: true },
  });
  if (primaryExists === 0) {
    await prisma.listingPhoto.update({
      where: { id: photo.id },
      data: { isPrimary: true },
    });
  }

  return photo;
}

export async function deleteListingPhoto(ctx: OrgContext, photoId: string) {
  const photo = await prisma.listingPhoto.findFirst({
    where: {
      id: photoId,
      listing: { organizationId: ctx.organizationId },
    },
    select: { id: true, storageKey: true, listingId: true, isPrimary: true },
  });
  if (!photo) throw new Error("Photo not found.");

  await prisma.listingPhoto.delete({ where: { id: photo.id } });
  await deleteS3Object(photo.storageKey);

  if (photo.isPrimary) {
    const fallback = await prisma.listingPhoto.findFirst({
      where: { listingId: photo.listingId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (fallback) {
      await prisma.listingPhoto.update({
        where: { id: fallback.id },
        data: { isPrimary: true },
      });
    }
  }
}

export async function reorderListingPhotos(
  ctx: OrgContext,
  listingId: string,
  orderedPhotoIds: string[],
) {
  await assertListingInOrg(ctx, listingId);
  const existing = await prisma.listingPhoto.findMany({
    where: { listingId },
    select: { id: true },
  });
  const existingSet = new Set(existing.map((photo) => photo.id));
  if (orderedPhotoIds.some((id) => !existingSet.has(id))) {
    throw new Error("One or more photos do not belong to the listing.");
  }
  await prisma.$transaction(
    orderedPhotoIds.map((photoId, index) =>
      prisma.listingPhoto.update({
        where: { id: photoId },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function setPrimaryListingPhoto(ctx: OrgContext, photoId: string) {
  const photo = await prisma.listingPhoto.findFirst({
    where: {
      id: photoId,
      listing: { organizationId: ctx.organizationId },
    },
    select: { id: true, listingId: true },
  });
  if (!photo) throw new Error("Photo not found.");

  await prisma.$transaction([
    prisma.listingPhoto.updateMany({
      where: { listingId: photo.listingId },
      data: { isPrimary: false },
    }),
    prisma.listingPhoto.update({
      where: { id: photo.id },
      data: { isPrimary: true },
    }),
  ]);
}

export async function updateListingPhotoCaption(
  ctx: OrgContext,
  photoId: string,
  caption: string | null,
) {
  const photo = await prisma.listingPhoto.findFirst({
    where: { id: photoId, listing: { organizationId: ctx.organizationId } },
    select: { id: true },
  });
  if (!photo) throw new Error("Photo not found.");

  return prisma.listingPhoto.update({
    where: { id: photo.id },
    data: { caption },
  });
}
