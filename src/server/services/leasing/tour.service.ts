import { LeadInboxStage, LeadStatus, NextActionType, TourStatus } from "@prisma/client";
import { addHours } from "date-fns";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { enqueueLeadFollowUpDue } from "@/server/jobs/events";
import { recordActivity } from "@/server/services/activity/activity.service";
import { sendToProspect } from "@/server/services/outbound/dispatch.service";
import { scheduleTourReminders } from "@/server/services/tours/tour-reminders.service";
import {
  deleteGoogleTourEvent,
  upsertGoogleTourEvent,
} from "@/server/services/google/google-calendar.service";
import type {
  CancelTourInput,
  CreateTourInput,
  RescheduleTourInput,
  UpdateTourStatusInput,
} from "@/server/validation/tour";

async function assertLeadInOrg(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");
  return lead;
}

export async function createTour(ctx: OrgContext, input: CreateTourInput) {
  const lead = await assertLeadInOrg(ctx, input.leadId);
  let listingPropertyId: string | null = null;

  if (input.listingId) {
    const listing = await prisma.listing.findFirst({
      where: { id: input.listingId, organizationId: ctx.organizationId },
      select: { id: true, unit: { select: { propertyId: true } } },
    });
    if (!listing) throw new Error("Listing not found");
    listingPropertyId = listing.unit.propertyId;
  }

  const tour = await prisma.tour.create({
    data: {
      leadId: input.leadId,
      listingId: input.listingId ?? lead.listingId ?? null,
      propertyId: lead.propertyId ?? listingPropertyId ?? null,
      scheduledAt: input.scheduledAt,
      notes: input.notes || null,
    },
  });

  await upsertGoogleTourEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    tourId: tour.id,
    startAt: tour.scheduledAt,
    durationMinutes: tour.durationMinutes,
    summary: `Tour: ${lead.firstName} ${lead.lastName}`,
    description: input.notes ? `Notes: ${input.notes}` : "Scheduled via Havyn",
  }).catch(() => null);

  const conversation = await prisma.conversation.findFirst({
    where: { organizationId: ctx.organizationId, leadId: input.leadId },
    select: { id: true },
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      inboxStage: LeadInboxStage.TOUR_SCHEDULED,
      tourBookedAt: lead.tourBookedAt ?? new Date(),
      ...(lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED
        ? { status: LeadStatus.TOURING }
        : {}),
    },
  });

  try {
    await scheduleTourReminders({
      organizationId: ctx.organizationId,
      tourId: tour.id,
      leadId: input.leadId,
      conversationId: conversation?.id ?? null,
      scheduledAt: tour.scheduledAt,
    });
  } catch (err) {
    console.error("[createTour] scheduleTourReminders failed:", err);
  }

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
    include: {
      lead: true,
      listing: { select: { title: true } },
    },
  });
  if (!tour) throw new Error("Tour not found");

  const updated = await prisma.tour.update({
    where: { id: input.tourId },
    data: {
      status: input.status,
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });

  if (updated.status === TourStatus.CANCELLED && updated.googleEventId) {
    await deleteGoogleTourEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      googleEventId: updated.googleEventId,
    }).catch(() => undefined);
  }

  await recordActivity({
    ctx,
    verb: "tour.status_changed",
    entityType: "Tour",
    entityId: updated.id,
    payloadBefore: { status: tour.status },
    payloadAfter: { status: updated.status },
  });

  if (tour.status !== updated.status && updated.status === TourStatus.COMPLETED) {
    await prisma.lead.update({
      where: { id: tour.leadId },
      data: {
        inboxStage: LeadInboxStage.APPLICATION_STARTED,
        nextActionAt: addHours(new Date(), 48),
        nextActionType: NextActionType.FOLLOW_UP,
      },
    });

    const conversation = await prisma.conversation.findFirst({
      where: { organizationId: ctx.organizationId, leadId: tour.leadId },
      select: { id: true },
    });
    if (conversation?.id) {
      await sendToProspect(ctx, {
        leadId: tour.leadId,
        conversationId: conversation.id,
        body: `Hi ${tour.lead.firstName},\n\nThanks again for touring ${tour.listing?.title ?? "with us"}.\n\nIf you want to move forward, we can send your application link and checklist right away.`,
        subject: tour.listing?.title
          ? `Next steps for ${tour.listing.title} — Havyn Leasing`
          : "Next steps after your tour — Havyn Leasing",
        preferredChannel: "AUTO",
        fallbackLabel: "Tour follow-up not sent — no deliverable channel configured",
      });
    }
  }

  if (tour.status !== updated.status && updated.status === TourStatus.NO_SHOW) {
    const followUpAt = addHours(new Date(), 4);
    await prisma.lead.update({
      where: { id: tour.leadId },
      data: {
        inboxStage: LeadInboxStage.AWAITING_RESPONSE,
        nextActionAt: followUpAt,
        nextActionType: NextActionType.FOLLOW_UP,
      },
    });
    const conversation = await prisma.conversation.findFirst({
      where: { organizationId: ctx.organizationId, leadId: tour.leadId },
      select: { id: true },
    });
    await enqueueLeadFollowUpDue(
      {
        organizationId: ctx.organizationId,
        leadId: tour.leadId,
        conversationId: conversation?.id ?? null,
      },
      followUpAt,
    );
  }

  return updated;
}

export async function rescheduleTour(ctx: OrgContext, input: RescheduleTourInput) {
  const existing = await prisma.tour.findFirst({
    where: { id: input.tourId, lead: { organizationId: ctx.organizationId } },
    include: { lead: true },
  });
  if (!existing) throw new Error("Tour not found");

  const updated = await prisma.tour.update({
    where: { id: input.tourId },
    data: {
      scheduledAt: input.scheduledAt,
      notes: input.notes || existing.notes,
    },
  });

  await upsertGoogleTourEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    tourId: updated.id,
    googleEventId: updated.googleEventId,
    startAt: updated.scheduledAt,
    durationMinutes: updated.durationMinutes,
    summary: `Tour: ${existing.lead.firstName} ${existing.lead.lastName}`,
    description: updated.notes ?? "Rescheduled via Havyn",
  }).catch(() => null);

  await recordActivity({
    ctx,
    verb: "tour.rescheduled",
    entityType: "Tour",
    entityId: updated.id,
    payloadBefore: { scheduledAt: existing.scheduledAt },
    payloadAfter: { scheduledAt: updated.scheduledAt },
  });

  return updated;
}

export async function cancelTour(ctx: OrgContext, input: CancelTourInput) {
  const existing = await prisma.tour.findFirst({
    where: { id: input.tourId, lead: { organizationId: ctx.organizationId } },
  });
  if (!existing) throw new Error("Tour not found");

  const updated = await prisma.tour.update({
    where: { id: input.tourId },
    data: {
      status: TourStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: input.reason || null,
    },
  });

  if (updated.googleEventId) {
    await deleteGoogleTourEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      googleEventId: updated.googleEventId,
    }).catch(() => undefined);
  }

  await recordActivity({
    ctx,
    verb: "tour.cancelled",
    entityType: "Tour",
    entityId: updated.id,
    metadata: { reason: input.reason || null },
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
