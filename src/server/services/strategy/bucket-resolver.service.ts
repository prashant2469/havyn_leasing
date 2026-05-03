import { InboundIntentType, LeadStrengthTier } from "@prisma/client";

import { scoreListing } from "@/server/services/recommendations/scoring";

type BucketInput = {
  strengthTier: LeadStrengthTier;
  overallScore: number;
  completenessScore: number;
  financialFitScore: number;
  hasEscalation: boolean;
  latestIntent: InboundIntentType | null;
  primaryListingFitScore: number | null;
};

export type LeadStrategyBucket =
  | "TOUR_READY"
  | "PROMISING_INCOMPLETE"
  | "PORTFOLIO_CANDIDATE"
  | "NURTURE"
  | "WEAK_HOLD"
  | "HUMAN_REQUIRED";

export function resolveStrategyBucket(input: BucketInput): LeadStrategyBucket {
  if (input.hasEscalation) return "HUMAN_REQUIRED";
  if (
    input.latestIntent === InboundIntentType.SENSITIVE ||
    input.latestIntent === InboundIntentType.COMPLAINT ||
    input.strengthTier === LeadStrengthTier.DISQUALIFIED
  ) {
    return "HUMAN_REQUIRED";
  }

  const isTourReady =
    input.overallScore >= 0.65 &&
    input.completenessScore >= 0.6 &&
    input.financialFitScore >= 0.5 &&
    input.strengthTier !== LeadStrengthTier.WEAK;
  if (isTourReady) return "TOUR_READY";

  const primaryPoorFit = (input.primaryListingFitScore ?? 0.5) < 0.5 || input.financialFitScore < 0.5;
  if (
    !isTourReady &&
    input.completenessScore >= 0.35 &&
    (primaryPoorFit ||
      input.strengthTier === LeadStrengthTier.PROMISING ||
      input.strengthTier === LeadStrengthTier.UNCERTAIN)
  ) {
    return "PORTFOLIO_CANDIDATE";
  }

  if (input.overallScore >= 0.45 && input.completenessScore < 0.6) {
    return "PROMISING_INCOMPLETE";
  }

  if (input.overallScore >= 0.25 && input.completenessScore < 0.4) {
    return "NURTURE";
  }

  return "WEAK_HOLD";
}

function numberFromJson(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringFromJson(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function computePrimaryListingFitScore(input: {
  monthlyRent: number;
  bedrooms: number | null;
  availableFrom: Date | null;
  title: string;
  propertyName: string;
  neighborhood: string | null;
  listingAmenities: string[];
  propertyAmenities: string[];
  petRules: Record<string, unknown>;
  qualifications: Array<{ key: string; value: unknown }>;
}): number {
  const read = (key: string): unknown => input.qualifications.find((q) => q.key === key)?.value;
  const amenityRaw = read("amenityPreferences");
  const amenityPreferences = Array.isArray(amenityRaw)
    ? amenityRaw.map((x) => String(x))
    : typeof amenityRaw === "string" && amenityRaw.trim()
      ? amenityRaw.split(",").map((x) => x.trim()).filter(Boolean)
      : undefined;

  const { total } = scoreListing(
    {
      monthlyBudget: numberFromJson(read("monthlyBudget")),
      bedrooms: numberFromJson(read("bedrooms")),
      pets: stringFromJson(read("pets")),
      moveInDate: stringFromJson(read("moveInDate")),
      propertyInterest: stringFromJson(read("propertyInterest")),
      amenityPreferences,
    },
    {
      monthlyRent: input.monthlyRent,
      bedrooms: input.bedrooms,
      availableFrom: input.availableFrom,
      title: input.title,
      propertyName: input.propertyName,
      neighborhood: input.neighborhood,
      listingAmenities: input.listingAmenities,
      propertyAmenities: input.propertyAmenities,
      petRules: input.petRules,
    },
  );
  return total;
}
