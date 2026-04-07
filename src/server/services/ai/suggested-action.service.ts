/**
 * Suggested Action Service (V3)
 *
 * Generates, manages, and resolves AI-suggested next actions for leads.
 * Replace `_generateSuggestedActions` with real LLM reasoning when ready.
 */

import { AISuggestedAction, AISuggestedActionType } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

interface ActionSuggestion {
  actionType: AISuggestedActionType;
  title: string;
  description: string;
  priority: number;
}

/**
 * Deterministic placeholder — derives suggested actions from lead + conversation state.
 * Replace with LLM reasoning chain when ready.
 */
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
  const qualCount = lead.qualifications.length;
  const hasResponse = lead.firstResponseAt !== null;

  // No first response yet → top priority: reply
  if (!hasResponse && latestMessage) {
    actions.push({
      actionType: "REPLY_NOW",
      title: "Send first reply",
      description: "Lead has not received a response yet. Respond quickly to improve conversion.",
      priority: 100,
    });
  }

  // Missing key qualification data
  if (qualCount < 3) {
    actions.push({
      actionType: "ASK_QUALIFICATION",
      title: "Capture missing qualification fields",
      description: `Only ${qualCount} qualification fields recorded. Ask about move-in date, budget, and occupants.`,
      priority: 80,
    });
  }

  // Qualified but no tour yet
  if (qualCount >= 3 && !hasTour) {
    actions.push({
      actionType: "OFFER_TOUR_TIMES",
      title: "Offer tour availability",
      description: "Lead appears qualified. Offer tour times to move them forward in the pipeline.",
      priority: 90,
    });
  }

  // Tour scheduled — suggest application
  if (hasTour) {
    const tourDate = lead.tours[0].scheduledAt;
    const isPast = tourDate < new Date();
    if (isPast) {
      actions.push({
        actionType: "SEND_APPLICATION_INVITE",
        title: "Send application invite",
        description: "Tour was completed. Follow up with a rental application invitation.",
        priority: 95,
      });
    }
  }

  // Default fallback
  if (actions.length === 0) {
    actions.push({
      actionType: "FOLLOW_UP_24H",
      title: "Schedule a 24-hour follow-up",
      description: "No urgent action identified. Follow up tomorrow to keep the lead warm.",
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

  // Expire existing pending actions
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
          modelId: "placeholder-v1",
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
