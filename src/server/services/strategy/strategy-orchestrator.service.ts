import { LeadInboxStage, ListingChannelType } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { evaluateAutomationDecision } from "@/server/services/ai/automation-decision.service";
import { generateContextualReply } from "@/server/services/ai/contextual-reply.service";
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
        select: { id: true, automationPaused: true },
      }),
      prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: ctx.organizationId,
        },
        select: { channelType: true },
      }),
    ]);
    if (!lead || lead.automationPaused) return;
    isSmsConversation = conversation?.channelType === ListingChannelType.SMS;

    // If the lead only has phone (no email), SMS will be used regardless of conversation origin.
    const leadContact = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId: ctx.organizationId },
      select: { email: true, phone: true },
    });
    willDeliverViaSms = isSmsConversation || (!leadContact?.email?.trim() && !!leadContact?.phone?.trim());

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
