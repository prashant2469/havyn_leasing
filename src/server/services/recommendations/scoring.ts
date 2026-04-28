import { RECOMMENDATION_WEIGHTS, type RecommendationFactor } from "@/domains/recommendations/scoring-factors";

type QualInput = {
  monthlyBudget?: number;
  bedrooms?: number;
  pets?: string;
  moveInDate?: string;
  propertyInterest?: string;
  amenityPreferences?: string[];
};

type ListingInput = {
  monthlyRent: number;
  bedrooms: number | null;
  availableFrom: Date | null;
  title: string;
  propertyName: string;
  neighborhood: string | null;
  listingAmenities: string[];
  propertyAmenities: string[];
  petRules: Record<string, unknown>;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function budgetScore(budget: number | undefined, rent: number): number {
  if (!budget || budget <= 0) return 0.5;
  if (rent <= budget) return 1;
  const ratio = rent / budget;
  if (ratio >= 1.3) return 0;
  return clamp01(1 - (ratio - 1) / 0.3);
}

function bedroomsScore(target: number | undefined, beds: number | null): number {
  if (!target || target <= 0 || beds == null) return 0.5;
  const delta = Math.abs(target - beds);
  if (delta === 0) return 1;
  if (delta === 1) return 0.5;
  return 0;
}

function petsScore(pets: string | undefined, petRules: Record<string, unknown>): number {
  const p = (pets ?? "").toLowerCase();
  if (!p || p === "no" || p === "none") return 1;
  const allowsDogs = petRules.dogs === true;
  const allowsCats = petRules.cats === true;
  if (p.includes("dog")) return allowsDogs ? 1 : 0;
  if (p.includes("cat")) return allowsCats ? 1 : 0;
  return allowsDogs || allowsCats ? 0.8 : 0.2;
}

function moveInScore(moveInDate: string | undefined, availableFrom: Date | null): number {
  if (!moveInDate || !availableFrom) return 0.5;
  const target = new Date(moveInDate);
  if (Number.isNaN(target.getTime())) return 0.5;
  const diffDays = Math.round((availableFrom.getTime() - target.getTime()) / 86_400_000);
  if (diffDays <= 0) return 1;
  if (diffDays >= 30) return 0;
  return clamp01(1 - diffDays / 30);
}

function locationScore(propertyInterest: string | undefined, listing: ListingInput): number {
  const q = (propertyInterest ?? "").trim().toLowerCase();
  if (!q) return 0.5;
  const haystack = `${listing.title} ${listing.propertyName} ${listing.neighborhood ?? ""}`.toLowerCase();
  return haystack.includes(q) ? 1 : 0.2;
}

function amenitiesScore(preferences: string[] | undefined, listing: ListingInput): number {
  if (!preferences || preferences.length === 0) return 0.5;
  const target = new Set(preferences.map((x) => x.toLowerCase()));
  const have = new Set(
    [...listing.listingAmenities, ...listing.propertyAmenities].map((x) => x.toLowerCase()),
  );
  let matches = 0;
  for (const t of target) {
    if (have.has(t)) matches++;
  }
  return clamp01(matches / target.size);
}

export function scoreListing(qual: QualInput, listing: ListingInput): {
  total: number;
  factors: Record<RecommendationFactor, number>;
} {
  const factors: Record<RecommendationFactor, number> = {
    budget: budgetScore(qual.monthlyBudget, listing.monthlyRent),
    bedrooms: bedroomsScore(qual.bedrooms, listing.bedrooms),
    pets: petsScore(qual.pets, listing.petRules),
    moveIn: moveInScore(qual.moveInDate, listing.availableFrom),
    location: locationScore(qual.propertyInterest, listing),
    amenities: amenitiesScore(qual.amenityPreferences, listing),
  };

  const total =
    factors.budget * RECOMMENDATION_WEIGHTS.budget +
    factors.bedrooms * RECOMMENDATION_WEIGHTS.bedrooms +
    factors.pets * RECOMMENDATION_WEIGHTS.pets +
    factors.moveIn * RECOMMENDATION_WEIGHTS.moveIn +
    factors.location * RECOMMENDATION_WEIGHTS.location +
    factors.amenities * RECOMMENDATION_WEIGHTS.amenities;

  return { total: clamp01(total), factors };
}
