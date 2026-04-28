import { ListingStatus, RecommendationStatus } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { scoreListing } from "@/server/services/recommendations/scoring";

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

export async function generateRecommendations(ctx: OrgContext, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: ctx.organizationId },
    select: { id: true, listingId: true, qualifications: { select: { key: true, value: true } } },
  });
  if (!lead) throw new Error("Lead not found");

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

  const upserts = listings
    .filter((l) => l.id !== lead.listingId)
    .map((l) => {
      const property = l.unit.property;
      const listingAmenities = Array.isArray(l.amenities) ? l.amenities.map((x) => String(x)) : [];
      const propertyAmenities = Array.isArray(property.amenities)
        ? property.amenities.map((x) => String(x))
        : [];
      const petRules =
        property.petRules && typeof property.petRules === "object" && !Array.isArray(property.petRules)
          ? (property.petRules as Record<string, unknown>)
          : {};

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
          title: l.title,
          propertyName: property.name,
          neighborhood: property.neighborhood,
          listingAmenities,
          propertyAmenities,
          petRules,
        },
      );

      const prevStatus = l.recommendations[0]?.status;
      const status =
        prevStatus && prevStatus !== RecommendationStatus.SUGGESTED
          ? prevStatus
          : RecommendationStatus.SUGGESTED;

      return prisma.propertyRecommendation.upsert({
        where: { leadId_listingId: { leadId, listingId: l.id } },
        create: {
          leadId,
          listingId: l.id,
          score: total,
          factors,
          status,
        },
        update: {
          score: total,
          factors,
          status,
        },
      });
    });

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
