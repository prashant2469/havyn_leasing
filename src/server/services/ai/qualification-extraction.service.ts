/**
 * Qualification Extraction Service (V3)
 *
 * Scans conversation messages for qualification signals and upserts
 * QualificationAnswer rows tagged as AI_EXTRACTED.
 * Replace `_extractQualificationFields` with a real LLM structured-extraction call.
 */

import { QualificationAnswer } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { recordActivity } from "@/server/services/activity/activity.service";
import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

interface ExtractedField {
  key: string;
  value: string;
  label: string;
}

/**
 * Placeholder extractor — scans message text for common patterns.
 * Replace with a structured LLM extraction call.
 */
function _extractQualificationFields(messages: { body: string }[]): ExtractedField[] {
  const fullText = messages.map((m) => m.body).join("\n").toLowerCase();
  const extracted: ExtractedField[] = [];

  // Move-in date signals
  const moveInMatch = fullText.match(
    /(?:move[- ]?in|available|start).*?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i,
  );
  if (moveInMatch) {
    extracted.push({ key: "desiredMoveIn", value: moveInMatch[0], label: "Desired move-in" });
  }

  // Bedroom signals
  const bedroomMatch = fullText.match(/(\d)\s*(?:bed(?:room)?s?|br\b)/i);
  if (bedroomMatch) {
    extracted.push({ key: "bedrooms", value: bedroomMatch[1], label: "Bedrooms needed" });
  }

  // Budget signals
  const budgetMatch = fullText.match(/\$[\d,]+(?:\s*(?:\/mo|per month|a month))?|\bbudget\b.*?\$[\d,]+/i);
  if (budgetMatch) {
    extracted.push({
      key: "monthlyBudget",
      value: budgetMatch[0].replace(/[^0-9]/g, ""),
      label: "Monthly budget",
    });
  }

  // Pet signals
  if (/\b(have a|have|with|my)\s+(cat|dog|pet|kitten|puppy)/i.test(fullText)) {
    extracted.push({ key: "hasPets", value: "true", label: "Has pets" });
  } else if (/no pets|don't have a pet/i.test(fullText)) {
    extracted.push({ key: "hasPets", value: "false", label: "Has pets" });
  }

  // Occupant count
  const occupantMatch = fullText.match(/(\d+)\s*(?:people|person|occupants?|adults?|residents?)/i);
  if (occupantMatch) {
    extracted.push({ key: "occupants", value: occupantMatch[1], label: "Occupants" });
  }

  // Voucher / section 8 signals
  if (/section\s*8|housing choice|voucher/i.test(fullText)) {
    extracted.push({ key: "hasVoucher", value: "true", label: "Has housing voucher" });
  }

  return extracted;
}

export async function extractQualificationsFromConversation(
  ctx: OrgContext,
  conversationId: string,
): Promise<QualificationAnswer[]> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: ctx.organizationId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 20 },
      lead: { select: { id: true } },
    },
  });
  if (!conversation) throw new Error("Conversation not found");
  if (!conversation.leadId) throw new Error("Conversation has no lead");

  const fields = _extractQualificationFields(conversation.messages);
  if (fields.length === 0) return [];

  const upserted: QualificationAnswer[] = [];

  for (const field of fields) {
    const existing = await prisma.qualificationAnswer.findFirst({
      where: {
        leadId: conversation.leadId,
        key: field.key,
        source: "MANUAL",
      },
    });

    // Never overwrite a user-confirmed (MANUAL) value with AI extraction
    if (existing) continue;

    const qa = await prisma.qualificationAnswer.upsert({
      where: {
        leadId_key: { leadId: conversation.leadId, key: field.key },
      },
      update: {
        value: field.value,
        source: "AI_EXTRACTED",
        metadata: { label: field.label },
      },
      create: {
        leadId: conversation.leadId,
        key: field.key,
        value: field.value,
        source: "AI_EXTRACTED",
        metadata: { label: field.label },
      },
    });
    upserted.push(qa);
  }

  if (upserted.length > 0) {
    await recordActivity({
      ctx,
      verb: ActivityVerbs.AI_QUALIFICATION_EXTRACTED,
      entityType: "Lead",
      entityId: conversation.leadId,
      metadata: { fields: upserted.map((q) => q.key), count: upserted.length, conversationId },
    });
  }

  return upserted;
}
