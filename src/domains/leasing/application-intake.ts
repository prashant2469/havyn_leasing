/** Human-readable labels for structured application intake (domain layer for UI + validation parity). */
export const APPLICATION_INTAKE_LABELS = {
  employer: "Employer",
  jobTitle: "Job title",
  monthlyIncome: "Monthly income",
  otherIncome: "Other income",
  creditScoreRange: "Credit score range",
  desiredLeaseStart: "Desired lease start",
  leaseTermMonths: "Lease term (months)",
  occupants: "Occupants",
  currentAddress: "Current address",
  currentResidenceMonths: "Current residence (months)",
  landlordName: "Landlord name",
  landlordPhone: "Landlord phone",
  moveReason: "Reason for moving",
  petsDescription: "Pets",
  vehicleParking: "Vehicle / parking",
  emergencyContactName: "Emergency contact name",
  emergencyContactPhone: "Emergency contact phone",
  additionalNotes: "Additional notes",
} as const;

export type ApplicationIntakeFieldKey = keyof typeof APPLICATION_INTAKE_LABELS;
