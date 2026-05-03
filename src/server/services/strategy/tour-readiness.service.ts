import { LeadStrengthTier, TourStatus } from "@prisma/client";
import { addDays } from "date-fns";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { getQualificationCompleteness, type QualificationScoreResult } from "@/server/services/leasing/qualification-score.service";
import { getBusyRangesForProperty } from "@/server/services/tours/availability.service";
import { generateAvailableTourSlots } from "@/server/services/tours/slot-generator.service";

export type TourBlocker =
  | { type: "INCOMPLETE_QUALIFICATION"; missing: QualificationScoreResult["missing"] }
  | { type: "BUDGET_MISMATCH"; ratio: number | null }
  | { type: "NO_AVAILABLE_SLOTS"; propertyId: string }
  | { type: "WEAK_SIGNAL"; strengthTier: LeadStrengthTier }
  | { type: "PENDING_ESCALATION" };

export type TourReadinessResult = {
  isReady: boolean;
  readinessScore: number;
  blockers: TourBlocker[];
  qualifiedListings: Array<{ listingId: string; score: number; hasSlots: boolean }>;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

async function hasSlotsNext7Days(input: {
  organizationId: string;
  propertyId: string;
  schedule: unknown;
}): Promise<boolean> {
  const now = new Date();
  const busy = await getBusyRangesForProperty(
    input.organizationId,
    input.propertyId,
    now,
    addDays(now, 7),
  );
  return generateAvailableTourSlots(input.schedule, now, 3, busy).length > 0;
}

export async function computeTourReadiness(
  ctx: OrgContext,
  leadId: string,
): Promise<TourReadinessResult> {
  const [lead, strength, qual] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: leadId, organizationId: ctx.organizationId },
      include: {
        escalationFlags: {
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          select: { id: true },
          take: 1,
        },
        listing: {
          include: {
            unit: {
              include: { property: true },
            },
          },
        },
        tours: {
          where: { status: TourStatus.SCHEDULED },
          orderBy: { scheduledAt: "asc" },
          take: 1,
        },
      },
    }),
    prisma.leadStrengthSignal.findUnique({ where: { leadId } }),
    getQualificationCompleteness(leadId),
  ]);
  if (!lead || !strength) {
    return {
      isReady: false,
      readinessScore: 0,
      blockers: [{ type: "WEAK_SIGNAL", strengthTier: "DISQUALIFIED" }],
      qualifiedListings: [],
    };
  }

  const blockers: TourBlocker[] = [];
  if (lead.escalationFlags?.length) blockers.push({ type: "PENDING_ESCALATION" });
  if (qual.score < 0.5) blockers.push({ type: "INCOMPLETE_QUALIFICATION", missing: qual.missing });
  if (strength.financialFitScore < 0.5) {
    blockers.push({ type: "BUDGET_MISMATCH", ratio: strength.budgetToRentRatio ?? null });
  }
  if (
    strength.strengthTier !== LeadStrengthTier.STRONG &&
    strength.strengthTier !== LeadStrengthTier.PROMISING
  ) {
    blockers.push({ type: "WEAK_SIGNAL", strengthTier: strength.strengthTier });
  }

  const listings = await prisma.propertyRecommendation.findMany({
    where: { leadId, lead: { organizationId: ctx.organizationId } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    include: {
      listing: {
        include: {
          unit: {
            include: { property: true },
          },
        },
      },
    },
    take: 10,
  });

  const candidates = [
    ...(lead.listing
      ? [
          {
            listingId: lead.listing.id,
            score: lead.listingId
              ? (listings.find((r) => r.listingId === lead.listingId)?.score ?? 0.6)
              : 0.6,
            listing: lead.listing,
          },
        ]
      : []),
    ...listings.map((r) => ({ listingId: r.listingId, score: r.score, listing: r.listing })),
  ];

  const unique = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    if (!unique.has(c.listingId)) unique.set(c.listingId, c);
  }

  const qualifiedListings: TourReadinessResult["qualifiedListings"] = [];
  for (const c of unique.values()) {
    const propertyId = c.listing.unit.propertyId;
    const hasSlots = await hasSlotsNext7Days({
      organizationId: ctx.organizationId,
      propertyId,
      schedule: c.listing.unit.property.showingSchedule,
    });
    qualifiedListings.push({ listingId: c.listingId, score: c.score, hasSlots });
  }

  const hasAnySlots = qualifiedListings.some((q) => q.hasSlots);
  if (!hasAnySlots && lead.listing?.unit.propertyId) {
    blockers.push({ type: "NO_AVAILABLE_SLOTS", propertyId: lead.listing.unit.propertyId });
  }

  const readinessScore = clamp01(
    strength.overallScore * 0.4 + qual.score * 0.3 + strength.financialFitScore * 0.3,
  );
  const isReady =
    blockers.length === 0 &&
    !lead.tours.length &&
    readinessScore >= 0.55 &&
    hasAnySlots;

  return {
    isReady,
    readinessScore,
    blockers,
    qualifiedListings: qualifiedListings.sort((a, b) => b.score - a.score),
  };
}
