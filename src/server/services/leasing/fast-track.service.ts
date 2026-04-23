import { ApplicationStatus, Prisma } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { createLeaseDirectFromLead } from "@/server/services/leases/lease.service";
import type { FastTrackLeaseInput } from "@/server/validation/lease";

type ResidentIdentityInput = {
  residentId?: string | null;
  residentFirstName?: string;
  residentLastName?: string;
  residentEmail?: string | null;
  residentPhone?: string | null;
};

async function findOrCreateResident(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  lead: { firstName: string; lastName: string; email: string | null; phone: string | null },
  input: ResidentIdentityInput,
) {
  if (input.residentId) {
    const resident = await tx.resident.findFirst({
      where: { id: input.residentId, organizationId: ctx.organizationId },
    });
    if (!resident) throw new Error("Resident not found");
    return { resident, created: false as const };
  }

  const candidateEmail = (input.residentEmail ?? lead.email ?? "").trim().toLowerCase();
  if (candidateEmail) {
    const existingByEmail = await tx.resident.findFirst({
      where: {
        organizationId: ctx.organizationId,
        email: { equals: candidateEmail, mode: "insensitive" },
      },
      orderBy: { createdAt: "asc" },
    });
    if (existingByEmail) return { resident: existingByEmail, created: false as const };
  }

  const firstName = (input.residentFirstName ?? lead.firstName).trim();
  const lastName = (input.residentLastName ?? lead.lastName).trim();
  if (!firstName || !lastName) throw new Error("Resident name is required");

  const resident = await tx.resident.create({
    data: {
      organizationId: ctx.organizationId,
      firstName,
      lastName,
      email: candidateEmail || null,
      phone: (input.residentPhone ?? lead.phone ?? "").trim() || null,
    },
  });

  return { resident, created: true as const };
}

export async function fastTrackLeaseFromLead(ctx: OrgContext, input: FastTrackLeaseInput) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });
  if (!lead) throw new Error("Lead not found");

  let residentCreated = false;
  let approvedApplicationId: string | null = null;

  const lease = await prisma.$transaction(async (tx) => {
    const applicationId = input.applicationId ?? null;
    if (applicationId) {
      const app = await tx.application.findFirst({
        where: { id: applicationId, leadId: lead.id, lead: { organizationId: ctx.organizationId } },
      });
      if (!app) throw new Error("Application not found");
      if (app.status !== ApplicationStatus.APPROVED) {
        await tx.application.update({
          where: { id: app.id },
          data: { status: ApplicationStatus.APPROVED },
        });
        approvedApplicationId = app.id;
      }
    }

    const { resident, created } = await findOrCreateResident(tx, ctx, lead, input);
    residentCreated = created;

    return createLeaseDirectFromLead(
      ctx,
      {
        leadId: lead.id,
        applicationId,
        residentId: resident.id,
        unitId: input.unitId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        rentAmount: input.rentAmount,
        depositAmount: input.depositAmount,
      },
      tx,
    );
  });

  await recordActivity({
    ctx,
    verb: "lease.fast_tracked",
    entityType: "Lease",
    entityId: lease.id,
    metadata: {
      leadId: input.leadId,
      applicationId: input.applicationId ?? null,
      residentCreated,
    },
  });

  if (approvedApplicationId) {
    await recordActivity({
      ctx,
      verb: "application.status_changed",
      entityType: "Application",
      entityId: approvedApplicationId,
      payloadAfter: { status: ApplicationStatus.APPROVED },
      metadata: { reason: "fast_track_lease" },
    });
  }

  return lease;
}
