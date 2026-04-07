"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import {
  createApplication,
  updateApplicationStatus,
} from "@/server/services/leasing/application.service";
import { createApplicationSchema, updateApplicationStatusSchema } from "@/server/validation/application";

async function applicationLeadId(organizationId: string, applicationId: string) {
  const row = await prisma.application.findFirst({
    where: { id: applicationId, lead: { organizationId } },
    select: { leadId: true },
  });
  if (!row) throw new Error("Application not found");
  return row.leadId;
}

export async function createApplicationAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      leadId: formData.get("leadId"),
    };
    const input = createApplicationSchema.parse({ ...raw, payload: {} });
    await createApplication(ctx, input);
    revalidatePath(`/leasing/leads/${input.leadId}`);
    revalidatePath("/leasing/leads");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create application";
    return { ok: false as const, message };
  }
}

export async function updateApplicationStatusAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      applicationId: formData.get("applicationId"),
      status: formData.get("status"),
    };
    const input = updateApplicationStatusSchema.parse(raw);
    const leadId = await applicationLeadId(ctx.organizationId, input.applicationId);
    await updateApplicationStatus(ctx, input);
    revalidatePath(`/leasing/leads/${leadId}`);
    revalidatePath("/leasing/leads");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update application";
    return { ok: false as const, message };
  }
}
