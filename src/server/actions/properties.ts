"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import {
  createProperty,
  createUnit,
  deleteProperty,
  updateProperty,
  updateUnit,
} from "@/server/services/properties/property.service";
import {
  createPropertySchema,
  createUnitSchema,
  deletePropertySchema,
  updatePropertySchema,
  updateUnitSchema,
} from "@/server/validation/property";

export async function createPropertyAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_CREATE);
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
    await requirePermission(ctx, Permission.UNITS_CREATE);
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

export async function updatePropertyAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_EDIT);
    let showingSchedule: Record<string, unknown> | undefined = undefined;
    const showingScheduleRaw = String(formData.get("showingScheduleJson") ?? "").trim();
    if (showingScheduleRaw) {
      showingSchedule = JSON.parse(showingScheduleRaw) as Record<string, unknown>;
    }
    const input = updatePropertySchema.parse({
      id: formData.get("id"),
      name: formData.get("name"),
      street: formData.get("street"),
      city: formData.get("city"),
      state: formData.get("state"),
      postalCode: formData.get("postalCode"),
      country: formData.get("country") || "US",
      status: formData.get("status"),
      showingSchedule,
    });
    await updateProperty(ctx, input);
    revalidatePath(`/properties/${input.id}`);
    revalidatePath("/properties");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update property";
    return { ok: false as const, message };
  }
}

export async function deletePropertyAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_DELETE);
    const input = deletePropertySchema.parse({
      id: formData.get("id"),
    });
    await deleteProperty(ctx, input.id);
    revalidatePath("/properties");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete property";
    return { ok: false as const, message };
  }
}

export async function updateUnitAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.UNITS_EDIT);
    const toNumberOrNull = (value: FormDataEntryValue | null) => {
      if (value == null) return null;
      const text = String(value).trim();
      if (!text) return null;
      return Number(text);
    };
    const input = updateUnitSchema.parse({
      id: formData.get("id"),
      propertyId: formData.get("propertyId"),
      unitNumber: formData.get("unitNumber"),
      beds: toNumberOrNull(formData.get("beds")),
      baths: toNumberOrNull(formData.get("baths")),
      sqft: toNumberOrNull(formData.get("sqft")),
      status: formData.get("status"),
    });
    await updateUnit(ctx, input);
    revalidatePath(`/properties/${input.propertyId}`);
    revalidatePath("/properties");
    revalidatePath("/units");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update unit";
    return { ok: false as const, message };
  }
}
