import type { Lead, Message } from "@prisma/client";

import { prisma } from "@/server/db/client";

export type EscalationRuleResult = {
  escalate: boolean;
  reason?: string;
};

/**
 * Deterministic rules before / alongside ML escalation.
 */
export function evaluateInboundEscalationRules(message: Message): EscalationRuleResult {
  const body = message.body.toLowerCase();
  if (!message.body.trim()) {
    return { escalate: true, reason: "empty_message" };
  }
  if (body.includes("lawyer") || body.includes("sue") || body.includes("discrimination")) {
    return { escalate: true, reason: "legal_or_policy" };
  }
  if (
    body.includes("angry") ||
    body.includes("terrible") ||
    body.includes("unacceptable") ||
    body.includes("worst")
  ) {
    return { escalate: true, reason: "upset_language" };
  }
  return { escalate: false };
}

export async function shouldEscalateForMissingContact(lead: Lead): Promise<EscalationRuleResult> {
  const hasEmail = !!lead.email?.trim();
  const hasPhone = !!lead.phone?.trim();
  if (!hasEmail && !hasPhone) {
    return { escalate: true, reason: "no_contact_channel" };
  }
  return { escalate: false };
}

export async function hasOpenEscalationFlags(organizationId: string, leadId: string): Promise<boolean> {
  const n = await prisma.aIEscalationFlag.count({
    where: {
      organizationId,
      leadId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
  });
  return n > 0;
}
