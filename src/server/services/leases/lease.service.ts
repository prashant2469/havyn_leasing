import { LeadInboxStage, LeadStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type { CreateLeaseFromApplicationInput } from "@/server/validation/lease";

type LeaseWriteClient = Prisma.TransactionClient | typeof prisma;

export type CreateLeaseDirectFromLeadInput = {
  leadId: string;
  unitId: string;
  residentId: string;
  applicationId?: string | null;
  startDate: Date;
  endDate?: Date | null;
  status: "DRAFT" | "PENDING" | "ACTIVE" | "ENDED";
  rentAmount: number;
  depositAmount?: number | null;
};

export async function listLeases(ctx: OrgContext) {
  return prisma.lease.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      unit: { include: { property: { select: { id: true, name: true } } } },
      resident: true,
      application: { select: { id: true, status: true } },
    },
  });
}

export async function getLeaseById(ctx: OrgContext, leaseId: string) {
  return prisma.lease.findFirst({
    where: { id: leaseId, organizationId: ctx.organizationId },
    include: {
      unit: { include: { property: true } },
      resident: true,
      application: true,
    },
  });
}

export async function createLeaseFromApplication(ctx: OrgContext, input: CreateLeaseFromApplicationInput) {
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, lead: { organizationId: ctx.organizationId } },
    include: { lead: true },
  });
  if (!application) throw new Error("Application not found");

  const unit = await prisma.unit.findFirst({
    where: {
      id: input.unitId,
      property: { organizationId: ctx.organizationId },
    },
  });
  if (!unit) throw new Error("Unit not found");

  const resident = await prisma.resident.findFirst({
    where: { id: input.residentId, organizationId: ctx.organizationId },
  });
  if (!resident) throw new Error("Resident not found");

  const lease = await prisma.lease.create({
    data: {
      organizationId: ctx.organizationId,
      unitId: input.unitId,
      residentId: input.residentId,
      applicationId: application.id,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      status: input.status,
      rentAmount: new Decimal(input.rentAmount),
      depositAmount: input.depositAmount != null ? new Decimal(input.depositAmount) : null,
    },
  });

  await prisma.lead.update({
    where: { id: application.leadId },
    data: {
      status: LeadStatus.CONVERTED,
      inboxStage: LeadInboxStage.APPLICATION_STARTED,
      nextActionAt: null,
      nextActionType: null,
    },
  });

  await recordActivity({
    ctx,
    verb: "lease.created",
    entityType: "Lease",
    entityId: lease.id,
    metadata: { applicationId: application.id, unitId: unit.id, residentId: resident.id },
  });

  return lease;
}

export async function createLeaseDirectFromLead(
  ctx: OrgContext,
  input: CreateLeaseDirectFromLeadInput,
  tx?: Prisma.TransactionClient,
) {
  const db: LeaseWriteClient = tx ?? prisma;
  const lead = await db.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const unit = await db.unit.findFirst({
    where: { id: input.unitId, property: { organizationId: ctx.organizationId } },
  });
  if (!unit) throw new Error("Unit not found");

  const resident = await db.resident.findFirst({
    where: { id: input.residentId, organizationId: ctx.organizationId },
  });
  if (!resident) throw new Error("Resident not found");

  if (input.applicationId) {
    const app = await db.application.findFirst({
      where: {
        id: input.applicationId,
        leadId: input.leadId,
        lead: { organizationId: ctx.organizationId },
      },
      select: { id: true },
    });
    if (!app) throw new Error("Application not found for this lead");
  }

  const lease = await db.lease.create({
    data: {
      organizationId: ctx.organizationId,
      unitId: input.unitId,
      residentId: input.residentId,
      applicationId: input.applicationId ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      status: input.status,
      rentAmount: new Decimal(input.rentAmount),
      depositAmount: input.depositAmount != null ? new Decimal(input.depositAmount) : null,
    },
  });

  await db.lead.update({
    where: { id: input.leadId },
    data: {
      status: LeadStatus.CONVERTED,
      inboxStage: LeadInboxStage.APPLICATION_STARTED,
      nextActionAt: null,
      nextActionType: null,
    },
  });

  if (!tx) {
    await recordActivity({
      ctx,
      verb: "lease.created",
      entityType: "Lease",
      entityId: lease.id,
      metadata: {
        leadId: input.leadId,
        applicationId: input.applicationId ?? null,
        unitId: unit.id,
        residentId: resident.id,
      },
    });
  }

  return lease;
}
