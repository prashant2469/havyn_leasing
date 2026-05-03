import {
  type AIReplyDraftStatus,
  type LeadInboxStage,
  type LeadPriorityTier,
  type LeadStatus,
  type LeadStrengthTier,
  NextActionType,
  TourStatus,
} from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import type {
  CreateLeadInput,
  UpdateLeadContactInput,
  UpdateLeadInboxStageInput,
  UpdateLeadStatusInput,
} from "@/server/validation/lead";

/** Load listings by id in one query (avoids `include.listing` when Prisma client is out of sync). */
async function listingSummaryMap(
  ctx: OrgContext,
  listingIds: string[],
): Promise<Map<string, { id: string; title: string; status: string }>> {
  const unique = [...new Set(listingIds)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await prisma.listing.findMany({
    where: { organizationId: ctx.organizationId, id: { in: unique } },
    select: { id: true, title: true, status: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Copilot / inbox signals are loaded in separate queries so list endpoints do not rely on
 * nested `Lead` includes. Matches `getLeadById` and avoids Prisma client drift when
 * `prisma generate` was not re-run after schema changes (unknown include field errors).
 */
async function hydrateLeadListCopilotFields<T extends { id: string; listingId: string | null }>(
  ctx: OrgContext,
  leads: T[],
): Promise<
  Array<
    T & {
      prioritySignal: {
        priorityTier: LeadPriorityTier;
        isAtRisk: boolean;
        needsImmediateResponse: boolean;
      } | null;
      strengthSignal: {
        strategyBucket: import("@prisma/client").LeadStrategyBucket;
        strengthTier: LeadStrengthTier;
        overallScore: number;
      } | null;
      replyDrafts: { id: string; status: AIReplyDraftStatus }[];
      escalationFlags: { id: string }[];
    }
  >
> {
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length === 0) {
    return leads.map((l) => ({
      ...l,
      prioritySignal: null,
      strengthSignal: null,
      replyDrafts: [] as { id: string; status: AIReplyDraftStatus }[],
      escalationFlags: [] as { id: string }[],
    }));
  }

  const [priorities, strengths, drafts, flags] = await Promise.all([
    prisma.leadPrioritySignal.findMany({
      where: { organizationId: ctx.organizationId, leadId: { in: leadIds } },
      select: { leadId: true, priorityTier: true, isAtRisk: true, needsImmediateResponse: true },
    }),
    prisma.leadStrengthSignal.findMany({
      where: { organizationId: ctx.organizationId, leadId: { in: leadIds } },
      select: { leadId: true, strategyBucket: true, strengthTier: true, overallScore: true },
    }),
    prisma.aIReplyDraft.findMany({
      where: {
        organizationId: ctx.organizationId,
        leadId: { in: leadIds },
        status: { in: ["SUGGESTED", "APPROVED"] },
      },
      select: { leadId: true, id: true, status: true, generatedAt: true },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.aIEscalationFlag.findMany({
      where: {
        organizationId: ctx.organizationId,
        leadId: { in: leadIds },
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      select: { leadId: true, id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const priorityByLead = new Map(
    priorities.map((p) => [
      p.leadId,
      {
        priorityTier: p.priorityTier,
        isAtRisk: p.isAtRisk,
        needsImmediateResponse: p.needsImmediateResponse,
      },
    ]),
  );
  const strengthByLead = new Map(
    strengths.map((s) => [
      s.leadId,
      {
        strategyBucket: s.strategyBucket,
        strengthTier: s.strengthTier,
        overallScore: s.overallScore,
      },
    ]),
  );

  const draftByLead = new Map<string, { id: string; status: AIReplyDraftStatus }[]>();
  for (const d of drafts) {
    if (draftByLead.has(d.leadId)) continue;
    draftByLead.set(d.leadId, [{ id: d.id, status: d.status }]);
  }

  const flagByLead = new Map<string, { id: string }[]>();
  for (const f of flags) {
    if (flagByLead.has(f.leadId)) continue;
    flagByLead.set(f.leadId, [{ id: f.id }]);
  }

  return leads.map((l) => ({
    ...l,
    prioritySignal: priorityByLead.get(l.id) ?? null,
    strengthSignal: strengthByLead.get(l.id) ?? null,
    replyDrafts: draftByLead.get(l.id) ?? [],
    escalationFlags: flagByLead.get(l.id) ?? [],
  }));
}

type LeadListOptions = {
  take?: number;
  cursorId?: string | null;
};

export async function listLeads(ctx: OrgContext, options?: LeadListOptions) {
  const take = Math.min(Math.max(options?.take ?? 50, 1), 200);
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(options?.cursorId ? { id: { lt: options.cursorId } } : {}),
    },
    orderBy: { id: "desc" },
    take,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      property: { select: { id: true, name: true } },
      primaryUnit: { select: { id: true, unitNumber: true } },
      tours: {
        where: { status: TourStatus.SCHEDULED },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { id: true, scheduledAt: true, status: true },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
      _count: {
        select: { recommendations: true },
      },
    },
  });
  const withSignals = await hydrateLeadListCopilotFields(ctx, leads);
  const map = await listingSummaryMap(
    ctx,
    withSignals.map((l) => l.listingId).filter((id): id is string => id != null),
  );
  return withSignals.map((l) => ({
    ...l,
    listing: l.listingId ? (map.get(l.listingId) ?? null) : null,
  }));
}

export async function listLeadsByInboxStages(
  ctx: OrgContext,
  stages: LeadInboxStage[],
  options?: LeadListOptions,
) {
  if (stages.length === 0) return [];
  const take = Math.min(Math.max(options?.take ?? 50, 1), 200);
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: ctx.organizationId,
      inboxStage: { in: stages },
      ...(options?.cursorId ? { id: { lt: options.cursorId } } : {}),
    },
    orderBy: { id: "desc" },
    take,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      primaryUnit: { select: { id: true, unitNumber: true } },
      tours: {
        where: { status: TourStatus.SCHEDULED },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { id: true, scheduledAt: true, status: true },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
      _count: {
        select: { recommendations: true },
      },
    },
  });
  const withSignals = await hydrateLeadListCopilotFields(ctx, leads);
  const map = await listingSummaryMap(
    ctx,
    withSignals.map((l) => l.listingId).filter((id): id is string => id != null),
  );
  return withSignals.map((l) => ({
    ...l,
    listing: l.listingId ? (map.get(l.listingId) ?? null) : null,
  }));
}

export async function listLeadsByInboxStage(
  ctx: OrgContext,
  stage: LeadInboxStage,
  options?: LeadListOptions,
) {
  return listLeadsByInboxStages(ctx, [stage], options);
}

/**
 * Load lead + related rows via FKs only (no `include` on Lead relations).
 * Stale Prisma clients sometimes omit relations like `qualifications` or `listing` even when the DB matches schema.
 */
export async function getLeadById(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
  });
  if (!lead) return null;

  const [
    assignedTo,
    property,
    primaryUnit,
    tours,
    applications,
    qualifications,
    listing,
  ] = await Promise.all([
    lead.assignedToUserId
      ? prisma.user.findFirst({
          where: { id: lead.assignedToUserId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    lead.propertyId
      ? prisma.property.findFirst({
          where: { id: lead.propertyId, organizationId: ctx.organizationId },
        })
      : Promise.resolve(null),
    lead.primaryUnitId
      ? prisma.unit.findFirst({
          where: {
            id: lead.primaryUnitId,
            property: { organizationId: ctx.organizationId },
          },
        })
      : Promise.resolve(null),
    prisma.tour.findMany({
      where: { leadId: lead.id },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.application.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      include: { lease: { select: { id: true, status: true } } },
    }),
    prisma.qualificationAnswer.findMany({
      where: { leadId: lead.id },
      orderBy: { key: "asc" },
    }),
    lead.listingId
      ? prisma.listing.findFirst({
          where: { id: lead.listingId, organizationId: ctx.organizationId },
          include: {
            unit: { include: { property: true } },
            organization: { select: { slug: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    ...lead,
    assignedTo,
    property,
    primaryUnit,
    tours,
    applications,
    qualifications,
    listing,
  };
}

export async function createLead(ctx: OrgContext, input: CreateLeadInput) {
  if (input.propertyId) {
    const p = await prisma.property.findFirst({
      where: { id: input.propertyId, organizationId: ctx.organizationId },
    });
    if (!p) throw new Error("Property not found");
  }
  if (input.primaryUnitId) {
    const u = await prisma.unit.findFirst({
      where: {
        id: input.primaryUnitId,
        property: { organizationId: ctx.organizationId },
      },
    });
    if (!u) throw new Error("Unit not found");
  }
  if (input.listingId) {
    const l = await prisma.listing.findFirst({
      where: { id: input.listingId, organizationId: ctx.organizationId },
    });
    if (!l) throw new Error("Listing not found");
  }

  const lead = await prisma.lead.create({
    data: {
      organizationId: ctx.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source || null,
      propertyId: input.propertyId ?? null,
      primaryUnitId: input.primaryUnitId ?? null,
      listingId: input.listingId ?? null,
      assignedToUserId: ctx.userId,
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LEAD_CREATED,
    entityType: "Lead",
    entityId: lead.id,
    payloadAfter: { name: `${lead.firstName} ${lead.lastName}`, inboxStage: lead.inboxStage },
  });

  return lead;
}

const allowedLeadTransitions: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["TOURING", "APPLIED", "LOST"],
  TOURING: ["APPLIED", "CONTACTED", "LOST"],
  APPLIED: ["CONVERTED", "LOST"],
  CONVERTED: [],
  LOST: ["NEW"],
};

export async function updateLeadStatus(ctx: OrgContext, input: UpdateLeadStatusInput) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const allowed = allowedLeadTransitions[existing.status] ?? [];
  if (input.status !== existing.status && !allowed.includes(input.status)) {
    throw new Error(`Invalid lead status transition ${existing.status} → ${input.status}`);
  }

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      status: input.status,
      nextActionAt: input.nextActionAt ?? undefined,
      nextActionType: input.nextActionType ?? undefined,
    },
  });

  await logActivity({
    ctx,
    verb: "lead.status_changed",
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: { status: existing.status },
    payloadAfter: { status: updated.status, nextActionAt: updated.nextActionAt },
  });

  return updated;
}

export async function updateLeadInboxStage(ctx: OrgContext, input: UpdateLeadInboxStageInput) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: { inboxStage: input.inboxStage },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: { inboxStage: existing.inboxStage },
    payloadAfter: { inboxStage: updated.inboxStage },
  });

  return updated;
}

export async function updateLeadContact(ctx: OrgContext, input: UpdateLeadContactInput) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email?.trim() ? input.email.trim() : null,
      phone: input.phone?.trim() ? input.phone.trim() : null,
    },
  });

  await logActivity({
    ctx,
    verb: "lead.contact_updated",
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: {
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      phone: existing.phone,
    },
    payloadAfter: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
    },
  });

  return updated;
}

export async function advanceLeadPipeline(
  ctx: OrgContext,
  input: {
    leadId: string;
    status?: LeadStatus;
    inboxStage?: LeadInboxStage;
    nextActionAt?: Date | null;
    nextActionType?: NextActionType | null;
    automationPaused?: boolean;
  },
) {
  const existing = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Lead not found");

  const updated = await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.inboxStage ? { inboxStage: input.inboxStage } : {}),
      ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt } : {}),
      ...(input.nextActionType !== undefined
        ? { nextActionType: input.nextActionType ?? null }
        : {}),
      ...(input.automationPaused !== undefined
        ? { automationPaused: input.automationPaused }
        : {}),
    },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.LEAD_INBOX_STAGE_CHANGED,
    entityType: "Lead",
    entityId: updated.id,
    payloadBefore: {
      status: existing.status,
      inboxStage: existing.inboxStage,
      automationPaused: existing.automationPaused,
    },
    payloadAfter: {
      status: updated.status,
      inboxStage: updated.inboxStage,
      automationPaused: updated.automationPaused,
    },
  });

  return updated;
}
