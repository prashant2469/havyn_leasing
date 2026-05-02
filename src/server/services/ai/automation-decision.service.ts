import { InboundIntentType, LeadInboxStage, LeadStrengthTier } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { hasOpenEscalationFlags } from "@/server/services/escalation/escalation-rules.service";

export type AutomationDecisionType = "AUTO_REPLY" | "DRAFT_FOR_REVIEW" | "ESCALATE" | "WAIT";

export type AutomationDecision = {
  decision: AutomationDecisionType;
  reasons: string[];
};

type Input = {
  leadId: string;
  conversationId: string;
  intent: InboundIntentType;
  confidence: number;
};

function isQuietHours(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 21 || hour < 8;
}

export async function evaluateAutomationDecision(
  ctx: OrgContext,
  input: Input,
): Promise<AutomationDecision> {
  const reasons: string[] = [];
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    include: { strengthSignal: true },
  });
  if (!lead) return { decision: "WAIT", reasons: ["lead_not_found"] };

  if (await hasOpenEscalationFlags(ctx.organizationId, input.leadId)) {
    return { decision: "ESCALATE", reasons: ["open_escalation_flag"] };
  }
  if (lead.automationPaused) {
    return { decision: "WAIT", reasons: ["automation_paused"] };
  }
  if (lead.inboxStage === LeadInboxStage.NEEDS_HUMAN_REVIEW) {
    return { decision: "ESCALATE", reasons: ["needs_human_review_stage"] };
  }
  if (!lead.email?.trim() && !lead.phone?.trim()) {
    return { decision: "ESCALATE", reasons: ["no_deliverable_channel"] };
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: ctx.organizationId },
    select: { replyMode: true },
  });
  if (!conversation) return { decision: "WAIT", reasons: ["conversation_not_found"] };
  if (conversation.replyMode === "MANUAL_ONLY") {
    return { decision: "DRAFT_FOR_REVIEW", reasons: ["manual_only_reply_mode"] };
  }

  const lastInbound = await prisma.message.findFirst({
    where: { conversationId: input.conversationId, direction: "INBOUND" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  const outboundSinceInbound = await prisma.message.count({
    where: {
      conversationId: input.conversationId,
      direction: "OUTBOUND",
      ...(lastInbound ? { sentAt: { gte: lastInbound.sentAt } } : {}),
    },
  });
  if (outboundSinceInbound >= 2) {
    return { decision: "WAIT", reasons: ["outbound_limit_reached"] };
  }

  if (input.intent === "ACKNOWLEDGMENT") {
    return { decision: "WAIT", reasons: ["low_signal_acknowledgment"] };
  }

  if (input.intent === "SENSITIVE" || input.intent === "COMPLAINT") {
    return { decision: "ESCALATE", reasons: ["sensitive_or_complaint_intent"] };
  }

  if (input.confidence < 0.4) {
    return { decision: "ESCALATE", reasons: ["low_model_confidence"] };
  }

  if (isQuietHours()) {
    reasons.push("quiet_hours");
  }

  const tier = lead.strengthSignal?.strengthTier ?? LeadStrengthTier.UNCERTAIN;
  if (tier === LeadStrengthTier.DISQUALIFIED || tier === LeadStrengthTier.WEAK) {
    return { decision: "DRAFT_FOR_REVIEW", reasons: ["weak_or_disqualified_strength", ...reasons] };
  }

  if (input.confidence >= 0.7 && !isQuietHours()) {
    return { decision: "AUTO_REPLY", reasons: ["high_confidence_safe_intent", `strength_tier=${tier}`] };
  }

  return { decision: "DRAFT_FOR_REVIEW", reasons: ["default_human_review_lane", ...reasons] };
}

