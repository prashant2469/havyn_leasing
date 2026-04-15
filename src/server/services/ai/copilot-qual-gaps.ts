import { QUALIFICATION_QUESTIONS, type QualificationKey } from "@/domains/leasing/qualification-keys";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";

/** Human-readable gap lines aligned with V4 qualification keys and completeness scoring. */
export async function qualificationGapLabelsForLead(leadId: string): Promise<string[]> {
  const { missing } = await getQualificationCompleteness(leadId);
  return missing.map((k: QualificationKey) => QUALIFICATION_QUESTIONS[k] ?? `Missing: ${k}`);
}
