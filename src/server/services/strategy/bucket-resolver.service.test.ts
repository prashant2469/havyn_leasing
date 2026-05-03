import { InboundIntentType, LeadStrengthTier } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computePrimaryListingFitScore,
  resolveStrategyBucket,
} from "./bucket-resolver.service";

describe("resolveStrategyBucket", () => {
  it("returns HUMAN_REQUIRED for sensitive intent", () => {
    const bucket = resolveStrategyBucket({
      strengthTier: LeadStrengthTier.PROMISING,
      overallScore: 0.8,
      completenessScore: 0.9,
      financialFitScore: 0.9,
      hasEscalation: false,
      latestIntent: InboundIntentType.SENSITIVE,
      primaryListingFitScore: 0.9,
    });
    expect(bucket).toBe("HUMAN_REQUIRED");
  });

  it("returns TOUR_READY when scores clear thresholds", () => {
    const bucket = resolveStrategyBucket({
      strengthTier: LeadStrengthTier.STRONG,
      overallScore: 0.78,
      completenessScore: 0.75,
      financialFitScore: 0.8,
      hasEscalation: false,
      latestIntent: null,
      primaryListingFitScore: 0.82,
    });
    expect(bucket).toBe("TOUR_READY");
  });
});

describe("computePrimaryListingFitScore", () => {
  it("produces a normalized score", () => {
    const score = computePrimaryListingFitScore({
      monthlyRent: 1800,
      bedrooms: 2,
      availableFrom: new Date(Date.now() + 3 * 86_400_000),
      title: "2BR Downtown",
      propertyName: "Foundry Lofts",
      neighborhood: "Downtown",
      listingAmenities: ["gym", "parking"],
      propertyAmenities: ["pool"],
      petRules: { dogs: true, cats: true },
      qualifications: [
        { key: "monthlyBudget", value: 2200 },
        { key: "bedrooms", value: 2 },
        { key: "pets", value: "dog" },
      ],
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
