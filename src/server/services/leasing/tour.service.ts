import { LeadInboxStage, LeadStatus } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type { CreateTourInput, UpdateTourStatusInput } from "@/server/validation/tour";

async function assertLeadInOrg(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");
  return lead;
}

export async function createTour(ctx: OrgContext, input: CreateTourInput) {
  const lead = await assertLeadInOrg(ctx, input.leadId);

  if (input.listingId) {
    const listing = await prisma.listing.findFirst({
      where: { id: input.listingId, organizationId: ctx.organizationId },
    });
    if (!listing) throw new Error("Listing not found");
  }

  const tour = await prisma.tour.create({
    data: {
      leadId: input.leadId,
      listingId: input.listingId ?? lead.listingId ?? null,
      scheduledAt: input.scheduledAt,
      notes: input.notes || null,
    },
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      inboxStage: LeadInboxStage.TOUR_SCHEDULED,
      ...(lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED
        ? { status: LeadStatus.TOURING }
        : {}),
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.TOUR_SCHEDULED,
    entityType: "Tour",
    entityId: tour.id,
    metadata: { leadId: input.leadId, scheduledAt: tour.scheduledAt.toISOString() },
  });

  return tour;
}

export async function updateTourStatus(ctx: OrgContext, input: UpdateTourStatusInput) {
  const tour = await prisma.tour.findFirst({
    where: { id: input.tourId, lead: { organizationId: ctx.organizationId } },
  });
  if (!tour) throw new Error("Tour not found");

  const updated = await prisma.tour.update({
    where: { id: input.tourId },
    data: {
      status: input.status,
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });

  await recordActivity({
    ctx,
    verb: "tour.status_changed",
    entityType: "Tour",
    entityId: updated.id,
    payloadBefore: { status: tour.status },
    payloadAfter: { status: updated.status },
  });

  return updated;
}

export async function listToursForOrg(ctx: OrgContext) {
  return prisma.tour.findMany({
    where: { lead: { organizationId: ctx.organizationId } },
    orderBy: { scheduledAt: "desc" },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, email: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}
