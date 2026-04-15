/** Canonical qualification keys for V4 guided flow and completeness scoring. */
export const QUALIFICATION_KEYS = [
  "moveInDate",
  "bedrooms",
  "pets",
  "monthlyBudget",
  "occupants",
  "propertyInterest",
] as const;

export type QualificationKey = (typeof QUALIFICATION_KEYS)[number];

export const QUALIFICATION_QUESTIONS: Record<QualificationKey, string> = {
  moveInDate: "What move-in date are you aiming for?",
  bedrooms: "How many bedrooms do you need?",
  pets: "Do you have pets?",
  monthlyBudget: "What monthly rent budget are you targeting?",
  occupants: "How many people will be living in the home?",
  propertyInterest: "Are you interested in a specific property or neighborhood?",
};
