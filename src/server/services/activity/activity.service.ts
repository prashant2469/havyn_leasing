import type { InputJsonValue } from "@prisma/client/runtime/library";

import { prisma } from "@/server/db/client";
import type { OrgContext } from "@/server/auth/context";

/**
 * Append-only activity log. Call from domain services after successful writes.
 * TODO: emit same payload to a queue (e.g. Temporal, Inngest) for webhooks / analytics.
 */
export type RecordActivityInput = {
  ctx: OrgContext;
  verb: string;
  entityType: string;
  entityId: string;
  metadata?: InputJsonValue;
  payloadBefore?: InputJsonValue | null;
  payloadAfter?: InputJsonValue | null;
  correlationId?: string | null;
};

export async function recordActivity(input: RecordActivityInput) {
  const { ctx, ...rest } = input;
  return prisma.activityEvent.create({
    data: {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      verb: rest.verb,
      entityType: rest.entityType,
      entityId: rest.entityId,
      metadata: rest.metadata ?? {},
      payloadBefore: rest.payloadBefore ?? undefined,
      payloadAfter: rest.payloadAfter ?? undefined,
      correlationId: rest.correlationId ?? undefined,
    },
  });
}

/** Alias for readability at call sites. */
export const logActivity = recordActivity;

export async function listActivityForEntity(
  ctx: OrgContext,
  entityType: string,
  entityId: string,
) {
  return prisma.activityEvent.findMany({
    where: { organizationId: ctx.organizationId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}

export async function listRecentActivity(ctx: OrgContext, take = 50) {
  return prisma.activityEvent.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}
