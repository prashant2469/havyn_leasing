// @vitest-environment node

import { describe, expect, it } from "vitest";

import { applicationIntakeSchema } from "@/server/validation/application";
import { publicApplicationFormSchema } from "@/server/validation/public-application";

describe("public application form → intake payload", () => {
  it("parses the same shape the server action uses (review step)", () => {
    const raw = {
      orgSlug: "demo-org",
      listingSlug: "sunset-1",
      firstName: "PP",
      lastName: "Potluri",
      email: "pp@gmail.com",
      phone: "6506952683",
      employer: "LinkedIn",
      jobTitle: "Engineer",
      monthlyIncome: "12000",
      otherIncome: "",
      creditScoreRange: "Excellent (750+)",
      desiredLeaseStart: "2026-05-30",
      leaseTermMonths: "12",
      occupants: "2",
      currentAddress: "1985 White Oaks Rd",
      currentResidenceMonths: "",
      landlordName: "",
      landlordPhone: "",
      moveReason: "",
      petsDescription: "",
      vehicleParking: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      additionalNotes: "",
      hasPets: "no",
      hp_trap: "",
    };
    const input = publicApplicationFormSchema.parse(raw);
    expect(() => applicationIntakeSchema.parse(input)).not.toThrow();
    const payload = applicationIntakeSchema.parse(input);
    expect(payload.monthlyIncome).toBe(12000);
    expect(payload.occupants).toBe(2);
    expect(payload.leaseTermMonths).toBe(12);
  });
});
