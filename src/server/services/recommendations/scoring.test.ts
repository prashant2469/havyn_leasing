import { describe, expect, it } from "vitest";

import { scoreListing } from "./scoring";

describe("scoreListing", () => {
  it("rewards listings within budget", () => {
    const good = scoreListing(
      { monthlyBudget: 2000 },
      {
        monthlyRent: 1800,
        bedrooms: 2,
        availableFrom: new Date(),
        title: "A",
        propertyName: "B",
        neighborhood: "N",
        listingAmenities: [],
        propertyAmenities: [],
        petRules: {},
      },
    );
    const poor = scoreListing(
      { monthlyBudget: 2000 },
      {
        monthlyRent: 2600,
        bedrooms: 2,
        availableFrom: new Date(),
        title: "A",
        propertyName: "B",
        neighborhood: "N",
        listingAmenities: [],
        propertyAmenities: [],
        petRules: {},
      },
    );

    expect(good.factors.budget).toBeGreaterThan(poor.factors.budget);
    expect(good.total).toBeGreaterThan(poor.total);
  });

  it("keeps scores clamped to 0..1", () => {
    const result = scoreListing(
      { monthlyBudget: 1000, bedrooms: 3, pets: "dog", moveInDate: "2050-01-01" },
      {
        monthlyRent: 5000,
        bedrooms: 0,
        availableFrom: new Date("2100-01-01"),
        title: "Far",
        propertyName: "Away",
        neighborhood: null,
        listingAmenities: [],
        propertyAmenities: [],
        petRules: { dogs: false },
      },
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
  });
});
