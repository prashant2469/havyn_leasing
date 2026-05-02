import { ApplicationStatus, LeadInboxStage, LeadStatus } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";

/** After first automated outbound, move from NEW_INQUIRY to AWAITING_RESPONSE. */
export async function transitionAfterFirstOutreach(
  ctx: OrgContext,
  leadId: string,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return;

  if (lead.inboxStage !== LeadInboxStage.NEW_INQUIRY && lead.inboxStage !== LeadInboxStage.NEW_LEADS) {
    return;
  }

  if (lead.inboxStage === LeadInboxStage.NEW_INQUIRY || lead.inboxStage === LeadInboxStage.NEW_LEADS) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        inboxStage: LeadInboxStage.AWAITING_RESPONSE,
        status: lead.status === LeadStatus.NEW ? LeadStatus.CONTACTED : lead.status,
      },
    });

    await recordActivity({
      ctx,
      verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
      entityType: "Lead",
      entityId: leadId,
      metadata: {
        from: lead.inboxStage,
        to: LeadInboxStage.AWAITING_RESPONSE,
        reason: "first_outreach_sent",
      },
    });
  }
}

/** After a tour is booked on the calendar, move lead to tour scheduled. */
export async function transitionAfterTourBooked(ctx: OrgContext, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return;

  if (lead.inboxStage === LeadInboxStage.TOUR_SCHEDULED) return;

  const nextStatus =
    lead.status === LeadStatus.APPLIED ? LeadStatus.APPLIED : LeadStatus.TOURING;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      inboxStage: LeadInboxStage.TOUR_SCHEDULED,
      status: nextStatus,
    },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: leadId,
    metadata: {
      from: lead.inboxStage,
      to: LeadInboxStage.TOUR_SCHEDULED,
      reason: "tour_booked",
    },
  });
}

/** When a prospect replies, ensure the lead moves into active conversation. */
export async function transitionOnProspectReply(ctx: OrgContext, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return;
  if (lead.inboxStage === LeadInboxStage.COLD_LEADS || lead.inboxStage === LeadInboxStage.NEW_LEADS) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        inboxStage: LeadInboxStage.AWAITING_RESPONSE,
        status: lead.status === LeadStatus.NEW ? LeadStatus.CONTACTED : lead.status,
      },
    });
    await recordActivity({
      ctx,
      verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
      entityType: "Lead",
      entityId: leadId,
      metadata: {
        from: lead.inboxStage,
        to: LeadInboxStage.AWAITING_RESPONSE,
        reason: "prospect_replied",
      },
    });
  }
}

/** Once qualification reaches a usable threshold, move lead into active response lane. */
export async function transitionOnQualificationThreshold(
  ctx: OrgContext,
  leadId: string,
  completenessScore: number,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return;
  if (completenessScore < 0.5) return;
  if (
    lead.inboxStage === LeadInboxStage.NEW_INQUIRY ||
    lead.inboxStage === LeadInboxStage.NEW_LEADS ||
    lead.inboxStage === LeadInboxStage.COLD_LEADS
  ) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { inboxStage: LeadInboxStage.AWAITING_RESPONSE },
    });
    await recordActivity({
      ctx,
      verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
      entityType: "Lead",
      entityId: leadId,
      metadata: {
        from: lead.inboxStage,
        to: LeadInboxStage.AWAITING_RESPONSE,
        reason: "qualification_threshold_reached",
        completenessScore,
      },
    });
  }
}

/** Tour completed should move to application lane and applied status when needed. */
export async function transitionAfterTourCompleted(ctx: OrgContext, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      inboxStage: LeadInboxStage.APPLICATION_STARTED,
      status:
        lead.status === LeadStatus.NEW ||
        lead.status === LeadStatus.CONTACTED ||
        lead.status === LeadStatus.TOURING
          ? LeadStatus.APPLIED
          : lead.status,
      applicationStartedAt: lead.applicationStartedAt ?? new Date(),
    },
  });
  await recordActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: leadId,
    metadata: {
      from: lead.inboxStage,
      to: LeadInboxStage.APPLICATION_STARTED,
      reason: "tour_completed",
    },
  });
}

/** Keep lead stage/status aligned with application statuses. */
export async function transitionOnApplicationStatus(
  ctx: OrgContext,
  leadId: string,
  appStatus: ApplicationStatus,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return;

  if (appStatus === ApplicationStatus.APPROVED) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        inboxStage: LeadInboxStage.APPLICATION_STARTED,
        status: LeadStatus.APPLIED,
      },
    });
  } else if (appStatus === ApplicationStatus.DECLINED || appStatus === ApplicationStatus.WITHDRAWN) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW,
      },
    });
  } else {
    return;
  }

  await recordActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: leadId,
    metadata: {
      from: lead.inboxStage,
      to:
        appStatus === ApplicationStatus.DECLINED || appStatus === ApplicationStatus.WITHDRAWN
          ? LeadInboxStage.NEEDS_HUMAN_REVIEW
          : LeadInboxStage.APPLICATION_STARTED,
      reason: "application_status_changed",
      applicationStatus: appStatus,
    },
  });
}
