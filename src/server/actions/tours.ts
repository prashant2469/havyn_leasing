"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { prisma } from "@/server/db/client";
import { createTour, updateTourStatus } from "@/server/services/leasing/tour.service";
import { createTourSchema, updateTourStatusSchema } from "@/server/validation/tour";

async function tourLeadId(organizationId: string, tourId: string) {
  const tour = await prisma.tour.findFirst({
    where: { id: tourId, lead: { organizationId } },
    select: { leadId: true },
  });
  if (!tour) throw new Error("Tour not found");
  return tour.leadId;
}

export async function createTourAction(_prev: unknown, formData: FormData) {
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
    revalidatePath(`/leasing/leads/${input.leadId}`);
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/leads");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to schedule tour";
    return { ok: false as const, message };
  }
}

export async function updateTourStatusAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.TOURS_MANAGE);
    const raw = {
      tourId: formData.get("tourId"),
      status: formData.get("status"),
      notes: formData.get("notes") || undefined,
    };
    const input = updateTourStatusSchema.parse(raw);
    const leadId = await tourLeadId(ctx.organizationId, input.tourId);
    await updateTourStatus(ctx, input);
    revalidatePath(`/leasing/leads/${leadId}`);
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/leads");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update tour";
    return { ok: false as const, message };
  }
}
