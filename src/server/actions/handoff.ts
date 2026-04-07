"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { recordHumanHandoff } from "@/server/services/leasing/handoff.service";

export async function requestHumanHandoffAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const leadId = String(formData.get("leadId"));
    const reason = String(formData.get("reason") ?? "").trim() || null;
    const toUserIdRaw = String(formData.get("toUserId") ?? "").trim();
    await recordHumanHandoff(ctx, {
      leadId,
      reason,
      toUserId: toUserIdRaw || null,
    });
    revalidatePath("/leasing/inbox");
    revalidatePath(`/leasing/leads/${leadId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Handoff failed";
    return { ok: false as const, message };
  }
}
