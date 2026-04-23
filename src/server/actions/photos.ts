"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import {
  createListingPhoto,
  deleteListingPhoto,
  reorderListingPhotos,
  setPrimaryListingPhoto,
  updateListingPhotoCaption,
} from "@/server/services/listings/listing-photo.service";

const createListingPhotoSchema = z.object({
  listingId: z.string().cuid(),
  storageKey: z.string().min(1),
  caption: z.string().max(200).optional(),
});

const deleteListingPhotoSchema = z.object({
  photoId: z.string().cuid(),
  listingId: z.string().cuid(),
});

const reorderListingPhotosSchema = z.object({
  listingId: z.string().cuid(),
  photoIds: z.array(z.string().cuid()).min(1),
});

const setPrimaryListingPhotoSchema = z.object({
  photoId: z.string().cuid(),
  listingId: z.string().cuid(),
});

const updatePhotoCaptionSchema = z.object({
  photoId: z.string().cuid(),
  listingId: z.string().cuid(),
  caption: z.string().max(200).nullable(),
});

export async function createListingPhotoAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PHOTOS_UPLOAD);
    const input = createListingPhotoSchema.parse({
      listingId: formData.get("listingId"),
      storageKey: formData.get("storageKey"),
      caption: formData.get("caption") || undefined,
    });
    await createListingPhoto(ctx, input);
    revalidatePath(`/listings/${input.listingId}`);
    revalidatePath("/listings");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save photo";
    return { ok: false as const, message };
  }
}

export async function deleteListingPhotoAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PHOTOS_DELETE);
    const input = deleteListingPhotoSchema.parse({
      photoId: formData.get("photoId"),
      listingId: formData.get("listingId"),
    });
    await deleteListingPhoto(ctx, input.photoId);
    revalidatePath(`/listings/${input.listingId}`);
    revalidatePath("/listings");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete photo";
    return { ok: false as const, message };
  }
}

export async function reorderListingPhotosAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PHOTOS_UPLOAD);
    const payloadRaw = String(formData.get("photoIds") ?? "");
    const input = reorderListingPhotosSchema.parse({
      listingId: formData.get("listingId"),
      photoIds: JSON.parse(payloadRaw) as string[],
    });
    await reorderListingPhotos(ctx, input.listingId, input.photoIds);
    revalidatePath(`/listings/${input.listingId}`);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder photos";
    return { ok: false as const, message };
  }
}

export async function setPrimaryPhotoAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PHOTOS_UPLOAD);
    const input = setPrimaryListingPhotoSchema.parse({
      photoId: formData.get("photoId"),
      listingId: formData.get("listingId"),
    });
    await setPrimaryListingPhoto(ctx, input.photoId);
    revalidatePath(`/listings/${input.listingId}`);
    revalidatePath("/listings");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set primary photo";
    return { ok: false as const, message };
  }
}

export async function updatePhotoCaptionAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PHOTOS_UPLOAD);
    const input = updatePhotoCaptionSchema.parse({
      photoId: formData.get("photoId"),
      listingId: formData.get("listingId"),
      caption: String(formData.get("caption") ?? "").trim() || null,
    });
    await updateListingPhotoCaption(ctx, input.photoId, input.caption);
    revalidatePath(`/listings/${input.listingId}`);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update caption";
    return { ok: false as const, message };
  }
}
