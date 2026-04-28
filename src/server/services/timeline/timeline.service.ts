import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import type { TimelineEntry } from "@/domains/timeline/types";

/**
 * Lead timeline as a merged, descending feed of messages + key ops events.
 */
export async function getLeadTimeline(
  ctx: OrgContext,
  leadId: string,
  opts?: { take?: number },
): Promise<TimelineEntry[]> {
  const take = opts?.take ?? 200;
  const [conversation, activities, tours, applications, qualifications] = await Promise.all([
    prisma.conversation.findFirst({
      where: { organizationId: ctx.organizationId, leadId },
      select: {
        messages: {
          orderBy: { sentAt: "desc" },
          take,
          select: {
            id: true,
            direction: true,
            channel: true,
            body: true,
            sentAt: true,
            authorType: true,
          },
        },
      },
    }),
    prisma.activityEvent.findMany({
      where: { organizationId: ctx.organizationId, entityType: "Lead", entityId: leadId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, verb: true, createdAt: true },
    }),
    prisma.tour.findMany({
      where: { leadId, lead: { organizationId: ctx.organizationId } },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, status: true, scheduledAt: true, notes: true, createdAt: true },
    }),
    prisma.application.findMany({
      where: { leadId, lead: { organizationId: ctx.organizationId } },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, status: true, updatedAt: true },
    }),
    prisma.qualificationAnswer.findMany({
      where: { leadId, lead: { organizationId: ctx.organizationId } },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, key: true, source: true, value: true, updatedAt: true },
    }),
  ]);

  const entries: TimelineEntry[] = [];

  for (const m of conversation?.messages ?? []) {
    entries.push({
      id: `msg_${m.id}`,
      type: "message",
      at: m.sentAt.toISOString(),
      messageId: m.id,
      direction: m.direction,
      channel: m.channel,
      authorType: m.authorType,
      body: m.body,
    });
  }
  for (const a of activities) {
    entries.push({
      id: `act_${a.id}`,
      type: "activity",
      at: a.createdAt.toISOString(),
      activityId: a.id,
      verb: a.verb,
    });
  }
  for (const t of tours) {
    entries.push({
      id: `tour_${t.id}`,
      type: "tour",
      at: t.createdAt.toISOString(),
      tourId: t.id,
      status: t.status,
      scheduledAt: t.scheduledAt.toISOString(),
      notes: t.notes,
    });
  }
  for (const a of applications) {
    entries.push({
      id: `app_${a.id}`,
      type: "application",
      at: a.updatedAt.toISOString(),
      applicationId: a.id,
      status: a.status,
    });
  }
  for (const q of qualifications) {
    entries.push({
      id: `qual_${q.id}`,
      type: "qualification",
      at: q.updatedAt.toISOString(),
      key: q.key,
      source: q.source,
      value: q.value,
    });
  }

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, take);
}
