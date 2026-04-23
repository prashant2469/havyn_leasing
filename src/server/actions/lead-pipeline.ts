"use server";

import { ApplicationStatus, LeadInboxStage, LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { prisma } from "@/server/db/client";
import { fastTrackLeaseFromLead } from "@/server/services/leasing/fast-track.service";
import { updateApplicationStatus } from "@/server/services/leasing/application.service";
import { updateLeadInboxStage, updateLeadStatus } from "@/server/services/leasing/lead.service";
import { createTour } from "@/server/services/leasing/tour.service";
import { fastTrackLeaseSchema } from "@/server/validation/lease";
import { createTourSchema } from "@/server/validation/tour";

const markContactedSchema = z.object({
  leadId: z.string().cuid(),
});

const quickApproveSchema = z.object({
  applicationId: z.string().cuid(),
});

function revalidateLeadPages(leadId: string, leaseId?: string) {
  revalidatePath(`/leasing/leads/${leadId}`);
  revalidatePath("/leasing/leads");
  revalidatePath("/leasing/inbox");
  revalidatePath("/leasing/applications");
  revalidatePath("/leases");
  if (leaseId) revalidatePath(`/leases/${leaseId}`);
}

export async function markContactedAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.LEADS_MANAGE);
    const input = markContactedSchema.parse({
      leadId: formData.get("leadId"),
    });

    await updateLeadStatus(ctx, { leadId: input.leadId, status: LeadStatus.CONTACTED });
    await updateLeadInboxStage(ctx, { leadId: input.leadId, inboxStage: LeadInboxStage.AWAITING_RESPONSE });
    revalidateLeadPages(input.leadId);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to mark lead as contacted";
    return { ok: false as const, message };
  }
}

export async function quickScheduleTourAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.TOURS_MANAGE);
    const raw = {
      leadId: formData.get("leadId"),
      listingId: formData.get("listingId") || undefined,
      scheduledAt: formData.get("scheduledAt"),
      notes: formData.get("notes") || undefined,
    };
    const input = createTourSchema.parse({
      ...raw,
      listingId: raw.listingId === "" ? null : raw.listingId,
    });

    await createTour(ctx, input);
    revalidateLeadPages(input.leadId);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to schedule tour";
    return { ok: false as const, message };
  }
}

export async function quickApproveApplicationAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.LEADS_MANAGE);
    const input = quickApproveSchema.parse({
      applicationId: formData.get("applicationId"),
    });

    await updateApplicationStatus(ctx, { applicationId: input.applicationId, status: ApplicationStatus.APPROVED });
    const app = await prisma.application.findFirst({
      where: { id: input.applicationId, lead: { organizationId: ctx.organizationId } },
      select: { leadId: true },
    });
    if (!app) throw new Error("Application not found");

    revalidateLeadPages(app.leadId);
    return { ok: true as const, leadId: app.leadId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to approve application";
    return { ok: false as const, message };
  }
}

export async function fastTrackLeaseAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.LEASES_CREATE);
    await requirePermission(ctx, Permission.LEADS_MANAGE);

    const raw = {
      leadId: formData.get("leadId"),
      applicationId: formData.get("applicationId") || undefined,
      residentId: formData.get("residentId") || undefined,
      residentFirstName: formData.get("residentFirstName") || undefined,
      residentLastName: formData.get("residentLastName") || undefined,
      residentEmail: formData.get("residentEmail") || undefined,
      residentPhone: formData.get("residentPhone") || undefined,
      unitId: formData.get("unitId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate") || undefined,
      rentAmount: formData.get("rentAmount"),
      depositAmount: formData.get("depositAmount") || undefined,
    };
    const input = fastTrackLeaseSchema.parse({
      ...raw,
      applicationId: raw.applicationId === "" ? null : raw.applicationId,
      residentId: raw.residentId === "" ? null : raw.residentId,
      residentEmail: raw.residentEmail === "" ? null : raw.residentEmail,
      residentPhone: raw.residentPhone === "" ? null : raw.residentPhone,
      endDate: raw.endDate === "" ? null : raw.endDate,
      depositAmount: raw.depositAmount === "" ? null : Number(raw.depositAmount),
    });

    const lease = await fastTrackLeaseFromLead(ctx, input);
    revalidateLeadPages(input.leadId, lease.id);
    return { ok: true as const, leaseId: lease.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fast-track lease";
    return { ok: false as const, message };
  }
}
