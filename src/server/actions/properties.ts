"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { createProperty, createUnit } from "@/server/services/properties/property.service";
import { createPropertySchema, createUnitSchema } from "@/server/validation/property";

export async function createPropertyAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      name: formData.get("name"),
      street: formData.get("street"),
      city: formData.get("city"),
      state: formData.get("state"),
      postalCode: formData.get("postalCode"),
      country: formData.get("country") || "US",
    };
    const input = createPropertySchema.parse(raw);
    await createProperty(ctx, input);
    revalidatePath("/properties");
    revalidatePath("/");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create property";
    return { ok: false as const, message };
  }
}

export async function createUnitAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      propertyId: formData.get("propertyId"),
      unitNumber: formData.get("unitNumber"),
      beds: formData.get("beds") ? Number(formData.get("beds")) : undefined,
      baths: formData.get("baths") ? Number(formData.get("baths")) : undefined,
      sqft: formData.get("sqft") ? Number(formData.get("sqft")) : undefined,
    };
    const input = createUnitSchema.parse(raw);
    await createUnit(ctx, input);
    revalidatePath(`/properties/${input.propertyId}`);
    revalidatePath("/properties");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create unit";
    return { ok: false as const, message };
  }
}
