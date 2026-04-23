import { ApplicationStatus, LeadInboxStage, LeadStatus, type Prisma } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity, type ActivitySourceContext } from "@/server/services/activity/activity.service";
import type {
  CreateApplicationInput,
  UpdateApplicationPipelineInput,
  UpdateApplicationStatusInput,
} from "@/server/validation/application";

export async function createApplication(ctx: OrgContext, input: CreateApplicationInput) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const application = await prisma.application.create({
    data: {
      leadId: input.leadId,
      payload: JSON.parse(JSON.stringify(input.payload ?? {})) as Prisma.InputJsonValue,
    },
  });

  await recordActivity({
    ctx,
    verb: "application.created",
    entityType: "Application",
    entityId: application.id,
    metadata: { leadId: lead.id },
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      applicationStartedAt: lead.applicationStartedAt ?? new Date(),
      inboxStage: LeadInboxStage.APPLICATION_STARTED,
      status:
        lead.status === LeadStatus.NEW ||
        lead.status === LeadStatus.CONTACTED ||
        lead.status === LeadStatus.TOURING
          ? LeadStatus.APPLIED
          : lead.status,
    },
  });

  return application;
}

export async function createPublicApplication(
  ctx: ActivitySourceContext,
  input: { leadId: string; payload?: Prisma.InputJsonValue },
) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!lead) throw new Error("Lead not found");

  const application = await prisma.application.create({
    data: {
      leadId: input.leadId,
      payload: JSON.parse(JSON.stringify(input.payload ?? {})) as Prisma.InputJsonValue,
    },
  });

  await recordActivity({
    ctx,
    verb: "application.created",
    entityType: "Application",
    entityId: application.id,
    metadata: { leadId: lead.id, source: "public_microsite" },
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      applicationStartedAt: lead.applicationStartedAt ?? new Date(),
      inboxStage: LeadInboxStage.APPLICATION_STARTED,
      status:
        lead.status === LeadStatus.NEW ||
        lead.status === LeadStatus.CONTACTED ||
        lead.status === LeadStatus.TOURING
          ? LeadStatus.APPLIED
          : lead.status,
    },
  });

  return application;
}

export async function updateApplicationStatus(ctx: OrgContext, input: UpdateApplicationStatusInput) {
  const app = await prisma.application.findFirst({
    where: { id: input.applicationId, lead: { organizationId: ctx.organizationId } },
    include: { lead: { select: { id: true, status: true, inboxStage: true } } },
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

  if (updated.status === ApplicationStatus.APPROVED) {
    await prisma.lead.update({
      where: { id: app.leadId },
      data: {
        inboxStage: LeadInboxStage.APPLICATION_STARTED,
        status:
          app.lead.status === LeadStatus.NEW ||
          app.lead.status === LeadStatus.CONTACTED ||
          app.lead.status === LeadStatus.TOURING
            ? LeadStatus.APPLIED
            : app.lead.status,
      },
    });
  }

  return updated;
}

export async function mergeApplicationPipelineFields(
  ctx: OrgContext,
  input: UpdateApplicationPipelineInput,
) {
  const app = await prisma.application.findFirst({
    where: { id: input.applicationId, lead: { organizationId: ctx.organizationId } },
  });
  if (!app) throw new Error("Application not found");

  const prev = (app.payload && typeof app.payload === "object" && !Array.isArray(app.payload)
    ? app.payload
    : {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...prev };

  if (input.waitingOn === "prospect" || input.waitingOn === "internal") {
    next.waitingOn = input.waitingOn;
  } else if (input.waitingOn === "") {
    delete next.waitingOn;
  }

  if (input.pipelineNote !== undefined) {
    const t = input.pipelineNote.trim();
    if (t) next.pipelineNote = t;
    else delete next.pipelineNote;
  }

  const updated = await prisma.application.update({
    where: { id: input.applicationId },
    data: { payload: JSON.parse(JSON.stringify(next)) as Prisma.InputJsonValue },
  });

  await recordActivity({
    ctx,
    verb: "application.pipeline_updated",
    entityType: "Application",
    entityId: updated.id,
    metadata: { leadId: updated.leadId },
  });

  return updated;
}

export async function listApplicationsForOrg(ctx: OrgContext, status?: ApplicationStatus) {
  return prisma.application.findMany({
    where: {
      lead: { organizationId: ctx.organizationId },
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 150,
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          inboxStage: true,
        },
      },
    },
  });
}
