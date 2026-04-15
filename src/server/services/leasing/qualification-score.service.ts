import { prisma } from "@/server/db/client";

import {
  QUALIFICATION_KEYS,
  type QualificationKey,
} from "@/domains/leasing/qualification-keys";

export type QualificationScoreResult = {
  complete: number;
  total: number;
  score: number;
  missing: QualificationKey[];
};

export async function getQualificationCompleteness(leadId: string): Promise<QualificationScoreResult> {
  const answers = await prisma.qualificationAnswer.findMany({
    where: { leadId },
    select: { key: true },
  });
  const have = new Set(answers.map((a) => a.key));
  const missing: QualificationKey[] = [];
  for (const k of QUALIFICATION_KEYS) {
    if (!have.has(k)) missing.push(k);
  }
  const complete = QUALIFICATION_KEYS.length - missing.length;
  return {
    complete,
    total: QUALIFICATION_KEYS.length,
    score: complete / QUALIFICATION_KEYS.length,
    missing,
  };
}
