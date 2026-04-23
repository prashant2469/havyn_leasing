"use server";

import { AIActionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import {
  createPlaceholderAIActions,
  reviewAIAction,
} from "@/server/services/ai/ai-action.service";

export async function createPlaceholderAIActionsAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.AI_MANAGE);
    const leadId = String(formData.get("leadId"));
    await createPlaceholderAIActions(ctx, leadId);
    revalidatePath("/leasing/inbox");
    revalidatePath(`/leasing/leads/${leadId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create AI placeholders";
    return { ok: false as const, message };
  }
}

export async function reviewAIActionAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.AI_MANAGE);
    const actionId = String(formData.get("actionId"));
    const leadId = String(formData.get("leadId"));
    const decision = String(formData.get("decision")) as AIActionStatus;
    if (
      decision !== AIActionStatus.APPROVED &&
      decision !== AIActionStatus.REJECTED &&
      decision !== AIActionStatus.DISMISSED
    ) {
      throw new Error("Invalid decision");
    }
    await reviewAIAction(ctx, actionId, decision);
    revalidatePath("/leasing/inbox");
    revalidatePath(`/leasing/leads/${leadId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to review AI action";
    return { ok: false as const, message };
  }
}
