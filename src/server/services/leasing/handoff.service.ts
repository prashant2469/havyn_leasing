import { LeadInboxStage } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";

/**
 * Human handoff / escalation. TODO: notify assignee via Slack, email, or SMS when integrations exist.
 */
export async function recordHumanHandoff(
  ctx: OrgContext,
  input: { leadId: string; toUserId?: string | null; reason?: string | null },
) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const event = await prisma.humanHandoffEvent.create({
    data: {
      organizationId: ctx.organizationId,
      leadId: input.leadId,
      fromUserId: ctx.userId,
      toUserId: input.toUserId ?? null,
      reason: input.reason ?? null,
    },
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: { inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.HUMAN_HANDOFF,
    entityType: "HumanHandoffEvent",
    entityId: event.id,
    metadata: { leadId: input.leadId, toUserId: input.toUserId },
  });

  return event;
}
