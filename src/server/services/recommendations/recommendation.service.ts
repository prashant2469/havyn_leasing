import { ListingStatus, RecommendationIntent, RecommendationStatus } from "@prisma/client";
import { addDays } from "date-fns";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import { scoreListing } from "@/server/services/recommendations/scoring";
import { getBusyRangesForProperty } from "@/server/services/tours/availability.service";
import { generateAvailableTourSlots } from "@/server/services/tours/slot-generator.service";

function readQualValue(
  answers: Array<{ key: string; value: unknown }>,
  key: string,
): unknown {
  return answers.find((a) => a.key === key)?.value;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,]/g, "").trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

async function tourAvailabilityScore(input: {
  organizationId: string;
  propertyId: string;
  schedule: unknown;
}): Promise<number> {
  const now = new Date();
  const within7 = await getBusyRangesForProperty(
    input.organizationId,
    input.propertyId,
    now,
    addDays(now, 7),
  );
  const slots7 = generateAvailableTourSlots(input.schedule, now, 2, within7).length;
  if (slots7 > 0) return 1;

  const within14 = await getBusyRangesForProperty(
    input.organizationId,
    input.propertyId,
    now,
    addDays(now, 14),
  );
  const slots14 = generateAvailableTourSlots(input.schedule, now, 2, within14).length;
  if (slots14 > 0) return 0.5;
  return 0;
}

function resolveRecommendationIntent(input: {
  monthlyBudget?: number;
  listingRent: number;
  propertyInterest?: string;
  neighborhood: string | null;
}): RecommendationIntent {
  if (
    input.propertyInterest?.trim() &&
    input.neighborhood?.trim() &&
    input.propertyInterest.toLowerCase().includes(input.neighborhood.toLowerCase())
  ) {
    return RecommendationIntent.NEARBY;
  }
  if (input.monthlyBudget != null) {
    if (input.listingRent <= input.monthlyBudget * 0.9) return RecommendationIntent.DOWNGRADE;
    if (input.listingRent >= input.monthlyBudget * 1.1) return RecommendationIntent.UPGRADE;
  }
  return RecommendationIntent.ALTERNATIVE;
}

export async function generateRecommendations(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true, listingId: true, qualifications: { select: { key: true, value: true } } },
  });
  if (!lead) throw new Error("Lead not found");
  const { score: completenessScore } = await getQualificationCompleteness(leadId);

  const monthlyBudget = toNumber(readQualValue(lead.qualifications, "monthlyBudget"));
  const bedrooms = toNumber(readQualValue(lead.qualifications, "bedrooms"));
  const petsValue = readQualValue(lead.qualifications, "pets");
  const moveInDate = String(readQualValue(lead.qualifications, "moveInDate") ?? "") || undefined;
  const propertyInterest = String(readQualValue(lead.qualifications, "propertyInterest") ?? "") || undefined;
  const amenityPreferencesRaw = readQualValue(lead.qualifications, "amenityPreferences");
  const amenityPreferences = Array.isArray(amenityPreferencesRaw)
    ? amenityPreferencesRaw.map((x) => String(x))
    : typeof amenityPreferencesRaw === "string" && amenityPreferencesRaw.trim()
      ? amenityPreferencesRaw.split(",").map((x) => x.trim()).filter(Boolean)
      : undefined;

  const listings = await prisma.listing.findMany({
    where: { organizationId: ctx.organizationId, status: ListingStatus.ACTIVE },
    include: {
      unit: { include: { property: true } },
      recommendations: { where: { leadId }, select: { id: true, status: true } },
    },
  });

  const upserts = [];
  for (const l of listings.filter((row) => row.id !== lead.listingId)) {
      const property = l.unit.property;
      const listingAmenities = Array.isArray(l.amenities) ? l.amenities.map((x) => String(x)) : [];
      const propertyAmenities = Array.isArray(property.amenities)
        ? property.amenities.map((x) => String(x))
        : [];
      const petRules =
        property.petRules && typeof property.petRules === "object" && !Array.isArray(property.petRules)
          ? (property.petRules as Record<string, unknown>)
          : {};

      const availabilityFactor = await tourAvailabilityScore({
        organizationId: ctx.organizationId,
        propertyId: property.id,
        schedule: property.showingSchedule,
      });
      const { total, factors } = scoreListing(
        {
          monthlyBudget,
          bedrooms,
          pets: typeof petsValue === "string" ? petsValue : undefined,
          moveInDate,
          propertyInterest,
          amenityPreferences,
        },
        {
          monthlyRent: Number(l.monthlyRent),
          bedrooms: l.bedrooms,
          availableFrom: l.availableFrom,
          createdAt: l.createdAt,
          title: l.title,
          propertyName: property.name,
          neighborhood: property.neighborhood,
          listingAmenities,
          propertyAmenities,
          petRules,
          tourAvailabilityScore: availabilityFactor,
        },
      );
      const intent = resolveRecommendationIntent({
        monthlyBudget,
        listingRent: Number(l.monthlyRent),
        propertyInterest,
        neighborhood: property.neighborhood,
      });
      const tourReady = total >= 0.6 && availabilityFactor >= 0.5 && completenessScore >= 0.5;

      const prevStatus = l.recommendations[0]?.status;
      const status =
        prevStatus && prevStatus !== RecommendationStatus.SUGGESTED
          ? prevStatus
          : RecommendationStatus.SUGGESTED;

      upserts.push(
        prisma.propertyRecommendation.upsert({
        where: { leadId_listingId: { leadId, listingId: l.id } },
        create: {
          leadId,
          listingId: l.id,
          score: total,
          factors,
          status,
          tourReady,
          recommendationIntent: intent,
        },
        update: {
          score: total,
          factors,
          status,
          tourReady,
          recommendationIntent: intent,
        },
        }),
      );
  }

  if (upserts.length === 0) return [];
  await prisma.$transaction(upserts);

  return prisma.propertyRecommendation.findMany({
    where: { leadId, lead: { organizationId: ctx.organizationId } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          monthlyRent: true,
          bedrooms: true,
          bathrooms: true,
          availableFrom: true,
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        },
      },
    },
    take: 15,
  });
}

export async function listRecommendationsForLead(ctx: OrgContext, leadId: string) {
  return prisma.propertyRecommendation.findMany({
    where: { leadId, lead: { organizationId: ctx.organizationId } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 20,
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          monthlyRent: true,
          bedrooms: true,
          bathrooms: true,
          availableFrom: true,
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function setRecommendationStatus(
  ctx: OrgContext,
  id: string,
  status: RecommendationStatus,
) {
  const rec = await prisma.propertyRecommendation.findFirst({
    where: { id, lead: { organizationId: ctx.organizationId } },
    select: { id: true },
  });
  if (!rec) throw new Error("Recommendation not found");
  return prisma.propertyRecommendation.update({ where: { id }, data: { status } });
}
