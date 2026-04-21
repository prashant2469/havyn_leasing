/**
 * Suggested Action Service (V3)
 *
 * Generates AI-suggested next actions for leads from pipeline state + V4 completeness.
 */

import { AISuggestedAction, AISuggestedActionType, LeadInboxStage, NextActionType } from "@prisma/client";
import { addHours } from "date-fns";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { enqueueLeadFollowUpDue } from "@/server/jobs/events";
import { recordActivity } from "@/server/services/activity/activity.service";
import { qualificationGapLabelsForLead } from "@/server/services/ai/copilot-qual-gaps";
import { recordHumanHandoff } from "@/server/services/leasing/handoff.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import { sendToProspect } from "@/server/services/outbound/dispatch.service";

interface ActionSuggestion {
  actionType: AISuggestedActionType;
  title: string;
  description: string;
  priority: number;
}

async function _generateSuggestedActions(leadId: string): Promise<ActionSuggestion[]> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      conversations: {
        include: {
          messages: { orderBy: { sentAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      tours: { take: 1, orderBy: { scheduledAt: "asc" } },
      qualifications: true,
    },
  });

  if (!lead) return [];

  const actions: ActionSuggestion[] = [];
  const latestConversation = lead.conversations[0];
  const latestMessage = latestConversation?.messages[0];
  const hasTour = lead.tours.length > 0;
  const hasResponse = lead.firstResponseAt !== null;
  const { score, missing } = await getQualificationCompleteness(leadId);
  const gapLabels = await qualificationGapLabelsForLead(leadId);
  const gapEvidence =
    gapLabels.length > 0 ? `Evidence: still missing — ${gapLabels.slice(0, 4).join("; ")}.` : "Evidence: V4 qualification set is complete.";

  if (!hasResponse && latestMessage) {
    actions.push({
      actionType: "REPLY_NOW",
      title: "Send first reply",
      description:
        "Lead has not received an outbound response yet. Quick first touch improves conversion. " +
        (latestMessage.direction === "INBOUND"
          ? "Latest message is inbound — acknowledge and ask one focused question."
          : ""),
      priority: 100,
    });
  }

  if (score < 0.85 && missing.length > 0) {
    actions.push({
      actionType: "ASK_QUALIFICATION",
      title: "Capture remaining qualification topics",
      description: `Completeness about ${Math.round(score * 100)}%. ${gapEvidence}`,
      priority: 80 + Math.round((1 - score) * 40),
    });
  }

  if (score >= 0.5 && !hasTour) {
    actions.push({
      actionType: "OFFER_TOUR_TIMES",
      title: "Offer concrete tour windows",
      description:
        "Lead has enough context to tour. Propose 2–3 slots aligned with the property showing schedule and confirm contact channel.",
      priority: 90,
    });
  }

  if (hasTour) {
    const tourDate = lead.tours[0].scheduledAt;
    const isPast = tourDate < new Date();
    if (isPast) {
      actions.push({
        actionType: "SEND_APPLICATION_INVITE",
        title: "Invite rental application",
        description:
          "Tour date has passed. Evidence: follow up while interest is fresh — share application link and required documents list.",
        priority: 95,
      });
    } else {
      actions.push({
        actionType: "MARK_QUALIFIED",
        title: "Prep for upcoming tour",
        description: `Tour on ${tourDate.toLocaleDateString()}. Confirm parking, access, and who meets the prospect.`,
        priority: 70,
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      actionType: "FOLLOW_UP_24H",
      title: "Schedule a 24-hour follow-up",
      description: "No urgent action identified. Evidence: keep thread warm with a short check-in.",
      priority: 20,
    });
  }

  return actions.sort((a, b) => b.priority - a.priority);
}

export async function generateSuggestedActions(
  ctx: OrgContext,
  leadId: string,
  conversationId?: string,
): Promise<AISuggestedAction[]> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead not found");

  await prisma.aISuggestedAction.updateMany({
    where: { leadId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  const suggestions = await _generateSuggestedActions(leadId);

  const created = await prisma.$transaction(
    suggestions.map((s) =>
      prisma.aISuggestedAction.create({
        data: {
          organizationId: ctx.organizationId,
          leadId,
          conversationId: conversationId ?? null,
          actionType: s.actionType,
          title: s.title,
          description: s.description,
          priority: s.priority,
          status: "PENDING",
          modelId: "heuristic-v4",
        },
      }),
    ),
  );

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_NEXT_ACTION_SUGGESTED,
    entityType: "Lead",
    entityId: leadId,
    metadata: { count: created.length, types: suggestions.map((s) => s.actionType), conversationId },
  });

  return created;
}

async function applySuggestedActionSideEffects(ctx: OrgContext, action: AISuggestedAction): Promise<void> {
  const leadId = action.leadId;
  const now = new Date();
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true, firstName: true, listing: { select: { title: true } } },
  });
  const conversationId =
    action.conversationId ??
    (
      await prisma.conversation.findFirst({
        where: { organizationId: ctx.organizationId, leadId },
        select: { id: true },
      })
    )?.id ??
    null;

  switch (action.actionType) {
    case AISuggestedActionType.REPLY_NOW:
      await prisma.lead.update({
        where: { id: leadId },
        data: { nextActionAt: addHours(now, 4), nextActionType: NextActionType.FOLLOW_UP },
      });
      if (lead && conversationId) {
        await sendToProspect(ctx, {
          leadId,
          conversationId,
          body: `Hi ${lead.firstName},\n\nThanks for your message. We are on it and can help with next steps today.`,
          subject: lead.listing?.title
            ? `Re: ${lead.listing.title} — Havyn Leasing`
            : "Re: your inquiry — Havyn Leasing",
          preferredChannel: "AUTO",
          fallbackLabel: "Reply not sent — no deliverable channel configured",
        });
      }
      break;
    case AISuggestedActionType.FOLLOW_UP_24H:
      await prisma.lead.update({
        where: { id: leadId },
        data: { nextActionAt: addHours(now, 24), nextActionType: NextActionType.FOLLOW_UP },
      });
      await enqueueLeadFollowUpDue(
        {
          organizationId: ctx.organizationId,
          leadId,
          conversationId,
        },
        addHours(now, 24),
      );
      break;
    case AISuggestedActionType.OFFER_TOUR_TIMES:
      await prisma.lead.update({
        where: { id: leadId },
        data: { nextActionAt: addHours(now, 4), nextActionType: NextActionType.TOUR },
      });
      if (lead && conversationId) {
        await sendToProspect(ctx, {
          leadId,
          conversationId,
          body: `Hi ${lead.firstName},\n\nWould you like a few tour options this week? I can send times that match the showing calendar.`,
          subject: lead.listing?.title
            ? `Tour options for ${lead.listing.title} — Havyn Leasing`
            : "Tour options — Havyn Leasing",
          preferredChannel: "AUTO",
          fallbackLabel: "Tour offer not sent — no deliverable channel configured",
        });
      }
      break;
    case AISuggestedActionType.ASK_QUALIFICATION:
      await prisma.lead.update({
        where: { id: leadId },
        data: { nextActionAt: addHours(now, 8), nextActionType: NextActionType.EMAIL },
      });
      if (lead && conversationId) {
        await sendToProspect(ctx, {
          leadId,
          conversationId,
          body: `Hi ${lead.firstName},\n\nTo keep your options accurate, can you share your target move-in date and budget range?`,
          subject: lead.listing?.title
            ? `Quick details for ${lead.listing.title} — Havyn Leasing`
            : "Quick leasing details — Havyn Leasing",
          preferredChannel: "AUTO",
          fallbackLabel: "Qualification prompt not sent — no deliverable channel configured",
        });
      }
      break;
    case AISuggestedActionType.SEND_APPLICATION_INVITE: {
      const leadState = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: ctx.organizationId },
        select: { applicationStartedAt: true },
      });
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          inboxStage: LeadInboxStage.APPLICATION_STARTED,
          applicationStartedAt: leadState?.applicationStartedAt ?? now,
          nextActionAt: addHours(now, 48),
          nextActionType: NextActionType.FOLLOW_UP,
        },
      });
      if (lead && conversationId) {
        await sendToProspect(ctx, {
          leadId,
          conversationId,
          body: `Hi ${lead.firstName},\n\nYou can move forward with the rental application now. Reply here if you want help with requirements or timing.`,
          subject: lead.listing?.title
            ? `Application invite for ${lead.listing.title} — Havyn Leasing`
            : "Application invite — Havyn Leasing",
          preferredChannel: "AUTO",
          fallbackLabel: "Application invite not sent — no deliverable channel configured",
        });
      }
      break;
    }
    case AISuggestedActionType.HAND_OFF_TO_HUMAN:
      await recordHumanHandoff(ctx, {
        leadId,
        reason: "Operator accepted AI suggested action: hand off to human",
      });
      break;
    case AISuggestedActionType.MARK_QUALIFIED:
      await prisma.lead.update({
        where: { id: leadId },
        data: { nextActionAt: addHours(now, 24), nextActionType: NextActionType.TOUR },
      });
      break;
    default:
      break;
  }
}

