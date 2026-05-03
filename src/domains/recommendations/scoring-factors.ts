export const RECOMMENDATION_WEIGHTS = {
  budget: 0.25,
  bedrooms: 0.18,
  pets: 0.12,
  moveIn: 0.12,
  location: 0.1,
  amenities: 0.08,
  tourAvailability: 0.08,
  portfolioFreshness: 0.07,
} as const;

export type RecommendationFactor = keyof typeof RECOMMENDATION_WEIGHTS;
