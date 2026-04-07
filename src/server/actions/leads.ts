"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import {
  createLead,
  updateLeadInboxStage,
  updateLeadStatus,
} from "@/server/services/leasing/lead.service";
import {
  createLeadSchema,
  updateLeadInboxStageSchema,
  updateLeadStatusSchema,
} from "@/server/validation/lead";

export async function createLeadAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email") || undefined,
      phone: formData.get("phone") || undefined,
      source: formData.get("source") || undefined,
      propertyId: String(formData.get("propertyId") ?? "").trim() || undefined,
      primaryUnitId: String(formData.get("primaryUnitId") ?? "").trim() || undefined,
      listingId: String(formData.get("listingId") ?? "").trim() || undefined,
    };
    const input = createLeadSchema.parse(raw);
    const lead = await createLead(ctx, input);
    revalidatePath("/leasing/leads");
    revalidatePath("/leasing/inbox");
    revalidatePath("/");
    return { ok: true as const, leadId: lead.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create lead";
    return { ok: false as const, message };
  }
}

export async function updateLeadStatusAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      leadId: formData.get("leadId"),
      status: formData.get("status"),
      nextActionAt: formData.get("nextActionAt") || undefined,
      nextActionType: formData.get("nextActionType") || undefined,
    };
    const input = updateLeadStatusSchema.parse({
      ...raw,
      nextActionAt: raw.nextActionAt === "" ? null : raw.nextActionAt,
      nextActionType: raw.nextActionType === "" ? null : raw.nextActionType,
    });
    await updateLeadStatus(ctx, input);
    revalidatePath("/leasing/leads");
    revalidatePath("/leasing/inbox");
    revalidatePath(`/leasing/leads/${input.leadId}`);
    revalidatePath("/");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update lead";
    return { ok: false as const, message };
  }
}

export async function updateLeadInboxStageAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = updateLeadInboxStageSchema.parse({
      leadId: formData.get("leadId"),
      inboxStage: formData.get("inboxStage"),
    });
    await updateLeadInboxStage(ctx, input);
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/leads");
    revalidatePath(`/leasing/leads/${input.leadId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to move lead";
    return { ok: false as const, message };
  }
}