export async function acceptSuggestedAction(
  ctx: OrgContext,
  actionId: string,
): Promise<AISuggestedAction> {
  const action = await prisma.aISuggestedAction.findFirst({
    where: { id: actionId, organizationId: ctx.organizationId },
  });
  if (!action) throw new Error("Action not found");

  const updated = await prisma.aISuggestedAction.update({
    where: { id: actionId },
    data: { status: "ACCEPTED", actionedByUserId: ctx.userId, actionedAt: new Date() },
  });

  await applySuggestedActionSideEffects(ctx, action);

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_ACTION_ACCEPTED,
    entityType: "Lead",
    entityId: action.leadId,
    metadata: { actionId, actionType: action.actionType, conversationId: action.conversationId },
  });

  return updated;
}

export async function dismissSuggestedAction(
  ctx: OrgContext,
  actionId: string,
): Promise<AISuggestedAction> {
  const action = await prisma.aISuggestedAction.findFirst({
    where: { id: actionId, organizationId: ctx.organizationId },
  });
  if (!action) throw new Error("Action not found");

  const updated = await prisma.aISuggestedAction.update({
    where: { id: actionId },
    data: { status: "DISMISSED", actionedByUserId: ctx.userId, actionedAt: new Date() },
  });

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_ACTION_DISMISSED,
    entityType: "Lead",
    entityId: action.leadId,
    metadata: { actionId, actionType: action.actionType, conversationId: action.conversationId },
  });

  return updated;
}

export async function getPendingActionsForLead(
  ctx: OrgContext,
  leadId: string,
): Promise<AISuggestedAction[]> {
  return prisma.aISuggestedAction.findMany({
    where: { leadId, organizationId: ctx.organizationId, status: "PENDING" },
    orderBy: { priority: "desc" },
  });
}
