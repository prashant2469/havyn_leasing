import { LeadStatus, type LeadInboxStage, type ListingChannelType, TourStatus } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";

export const leasingMetricsRanges = [7, 30, 90] as const;
export type LeasingMetricsRange = (typeof leasingMetricsRanges)[number];

type StageDistributionRow = {
  stage: LeadInboxStage;
  count: number;
};

type ChannelPerformanceRow = {
  channel: ListingChannelType | "UNKNOWN";
  leads: number;
  responded: number;
  responseRate: number | null;
  converted: number;
  conversionRate: number | null;
};

export type LeasingMetrics = {
  rangeDays: LeasingMetricsRange;
  windowStart: Date;
  windowEnd: Date;
  kpis: {
    medianFirstResponseMinutes: number | null;
    medianFirstResponseHours: number | null;
    tourCompletionRate: number | null;
    toursCompleted: number;
    toursBooked: number;
    applicationToLeaseConversion: number | null;
    applications: number;
    convertedApplications: number;
  };
  stageDistribution: StageDistributionRow[];
  channelPerformance: ChannelPerformanceRow[];
  overdueNextActions: number;
};

function coerceRangeDays(rangeDays?: number): LeasingMetricsRange {
  if (!rangeDays) return 30;
  if (rangeDays <= 7) return 7;
  if (rangeDays >= 90) return 90;
  return 30;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export async function getLeasingMetrics(ctx: OrgContext, rangeDays?: number): Promise<LeasingMetrics> {
  const days = coerceRangeDays(rangeDays);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const [leads, tours, applications, overdueNextActions] = await Promise.all([
    prisma.lead.findMany({
      where: {
        organizationId: ctx.organizationId,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
        convertedAt: true,
        inboxStage: true,
        sourceChannelType: true,
      },
    }),
    prisma.tour.findMany({
      where: {
        lead: { organizationId: ctx.organizationId },
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
      select: { status: true },
    }),
    prisma.application.findMany({
      where: {
        lead: { organizationId: ctx.organizationId },
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        lease: { select: { id: true } },
      },
    }),
    prisma.lead.count({
      where: {
        organizationId: ctx.organizationId,
        nextActionAt: { lt: windowEnd },
        status: { notIn: [LeadStatus.CONVERTED, LeadStatus.LOST] },
      },
    }),
  ]);

  const firstResponseMinutes = leads
    .filter((lead) => lead.firstResponseAt != null)
    .map((lead) => (lead.firstResponseAt!.getTime() - lead.createdAt.getTime()) / (1000 * 60))
    .filter((minutes) => minutes >= 0);

  const medianFirstResponseMinutes = median(firstResponseMinutes);
  const medianFirstResponseHours =
    medianFirstResponseMinutes == null ? null : medianFirstResponseMinutes / 60;

  const toursBooked = tours.length;
  const toursCompleted = tours.filter((tour) => tour.status === TourStatus.COMPLETED).length;
  const tourCompletionRate = ratio(toursCompleted, toursBooked);

  const convertedApplications = applications.filter((app) => app.lease != null).length;
  const applicationToLeaseConversion = ratio(convertedApplications, applications.length);

  const stageMap = new Map<LeadInboxStage, number>();
  const channelMap = new Map<ListingChannelType | "UNKNOWN", ChannelPerformanceRow>();

  for (const lead of leads) {
    stageMap.set(lead.inboxStage, (stageMap.get(lead.inboxStage) ?? 0) + 1);

    const channel = lead.sourceChannelType ?? "UNKNOWN";
    const existing = channelMap.get(channel) ?? {
      channel,
      leads: 0,
      responded: 0,
      responseRate: null,
      converted: 0,
      conversionRate: null,
    };
    existing.leads += 1;
    if (lead.firstResponseAt) existing.responded += 1;
    if (lead.convertedAt) existing.converted += 1;
    channelMap.set(channel, existing);
  }

  const stageDistribution: StageDistributionRow[] = [...stageMap.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  const channelPerformance: ChannelPerformanceRow[] = [...channelMap.values()]
    .map((row) => ({
      ...row,
      responseRate: ratio(row.responded, row.leads),
      conversionRate: ratio(row.converted, row.leads),
    }))
    .sort((a, b) => b.leads - a.leads);

  return {
    rangeDays: days,
    windowStart,
    windowEnd,
    kpis: {
      medianFirstResponseMinutes,
      medianFirstResponseHours,
      tourCompletionRate,
      toursCompleted,
      toursBooked,
      applicationToLeaseConversion,
      applications: applications.length,
      convertedApplications,
    },
    stageDistribution,
    channelPerformance,
    overdueNextActions,
  };
}
