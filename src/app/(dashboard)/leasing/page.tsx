import { LeadInboxStage, LeadStatus, TourStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { listRecentActivity } from "@/server/services/activity/activity.service";
import { inboxStageLabel } from "@/domains/leasing/inbox";

function prettyInt(v: number) {
  return new Intl.NumberFormat().format(v);
}

export default async function LeasingWorkspacePage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const firstReplyStale = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const [overdueLeads, unansweredLeads, escalations, todaysTours, tomorrowTours, stageSnapshot, recentActivity] =
    await Promise.all([
      prisma.lead.findMany({
        where: {
          organizationId: ctx.organizationId,
          nextActionAt: { lt: now },
          status: { notIn: [LeadStatus.CONVERTED, LeadStatus.LOST] },
        },
        orderBy: { nextActionAt: "asc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nextActionAt: true,
          nextActionType: true,
          inboxStage: true,
        },
      }),
      prisma.lead.findMany({
        where: {
          organizationId: ctx.organizationId,
          firstResponseAt: null,
          createdAt: { lte: firstReplyStale },
          status: { notIn: [LeadStatus.CONVERTED, LeadStatus.LOST] },
        },
        orderBy: { createdAt: "asc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          inboxStage: true,
        },
      }),
      prisma.lead.findMany({
        where: {
          organizationId: ctx.organizationId,
          inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW,
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          updatedAt: true,
        },
      }),
      prisma.tour.findMany({
        where: {
          lead: { organizationId: ctx.organizationId },
          status: TourStatus.SCHEDULED,
          scheduledAt: { gte: now, lt: tomorrow },
        },
        orderBy: { scheduledAt: "asc" },
        take: 30,
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
          listing: { select: { title: true } },
        },
      }),
      prisma.tour.findMany({
        where: {
          lead: { organizationId: ctx.organizationId },
          status: TourStatus.SCHEDULED,
          scheduledAt: { gte: tomorrow, lt: weekAhead },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
          listing: { select: { title: true } },
        },
      }),
      prisma.lead.groupBy({
        by: ["inboxStage"],
        where: { organizationId: ctx.organizationId },
        _count: { _all: true },
      }),
      listRecentActivity(ctx, 10),
    ]);

  const stageCounts = Object.fromEntries(
    stageSnapshot.map((s) => [s.inboxStage, s._count._all]),
  ) as Record<LeadInboxStage, number>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command center"
        description="Run daily leasing operations from one place: triage, tours, stage health, and activity."
        actions={
          <Link href="/leasing/inbox" className={buttonVariants()}>
            Open pipeline board
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Right now</CardTitle>
            <CardDescription>Leads that need immediate attention.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <section className="rounded-md border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Overdue follow-ups
              </p>
              <p className="mt-1 text-2xl font-semibold">{prettyInt(overdueLeads.length)}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {overdueLeads.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link href={`/leasing/inbox?leadId=${l.id}`} className="hover:underline">
                      {l.firstName} {l.lastName}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      · {l.nextActionAt ? new Date(l.nextActionAt).toLocaleString() : "no due date"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unanswered inquiries (&gt;2h)
              </p>
              <p className="mt-1 text-2xl font-semibold">{prettyInt(unansweredLeads.length)}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {unansweredLeads.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link href={`/leasing/inbox?leadId=${l.id}`} className="hover:underline">
                      {l.firstName} {l.lastName}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      · {new Date(l.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Human review queue
              </p>
              <p className="mt-1 text-2xl font-semibold">{prettyInt(escalations.length)}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {escalations.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link href={`/leasing/inbox?leadId=${l.id}`} className="hover:underline">
                      {l.firstName} {l.lastName}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline snapshot</CardTitle>
            <CardDescription>Stage health at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.values(LeadInboxStage).map((stage) => (
              <Link
                key={stage}
                href="/leasing/inbox"
                className="flex items-center justify-between rounded-md border px-2 py-1.5 hover:bg-muted/40"
              >
                <span className="text-xs">{inboxStageLabel[stage]}</span>
                <span className="font-semibold tabular-nums">{prettyInt(stageCounts[stage] ?? 0)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's tours</CardTitle>
            <CardDescription>
              {todaysTours.length === 0 ? "No scheduled tours today." : "Click a tour to open lead workspace in-board."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaysTours.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tours scheduled today.</p>
            ) : (
              todaysTours.map((tour) => (
                <Link
                  key={tour.id}
                  href={`/leasing/inbox?leadId=${tour.leadId}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span>
                    {tour.lead.firstName} {tour.lead.lastName}
                    <span className="block text-xs text-muted-foreground">{tour.listing?.title ?? "No listing"}</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {new Date(tour.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </Link>
              ))
            )}
            {tomorrowTours.length > 0 ? (
              <p className="pt-2 text-xs text-muted-foreground">
                Tomorrow up next: {tomorrowTours[0]?.lead.firstName} {tomorrowTours[0]?.lead.lastName} at{" "}
                {new Date(tomorrowTours[0]!.scheduledAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Latest operational events across leasing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.map((event) => (
              <div key={event.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-mono text-xs">{event.verb}</p>
                <p className="text-xs text-muted-foreground">
                  {event.entityType} · {new Date(event.createdAt).toLocaleString()}
                </p>
                {event.entityType === "Lead" ? (
                  <Link
                    href={`/leasing/inbox?leadId=${event.entityId}`}
                    className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0 text-xs")}
                  >
                    Open lead
                  </Link>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
