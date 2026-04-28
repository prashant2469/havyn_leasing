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

function toNumOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toStrOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

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
      latitude: toNumOrNull(formData.get("latitude")),
      longitude: toNumOrNull(formData.get("longitude")),
      parkingType: toStrOrNull(formData.get("parkingType")),
      parkingSpaces: toNumOrNull(formData.get("parkingSpaces")),
      laundryType: toStrOrNull(formData.get("laundryType")),
      yearBuilt: toNumOrNull(formData.get("yearBuilt")),
      propertyType: toStrOrNull(formData.get("propertyType")),
      neighborhood: toStrOrNull(formData.get("neighborhood")),
      transitNotes: toStrOrNull(formData.get("transitNotes")),
      schoolDistrict: toStrOrNull(formData.get("schoolDistrict")),
      utilityNotes: toStrOrNull(formData.get("utilityNotes")),
      amenities: String(formData.get("amenitiesCsv") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      petRules: {
        dogs: String(formData.get("petDogsAllowed") ?? "") === "true",
        cats: String(formData.get("petCatsAllowed") ?? "") === "true",
        maxWeight: toNumOrNull(formData.get("petMaxWeight")),
        deposit: toNumOrNull(formData.get("petDeposit")),
        monthlyFee: toNumOrNull(formData.get("petMonthlyFee")),
      },
      leaseTerms: {
        minMonths: toNumOrNull(formData.get("leaseMinMonths")),
        maxMonths: toNumOrNull(formData.get("leaseMaxMonths")),
        preferredMonths: toNumOrNull(formData.get("leasePreferredMonths")),
      },
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
    const weekdaysSelected = formData
      .getAll("scheduleWeekdays")
      .map((w) => Number(String(w)))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const weekdaysCsv = String(formData.get("scheduleWeekdaysCsv") ?? "").trim();
    const scheduleStart = String(formData.get("scheduleStart") ?? "").trim() || "10:00";
    const scheduleEnd = String(formData.get("scheduleEnd") ?? "").trim() || "16:00";
    const duration = toNumOrNull(formData.get("tourDurationMinutes")) ?? 30;
    const weekdays = (weekdaysSelected.length > 0
      ? weekdaysSelected
      : weekdaysCsv
      .split(",")
      .map((w) => Number(w.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6));
    let blackouts: Array<{ start: string; end: string }> = [];
    const blackoutsRaw = String(formData.get("scheduleBlackoutsJson") ?? "").trim();
    if (blackoutsRaw) {
      const parsed = JSON.parse(blackoutsRaw) as Array<{ start: string; end: string }>;
      if (Array.isArray(parsed)) blackouts = parsed;
    }
    const showingSchedule: Record<string, unknown> = {
      weekdayWindows: [
        {
          weekdays: weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5],
          start: scheduleStart,
          end: scheduleEnd,
        },
      ],
      tourDurationMinutes: duration,
      blackouts,
    };
    const input = updatePropertySchema.parse({
      id: formData.get("id"),
      name: formData.get("name"),
      street: formData.get("street"),
      city: formData.get("city"),
      state: formData.get("state"),
      postalCode: formData.get("postalCode"),
      country: formData.get("country") || "US",
      status: formData.get("status"),
      latitude: toNumOrNull(formData.get("latitude")),
      longitude: toNumOrNull(formData.get("longitude")),
      parkingType: toStrOrNull(formData.get("parkingType")),
      parkingSpaces: toNumOrNull(formData.get("parkingSpaces")),
      laundryType: toStrOrNull(formData.get("laundryType")),
      yearBuilt: toNumOrNull(formData.get("yearBuilt")),
      propertyType: toStrOrNull(formData.get("propertyType")),
      neighborhood: toStrOrNull(formData.get("neighborhood")),
      transitNotes: toStrOrNull(formData.get("transitNotes")),
      schoolDistrict: toStrOrNull(formData.get("schoolDistrict")),
      utilityNotes: toStrOrNull(formData.get("utilityNotes")),
      amenities: String(formData.get("amenitiesCsv") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      petRules: {
        dogs: String(formData.get("petDogsAllowed") ?? "") === "true",
        cats: String(formData.get("petCatsAllowed") ?? "") === "true",
        maxWeight: toNumOrNull(formData.get("petMaxWeight")),
        deposit: toNumOrNull(formData.get("petDeposit")),
        monthlyFee: toNumOrNull(formData.get("petMonthlyFee")),
      },
      leaseTerms: {
        minMonths: toNumOrNull(formData.get("leaseMinMonths")),
        maxMonths: toNumOrNull(formData.get("leaseMaxMonths")),
        preferredMonths: toNumOrNull(formData.get("leasePreferredMonths")),
      },
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
