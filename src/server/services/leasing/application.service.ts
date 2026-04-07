import type { Prisma } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type { CreateApplicationInput, UpdateApplicationStatusInput } from "@/server/validation/application";

export async function createApplication(ctx: OrgContext, input: CreateApplicationInput) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const application = await prisma.application.create({
    data: {
      leadId: input.leadId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });

  await recordActivity({
    ctx,
    verb: "application.created",
    entityType: "Application",
    entityId: application.id,
    metadata: { leadId: lead.id },
  });

  return application;
}

export async function updateApplicationStatus(ctx: OrgContext, input: UpdateApplicationStatusInput) {
  const app = await prisma.application.findFirst({
    where: { id: input.applicationId, lead: { organizationId: ctx.organizationId } },
  });
  if (!app) throw new Error("Application not found");

  const updated = await prisma.application.update({
    where: { id: input.applicationId },
    data: { status: input.status },
  });

  await recordActivity({
    ctx,
    verb: "application.status_changed",
    entityType: "Application",
    entityId: updated.id,
    payloadBefore: { status: app.status },
    payloadAfter: { status: updated.status },
  });

  return updated;
}
