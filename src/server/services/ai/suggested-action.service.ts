/**
 * Suggested Action Service (V3)
 *
 * Generates AI-suggested next actions for leads from pipeline state + V4 completeness.
 */

import { AISuggestedAction, AISuggestedActionType } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { qualificationGapLabelsForLead } from "@/server/services/ai/copilot-qual-gaps";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";

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
