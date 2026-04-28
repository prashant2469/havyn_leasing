"use server";

import { RecommendationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import {
  generateRecommendations,
  setRecommendationStatus,
} from "@/server/services/recommendations/recommendation.service";

export async function generateRecommendationsAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.LEADS_MANAGE);
    const leadId = String(formData.get("leadId"));
    await generateRecommendations(ctx, leadId);
    revalidatePath(`/leasing/leads/${leadId}`);
    revalidatePath("/leasing/inbox");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate recommendations";
    return { ok: false as const, message };
  }
}

export async function markRecommendationStatusAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.LEADS_MANAGE);
    const id = String(formData.get("recommendationId"));
    const leadId = String(formData.get("leadId"));
    const status = String(formData.get("status")) as RecommendationStatus;
    if (!Object.values(RecommendationStatus).includes(status)) {
      throw new Error("Invalid recommendation status");
    }
    await setRecommendationStatus(ctx, id, status);
    revalidatePath(`/leasing/leads/${leadId}`);
    revalidatePath("/leasing/inbox");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update recommendation";
    return { ok: false as const, message };
  }
}
