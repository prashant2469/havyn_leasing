export const RECOMMENDATION_WEIGHTS = {
  budget: 0.3,
  bedrooms: 0.2,
  pets: 0.15,
  moveIn: 0.15,
  location: 0.1,
  amenities: 0.1,
} as const;

export type RecommendationFactor = keyof typeof RECOMMENDATION_WEIGHTS;
