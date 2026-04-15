import {
  QUALIFICATION_KEYS,
  QUALIFICATION_QUESTIONS,
  type QualificationKey,
} from "@/domains/leasing/qualification-keys";
import { prisma } from "@/server/db/client";

import { getQualificationCompleteness } from "./qualification-score.service";

/**
 * Returns the next single qualification question to ask (bounded sequence).
 */
export async function getNextQualificationPrompt(leadId: string): Promise<string | null> {
  const { missing } = await getQualificationCompleteness(leadId);
  const next = missing[0];
  if (!next) return null;
  return QUALIFICATION_QUESTIONS[next];
}

export async function getNextQualificationKey(leadId: string): Promise<QualificationKey | null> {
  const { missing } = await getQualificationCompleteness(leadId);
  return missing[0] ?? null;
}
