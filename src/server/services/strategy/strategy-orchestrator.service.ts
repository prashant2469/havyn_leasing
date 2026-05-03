import { LeadInboxStage } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { evaluateAutomationDecision } from "@/server/services/ai/automation-decision.service";
import { computeLeadStrength } from "@/server/services/ai/lead-strength.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import {
  transitionAfterFirstOutreach,
  transitionOnQualificationThreshold,
  transitionOnProspectReply,
} from "@/server/services/leasing/stage-machine.service";
import { sendToProspect } from "@/server/services/outbound/dispatch.service";
import { generateRecommendations } from "@/server/services/recommendations/recommendation.service";
import { resolveStrategyDecision } from "@/server/services/strategy/strategy-decision.service";
import { generateStrategyMessage } from "@/server/services/strategy/strategy-message.service";

export async function resolveAndExecuteStrategy(
  ctx: OrgContext,
  input: { leadId: string; conversationId: string; phase: "first_outreach" | "reply" },
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    select: { id: true, automationPaused: true },
  });
  if (!lead || lead.automationPaused) return;

  await computeLeadStrength(ctx, input.leadId);
  const strategy = await resolveStrategyDecision(ctx, {
    leadId: input.leadId,
    conversationId: input.conversationId,
  });

  if (strategy.action === "ESCALATE") {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { automationPaused: true, inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
    });
    return;
  }
  if (strategy.action === "WAIT") return;

  if (strategy.action === "RECOMMEND") {
    await generateRecommendations(ctx, input.leadId);
  }

  const generated = await generateStrategyMessage(ctx, {
    leadId: input.leadId,
    decision: strategy,
  });
  const decision = await evaluateAutomationDecision(ctx, {
    leadId: input.leadId,
    conversationId: input.conversationId,
    intent: strategy.intent,
    confidence: strategy.confidence,
  });

  if (decision.decision === "ESCALATE") {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { automationPaused: true, inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
    });
    return;
  }
  if (decision.decision === "WAIT") return;

  if (decision.decision === "DRAFT_FOR_REVIEW") {
    await prisma.aIReplyDraft.updateMany({
      where: { conversationId: input.conversationId, status: "SUGGESTED" },
      data: { status: "SUPERSEDED" },
    });
    await prisma.aIReplyDraft.create({
      data: {
        organizationId: ctx.organizationId,
        leadId: input.leadId,
        conversationId: input.conversationId,
        body: generated.body,
        contextNote: `Strategy ${strategy.action}: ${strategy.reasons.join(", ")}`,
        automationConfidence: strategy.confidence,
        status: "SUGGESTED",
        modelId: "strategy-orchestrator-v1",
        promptVersion: "v1.0",
      },
    });
    return;
  }

  await sendToProspect(ctx, {
    leadId: input.leadId,
    conversationId: input.conversationId,
    body: generated.body,
    subject: generated.subject,
    preferredChannel: generated.preferredChannel,
    fallbackLabel: "Strategy reply not sent — no deliverable channel configured",
  });

  if (input.phase === "first_outreach") {
    await transitionAfterFirstOutreach(ctx, input.leadId);
  } else {
    await transitionOnProspectReply(ctx, input.leadId);
  }

  const { score } = await getQualificationCompleteness(input.leadId);
  await transitionOnQualificationThreshold(ctx, input.leadId, score);
}
