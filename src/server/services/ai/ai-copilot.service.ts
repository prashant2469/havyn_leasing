/**
 * AI Copilot Service (V3) — main orchestrator
 *
 * Runs the full AI analysis pipeline for a lead + conversation:
 *   1. Generate conversation summary
 *   2. Extract qualification fields
 *   3. Compute lead priority signal
 *   4. Generate suggested next actions
 *   5. Detect escalation signals
 *   6. Suggest a reply draft
 *
 * All results are persisted as structured records.
 * Replace individual `_generate*` functions in sub-services to wire real LLMs.
 */

import {
  AIEscalationFlag,
  AIReplyDraft,
  AISuggestedAction,
  ConversationSummary,
  LeadPrioritySignal,
  QualificationAnswer,
} from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

import { generateConversationSummary } from "./conversation-summary.service";
import { detectEscalationSignals } from "./escalation.service";
import { computeLeadPriority } from "./lead-priority.service";
import { extractQualificationsFromConversation } from "./qualification-extraction.service";
import { suggestReplyDraft } from "./reply-draft.service";
import { generateSuggestedActions } from "./suggested-action.service";

export interface CopilotAnalysisResult {
  summary: ConversationSummary;
  suggestedActions: AISuggestedAction[];
  replyDraft: AIReplyDraft;
  prioritySignal: LeadPrioritySignal;
  extractedQualifications: QualificationAnswer[];
  escalationFlags: AIEscalationFlag[];
}

export async function runCopilotAnalysis(
  ctx: OrgContext,
  leadId: string,
  conversationId: string,
): Promise<CopilotAnalysisResult> {
  // Verify ownership
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead not found");

  await recordActivity({
    ctx,
    verb: ActivityVerbs.AI_ANALYSIS_TRIGGERED,
    entityType: "Lead",
    entityId: leadId,
    metadata: { triggeredByUserId: ctx.userId, conversationId },
  });

  // Run pipeline — order matters: summary → extraction → priority → actions → escalation → draft
  const [summary, extractedQualifications] = await Promise.all([
    generateConversationSummary(ctx, conversationId),
    extractQualificationsFromConversation(ctx, conversationId),
  ]);

  const [prioritySignal, suggestedActions, escalationFlags, replyDraft] = await Promise.all([
    computeLeadPriority(ctx, leadId),
    generateSuggestedActions(ctx, leadId, conversationId),
    detectEscalationSignals(ctx, leadId, conversationId),
    suggestReplyDraft(ctx, conversationId),
  ]);

  return {
    summary,
    suggestedActions,
    replyDraft,
    prioritySignal,
    extractedQualifications,
    escalationFlags,
  };
}

export interface CopilotContext {
  summary: ConversationSummary | null;
  activeDraft: AIReplyDraft | null;
  pendingActions: AISuggestedAction[];
  openEscalations: AIEscalationFlag[];
  prioritySignal: LeadPrioritySignal | null;
  qualifications: QualificationAnswer[];
}

/** Load current AI context for a lead/conversation without generating new data. */
export async function loadCopilotContext(
  ctx: OrgContext,
  leadId: string,
  conversationId?: string,
): Promise<CopilotContext> {
  const [summary, activeDraft, pendingActions, openEscalations, prioritySignal, qualifications] =
    await Promise.all([
      conversationId
        ? prisma.conversationSummary.findFirst({
            where: {
              conversationId,
              organizationId: ctx.organizationId,
              isStale: false,
            },
            orderBy: { generatedAt: "desc" },
          })
        : Promise.resolve(null),

      conversationId
        ? prisma.aIReplyDraft.findFirst({
            where: {
              conversationId,
              organizationId: ctx.organizationId,
              status: { in: ["SUGGESTED", "APPROVED"] },
            },
            orderBy: { generatedAt: "desc" },
          })
        : Promise.resolve(null),

      prisma.aISuggestedAction.findMany({
        where: {
          leadId,
          organizationId: ctx.organizationId,
          status: "PENDING",
        },
        orderBy: { priority: "desc" },
      }),

      prisma.aIEscalationFlag.findMany({
        where: {
          leadId,
          organizationId: ctx.organizationId,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.leadPrioritySignal.findUnique({ where: { leadId } }),

      prisma.qualificationAnswer.findMany({
        where: { leadId },
        orderBy: { key: "asc" },
      }),
    ]);

  return {
    summary,
    activeDraft,
    pendingActions,
    openEscalations,
    prioritySignal,
    qualifications,
  };
}
