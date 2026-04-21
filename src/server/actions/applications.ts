"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import {
  createApplication,
  mergeApplicationPipelineFields,
  updateApplicationStatus,
} from "@/server/services/leasing/application.service";
import {
  createApplicationSchema,
  parseApplicationIntakeFromFormData,
  updateApplicationPipelineSchema,
  updateApplicationStatusSchema,
} from "@/server/validation/application";

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
      payload: parseApplicationIntakeFromFormData(formData),
    };
    const input = createApplicationSchema.parse(raw);
    await createApplication(ctx, input);
    revalidatePath(`/leasing/leads/${input.leadId}`);
    revalidatePath("/leasing/leads");
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/applications");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create application";
    return { ok: false as const, message };
  }
}

export async function updateApplicationPipelineAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      applicationId: formData.get("applicationId"),
      waitingOn: formData.get("waitingOn") ?? undefined,
      pipelineNote: formData.get("pipelineNote") ?? undefined,
    };
    const input = updateApplicationPipelineSchema.parse(raw);
    const app = await mergeApplicationPipelineFields(ctx, input);
    const leadId = await applicationLeadId(ctx.organizationId, app.id);
    revalidatePath(`/leasing/leads/${leadId}`);
    revalidatePath("/leasing/applications");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update pipeline";
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
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/applications");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update application";
    return { ok: false as const, message };
  }
}
