import { LeadInboxStage, LeadStatus } from "@prisma/client";

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
      lastResponseAt: new Date(),
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
