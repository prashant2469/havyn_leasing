"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import {
  attachListingChannel,
  createListing,
  updateListing,
} from "@/server/services/listings/listing.service";
import {
  attachListingChannelSchema,
  createListingSchema,
  updateListingSchema,
} from "@/server/validation/listing";

export async function createListingAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const amenitiesRaw = formData.get("amenities");
    let amenities: string[] | undefined;
    if (typeof amenitiesRaw === "string" && amenitiesRaw.trim()) {
      try {
        amenities = JSON.parse(amenitiesRaw) as string[];
      } catch {
        amenities = amenitiesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    const raw = {
      unitId: formData.get("unitId"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      monthlyRent: formData.get("monthlyRent"),
      availableFrom: formData.get("availableFrom") || undefined,
      bedrooms: formData.get("bedrooms") || undefined,
      bathrooms: formData.get("bathrooms") || undefined,
      amenities,
      petPolicy: formData.get("petPolicy") || undefined,
      status: formData.get("status") || undefined,
    };
    const input = createListingSchema.parse({
      ...raw,
      availableFrom: raw.availableFrom === "" ? null : raw.availableFrom,
      bedrooms: raw.bedrooms === "" ? null : raw.bedrooms,
      bathrooms: raw.bathrooms === "" ? null : raw.bathrooms,
    });
    const listing = await createListing(ctx, input);
    revalidatePath("/listings");
    revalidatePath("/");
    return { ok: true as const, listingId: listing.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create listing";
    return { ok: false as const, message };
  }
}

export async function updateListingAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const amenitiesRaw = formData.get("amenities");
    let amenities: string[] | undefined;
    if (typeof amenitiesRaw === "string" && amenitiesRaw.trim()) {
      try {
        amenities = JSON.parse(amenitiesRaw) as string[];
      } catch {
        amenities = amenitiesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    const raw = {
      id: formData.get("id"),
      unitId: formData.get("unitId") || undefined,
      title: formData.get("title") || undefined,
      description: formData.get("description") || undefined,
      monthlyRent: formData.get("monthlyRent") || undefined,
      availableFrom: formData.get("availableFrom") || undefined,
      bedrooms: formData.get("bedrooms") || undefined,
      bathrooms: formData.get("bathrooms") || undefined,
      amenities,
      petPolicy: formData.get("petPolicy") || undefined,
      status: formData.get("status") || undefined,
    };
    const input = updateListingSchema.parse({
      ...raw,
      availableFrom: raw.availableFrom === "" ? null : raw.availableFrom,
      bedrooms: raw.bedrooms === "" ? null : raw.bedrooms,
      bathrooms: raw.bathrooms === "" ? null : raw.bathrooms,
    });
    await updateListing(ctx, input);
    revalidatePath("/listings");
    revalidatePath(`/listings/${input.id}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update listing";
    return { ok: false as const, message };
  }
}

export async function attachListingChannelAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = attachListingChannelSchema.parse({
      listingId: formData.get("listingId"),
      channelType: formData.get("channelType"),
    });
    await attachListingChannel(ctx, input);
    revalidatePath("/listings");
    revalidatePath(`/listings/${input.listingId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to attach channel";
    return { ok: false as const, message };
  }
}
