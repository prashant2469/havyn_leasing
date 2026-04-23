"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import type { Prisma } from "@prisma/client";

import { upsertQualificationAnswer } from "@/server/services/leasing/qualification.service";

export async function upsertQualificationAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.LEADS_MANAGE);
    const leadId = String(formData.get("leadId"));
    const key = String(formData.get("key"));
    const valueRaw = String(formData.get("value"));
    let value: Prisma.InputJsonValue = valueRaw;
    try {
      value = JSON.parse(valueRaw) as Prisma.InputJsonValue;
    } catch {
      // keep string
    }
    await upsertQualificationAnswer(ctx, { leadId, key, value });
    revalidatePath(`/leasing/leads/${leadId}`);
    revalidatePath("/leasing/inbox");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save";
    return { ok: false as const, message };
  }
}
