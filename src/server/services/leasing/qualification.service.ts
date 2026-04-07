import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import type { Prisma } from "@prisma/client";
import { QualificationSource } from "@prisma/client";

export async function upsertQualificationAnswer(
  ctx: OrgContext,
  input: { leadId: string; key: string; value: Prisma.InputJsonValue; source?: QualificationSource },
) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const row = await prisma.qualificationAnswer.upsert({
    where: { leadId_key: { leadId: input.leadId, key: input.key } },
    create: {
      leadId: input.leadId,
      key: input.key,
      value: input.value,
      source: input.source ?? QualificationSource.MANUAL,
    },
    update: {
      value: input.value,
      source: input.source ?? QualificationSource.MANUAL,
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.QUALIFICATION_CAPTURED,
    entityType: "QualificationAnswer",
    entityId: row.id,
    metadata: { leadId: input.leadId, key: input.key },
  });

  return row;
}
