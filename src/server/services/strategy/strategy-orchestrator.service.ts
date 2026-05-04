import { AIEscalationReason, LeadInboxStage, ListingChannelType } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { evaluateAutomationDecision } from "@/server/services/ai/automation-decision.service";
import { generateContextualReply } from "@/server/services/ai/contextual-reply.service";
import { classifyInboundIntent } from "@/server/services/ai/intent-classifier.service";
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

function compactSmsBody(input: string, maxChars = 320): string {
  const oneLine = input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n/g, "\n")
    .trim();
  if (oneLine.length <= maxChars) return oneLine;
  return `${oneLine.slice(0, maxChars - 1).trimEnd()}…`;
}

async function sendFallbackReply(
  ctx: OrgContext,
  input: { leadId: string; conversationId: string },
): Promise<void> {
  await sendToProspect(ctx, {
    leadId: input.leadId,
    conversationId: input.conversationId,
    body: "Thanks for your message. A leasing specialist will follow up shortly.",
    preferredChannel: "SMS",
    fallbackLabel: "Fallback SMS not sent — no deliverable channel configured",
  });
}

export async function resolveAndExecuteStrategy(
  ctx: OrgContext,
  input: { leadId: string; conversationId: string; phase: "first_outreach" | "reply" },
): Promise<void> {
  let isSmsConversation = false;
  let willDeliverViaSms = false;
  try {
    const [lead, conversation] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: input.leadId, organizationId: ctx.organizationId },
        select: { id: true, automationPaused: true, inboxStage: true },
      }),
      prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: ctx.organizationId,
        },
        select: { channelType: true },
      }),
    ]);
    if (!lead) return;
    if (lead.automationPaused) {
      if (input.phase !== "reply") return;
      const latestInbound = await prisma.message.findFirst({
        where: { conversationId: input.conversationId, direction: "INBOUND" },
        orderBy: { sentAt: "desc" },
        select: { channel: true, body: true },
      });
      const intent = classifyInboundIntent(latestInbound?.body ?? "");
      const canResumeAutomation =
        latestInbound?.channel === "SMS" && intent.intent !== "SENSITIVE" && intent.intent !== "COMPLAINT";
      if (!canResumeAutomation) return;
      await prisma.lead.update({
        where: { id: input.leadId },
        data: {
          automationPaused: false,
          inboxStage:
            lead.inboxStage === LeadInboxStage.NEEDS_HUMAN_REVIEW
              ? LeadInboxStage.AWAITING_RESPONSE
              : lead.inboxStage,
        },
      });
      // Auto-resolve stale low-confidence escalation flags so computeLeadStrength
      // doesn't keep setting HUMAN_REQUIRED bucket on every run.
      await prisma.aIEscalationFlag.updateMany({
        where: {
          organizationId: ctx.organizationId,
          leadId: input.leadId,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          reason: AIEscalationReason.UNCLEAR_INTENT,
          confidenceScore: { lt: 0.6 },
        },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: "Auto-resolved: lead re-engaged via SMS" },
      });
    }
    isSmsConversation = conversation?.channelType === ListingChannelType.SMS;

    // AUTO delivery prefers SMS when a phone number exists.
    const leadContact = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId: ctx.organizationId },
      select: { email: true, phone: true },
    });
    willDeliverViaSms = isSmsConversation || !!leadContact?.phone?.trim();

    await computeLeadStrength(ctx, input.leadId);
    const strategy = await resolveStrategyDecision(ctx, {
      leadId: input.leadId,
      conversationId: input.conversationId,
    });

    if (strategy.action === "ESCALATE") {
      const isTrulySensitive =
        strategy.intent === "SENSITIVE" || strategy.intent === "COMPLAINT";
      if (isTrulySensitive || !willDeliverViaSms) {
        await prisma.lead.update({
          where: { id: input.leadId },
          data: { automationPaused: true, inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
        });
      }
      return;
    }
    if (strategy.action === "WAIT") return;

    await generateRecommendations(ctx, input.leadId);
    const strategyMessage = await generateStrategyMessage(ctx, {
      leadId: input.leadId,
      decision: strategy,
      smsCompact: input.phase === "first_outreach" && willDeliverViaSms,
    });
    const generated =
      input.phase === "reply"
        ? await (async () => {
            const contextual = await generateContextualReply(ctx, {
              conversationId: input.conversationId,
              leadId: input.leadId,
            });
            return {
              ...strategyMessage,
              body: contextual.body,
              preferredChannel:
                contextual.suggestedChannel === "SMS"
                  ? "SMS"
                  : contextual.suggestedChannel === "EMAIL"
                    ? "EMAIL"
                    : strategyMessage.preferredChannel,
            } as const;
          })()
        : {
            ...strategyMessage,
            body: willDeliverViaSms ? compactSmsBody(strategyMessage.body, 320) : strategyMessage.body,
          };
    const decision = await evaluateAutomationDecision(ctx, {
      leadId: input.leadId,
      conversationId: input.conversationId,
      intent: strategy.intent,
      confidence: strategy.confidence,
      phase: input.phase,
    });

    if (decision.decision === "ESCALATE") {
      const isTrulySensitive =
        strategy.intent === "SENSITIVE" || strategy.intent === "COMPLAINT";
      if (isTrulySensitive || !willDeliverViaSms) {
        await prisma.lead.update({
          where: { id: input.leadId },
          data: { automationPaused: true, inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW },
        });
      }
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
  } catch (error) {
    console.error("[strategy-orchestrator] pipeline failed", {
      leadId: input.leadId,
      conversationId: input.conversationId,
      phase: input.phase,
      error,
    });
    if (input.phase === "reply" && (isSmsConversation || willDeliverViaSms)) {
      await sendFallbackReply(ctx, input);
    }
  }
}
