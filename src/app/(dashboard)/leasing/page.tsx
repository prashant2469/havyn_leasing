import { ApplicationStatus, LeadInboxStage, LeadStatus, TourStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";

function prettyInt(v: number) {
  return new Intl.NumberFormat().format(v);
}

export default async function LeasingWorkspacePage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    leadCount,
    activeQueueCount,
    newPipelineCount,
    overdueNextActionCount,
    openApplicationsCount,
    upcomingToursCount,
    noFirstReplyCount,
  ] = await Promise.all([
    prisma.lead.count({ where: { organizationId: ctx.organizationId } }),
    prisma.lead.count({
      where: {
        organizationId: ctx.organizationId,
        inboxStage: {
          in: [
            LeadInboxStage.NEW_INQUIRY,
            LeadInboxStage.NEW_LEADS,
            LeadInboxStage.AWAITING_RESPONSE,
            LeadInboxStage.TOUR_SCHEDULED,
            LeadInboxStage.APPLICATION_STARTED,
            LeadInboxStage.NEEDS_HUMAN_REVIEW,
          ],
        },
      },
    }),
    prisma.lead.count({
      where: {
        organizationId: ctx.organizationId,
        inboxStage: { in: [LeadInboxStage.NEW_INQUIRY, LeadInboxStage.NEW_LEADS] },
      },
    }),
    prisma.lead.count({
      where: {
        organizationId: ctx.organizationId,
        nextActionAt: { lt: now },
        status: { notIn: [LeadStatus.CONVERTED, LeadStatus.LOST] },
      },
    }),
    prisma.application.count({
      where: {
        lead: { organizationId: ctx.organizationId },
        status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.IN_REVIEW] },
      },
    }),
    prisma.tour.count({
      where: {
        lead: { organizationId: ctx.organizationId },
        status: TourStatus.SCHEDULED,
        scheduledAt: { gte: now, lte: weekAhead },
      },
    }),
    prisma.lead.count({
      where: {
        organizationId: ctx.organizationId,
        firstResponseAt: null,
        status: { notIn: [LeadStatus.CONVERTED, LeadStatus.LOST] },
      },
    }),
  ]);

  const cards = [
    {
      title: "Inbox",
      href: "/leasing/inbox",
      value: prettyInt(activeQueueCount),
      description: `${prettyInt(newPipelineCount)} new (no org message yet) · ${prettyInt(noFirstReplyCount)} with no first outbound message`,
      action: "Open inbox",
    },
    {
      title: "Leads",
      href: "/leasing/leads",
      value: prettyInt(leadCount),
      description: `${prettyInt(overdueNextActionCount)} overdue next actions`,
      action: "View leads",
    },
    {
      title: "Applications",
      href: "/leasing/applications",
      value: prettyInt(openApplicationsCount),
      description: "Submitted or in-review applications",
      action: "Open applications",
    },
    {
      title: "Tours",
      href: "/tours",
      value: prettyInt(upcomingToursCount),
      description: "Scheduled in the next 7 days",
      action: "Open tours",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leasing workspace"
        description="Consolidated daily operating view for inbox, leads, applications, and tours."
        actions={
          <Link href="/analysis" className={buttonVariants()}>
            Open analysis
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold tabular-nums">{card.value}</p>
              <Link href={card.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                {card.action}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
