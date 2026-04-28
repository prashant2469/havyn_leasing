"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import {
  createPropertyFact,
  deletePropertyFact,
  importStructuredPropertyFacts,
  seedDefaultPropertyFacts,
  updatePropertyFact,
} from "@/server/services/properties/property-fact.service";
import {
  createPropertyFactSchema,
  deletePropertyFactSchema,
  importStructuredPropertyFactsSchema,
  seedPropertyFactsSchema,
  updatePropertyFactSchema,
} from "@/server/validation/property-fact";

function parseBool(v: FormDataEntryValue | null, fallback = false): boolean {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on" || s === "yes";
}

function parseIntOrUndefined(v: FormDataEntryValue | null): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) ? n : undefined;
}

function revalidatePropertyPaths(propertyId: string) {
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
}

export async function createPropertyFactAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_EDIT);
    const input = createPropertyFactSchema.parse({
      propertyId: formData.get("propertyId"),
      unitId: String(formData.get("unitId") ?? "").trim() || null,
      category: formData.get("category"),
      question: formData.get("question"),
      answer: formData.get("answer"),
      isPublic: parseBool(formData.get("isPublic"), true),
      sortOrder: parseIntOrUndefined(formData.get("sortOrder")) ?? 0,
    });
    await createPropertyFact(ctx, input);
    revalidatePropertyPaths(input.propertyId);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create property fact";
    return { ok: false as const, message };
  }
}

export async function updatePropertyFactAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_EDIT);
    const input = updatePropertyFactSchema.parse({
      id: formData.get("id"),
      propertyId: formData.get("propertyId"),
      unitId: String(formData.get("unitId") ?? "").trim() || null,
      category: formData.get("category") || undefined,
      question: formData.get("question") || undefined,
      answer: formData.get("answer") || undefined,
      isPublic: formData.has("isPublic") ? parseBool(formData.get("isPublic")) : undefined,
      sortOrder: parseIntOrUndefined(formData.get("sortOrder")),
    });
    await updatePropertyFact(ctx, input);
    revalidatePropertyPaths(input.propertyId);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update property fact";
    return { ok: false as const, message };
  }
}

export async function deletePropertyFactAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_EDIT);
    const input = deletePropertyFactSchema.parse({
      id: formData.get("id"),
      propertyId: formData.get("propertyId"),
    });
    await deletePropertyFact(ctx, input);
    revalidatePropertyPaths(input.propertyId);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete property fact";
    return { ok: false as const, message };
  }
}

export async function seedPropertyFactsAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_EDIT);
    const input = seedPropertyFactsSchema.parse({
      propertyId: formData.get("propertyId"),
      overwriteEmptyAnswers: parseBool(formData.get("overwriteEmptyAnswers"), false),
    });
    const result = await seedDefaultPropertyFacts(ctx, input.propertyId, {
      overwriteEmptyAnswers: input.overwriteEmptyAnswers,
    });
    revalidatePropertyPaths(input.propertyId);
    return {
      ok: true as const,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to seed property facts";
    return { ok: false as const, message };
  }
}

export async function importStructuredPropertyFactsAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PROPERTIES_EDIT);
    const input = importStructuredPropertyFactsSchema.parse({
      propertyId: formData.get("propertyId"),
      overwriteExistingQuestions: parseBool(formData.get("overwriteExistingQuestions"), false),
    });
    const result = await importStructuredPropertyFacts(ctx, input.propertyId, {
      overwriteExistingQuestions: input.overwriteExistingQuestions,
    });
    revalidatePropertyPaths(input.propertyId);
    return {
      ok: true as const,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import structured property facts";
    return { ok: false as const, message };
  }
}
