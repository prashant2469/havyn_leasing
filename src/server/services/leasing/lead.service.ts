import { type LeadInboxStage, type LeadStatus, NextActionType, TourStatus } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import type {
  CreateLeadInput,
  UpdateLeadInboxStageInput,
  UpdateLeadStatusInput,
} from "@/server/validation/lead";

/** Load listings by id in one query (avoids `include.listing` when Prisma client is out of sync). */
async function listingSummaryMap(
  ctx: OrgContext,
  listingIds: string[],
): Promise<Map<string, { id: string; title: string; status: string }>> {
  const unique = [...new Set(listingIds)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await prisma.listing.findMany({
    where: { organizationId: ctx.organizationId, id: { in: unique } },
    select: { id: true, title: true, status: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export async function listLeads(ctx: OrgContext) {
  const leads = await prisma.lead.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      property: { select: { id: true, name: true } },
      primaryUnit: { select: { id: true, unitNumber: true } },
      tours: {
        where: { status: TourStatus.SCHEDULED },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { id: true, scheduledAt: true, status: true },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
      prioritySignal: {
        select: { priorityTier: true, isAtRisk: true, needsImmediateResponse: true },
      },
      escalationFlags: {
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const map = await listingSummaryMap(
    ctx,
    leads.map((l) => l.listingId).filter((id): id is string => id != null),
  );
  return leads.map((l) => ({
    ...l,
    listing: l.listingId ? (map.get(l.listingId) ?? null) : null,
  }));
}

export async function listLeadsByInboxStage(ctx: OrgContext, stage: LeadInboxStage) {
  const leads = await prisma.lead.findMany({
    where: { organizationId: ctx.organizationId, inboxStage: stage },
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      primaryUnit: { select: { id: true, unitNumber: true } },
      tours: {
        where: { status: TourStatus.SCHEDULED },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { id: true, scheduledAt: true, status: true },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
      prioritySignal: {
        select: { priorityTier: true, isAtRisk: true, needsImmediateResponse: true },
      },
      escalationFlags: {
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const map = await listingSummaryMap(
    ctx,
    leads.map((l) => l.listingId).filter((id): id is string => id != null),
  );
  return leads.map((l) => ({
    ...l,
    listing: l.listingId ? (map.get(l.listingId) ?? null) : null,
  }));
}

/**
 * Load lead + related rows via FKs only (no `include` on Lead relations).
 * Stale Prisma clients sometimes omit relations like `qualifications` or `listing` even when the DB matches schema.
 */
export async function getLeadById(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return null;

  const [
    assignedTo,
    property,
    primaryUnit,
    tours,
    applications,
    qualifications,
    listing,
  ] = await Promise.all([
    lead.assignedToUserId
      ? prisma.user.findFirst({
          where: { id: lead.assignedToUserId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    lead.propertyId
      ? prisma.property.findFirst({
          where: { id: lead.propertyId, organizationId: ctx.organizationId },
        })
      : Promise.resolve(null),
    lead.primaryUnitId
      ? prisma.unit.findFirst({
          where: {
            id: lead.primaryUnitId,
            property: { organizationId: ctx.organizationId },
          },
        })
      : Promise.resolve(null),
    prisma.tour.findMany({
      where: { leadId: lead.id },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.application.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      include: { lease: { select: { id: true, status: true } } },
    }),
    prisma.qualificationAnswer.findMany({
      where: { leadId: lead.id },
      orderBy: { key: "asc" },
    }),
    lead.listingId
      ? prisma.listing.findFirst({
          where: { id: lead.listingId, organizationId: ctx.organizationId },
          include: {
            unit: { include: { property: true } },
            organization: { select: { slug: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    ...lead,
    assignedTo,
    property,
    primaryUnit,
    tours,
    applications,
    qualifications,
    listing,
  };
}

export async function createLead(ctx: OrgContext, input: CreateLeadInput) {
  if (input.propertyId) {
    const p = await prisma.property.findFirst({
      where: { id: input.propertyId, organizationId: ctx.organizationId },
    });
    if (!p) throw new Error("Property not found");
  }
  if (input.primaryUnitId) {
    const u = await prisma.unit.findFirst({
      where: {
        id: input.primaryUnitId,
        property: { organizationId: ctx.organizationId },
      },
    });
    if (!u) throw new Error("Unit not found");
  }
  if (input.listingId) {
    const l = await prisma.listing.findFirst({
      where: { id: input.listingId, organizationId: ctx.organizationId },
    });
    if (!l) throw new Error("Listing not found");
  }

  const lead = await prisma.lead.create({
    data: {
      organizationId: ctx.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source || null,
      propertyId: input.propertyId ?? null,
      primaryUnitId: input.primaryUnitId ?? null,
      listingId: input.listingId ?? null,
      assignedToUserId: ctx.userId,
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LEAD_CREATED,
    entityType: "Lead",
    entityId: lead.id,
    payloadAfter: { name: `${lead.firstName} ${lead.lastName}`, inboxStage: lead.inboxStage },
  });

  return lead;
}

const allowedLeadTransitions: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["TOURING", "APPLIED", "LOST"],
  TOURING: ["APPLIED", "CONTACTED", "LOST"],
  APPLIED: ["CONVERTED", "LOST"],
  CONVERTED: [],
  LOST: ["NEW"],
};

export async function updateLeadStatus(ctx: OrgContext, input: UpdateLeadStatusInput) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const allowed = allowedLeadTransitions[existing.status] ?? [];
  if (input.status !== existing.status && !allowed.includes(input.status)) {
    throw new Error(`Invalid lead status transition ${existing.status} → ${input.status}`);
  }

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      status: input.status,
      nextActionAt: input.nextActionAt ?? undefined,
      nextActionType: input.nextActionType ?? undefined,
    },
  });

  await logActivity({
    ctx,
    verb: "lead.status_changed",
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: { status: existing.status },
    payloadAfter: { status: updated.status, nextActionAt: updated.nextActionAt },
  });

  return updated;
}

export async function updateLeadInboxStage(ctx: OrgContext, input: UpdateLeadInboxStageInput) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: { inboxStage: input.inboxStage },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: { inboxStage: existing.inboxStage },
    payloadAfter: { inboxStage: updated.inboxStage },
  });

  return updated;
}

export async function advanceLeadPipeline(
  ctx: OrgContext,
  input: {
    leadId: string;
    status?: LeadStatus;
    inboxStage?: LeadInboxStage;
    nextActionAt?: Date | null;
    nextActionType?: NextActionType | null;
  },
) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.inboxStage ? { inboxStage: input.inboxStage } : {}),
      ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt } : {}),
      ...(input.nextActionType !== undefined
        ? { nextActionType: input.nextActionType ?? null }
        : {}),
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: { status: existing.status, inboxStage: existing.inboxStage },
    payloadAfter: { status: updated.status, inboxStage: updated.inboxStage },
  });

  return updated;
}
