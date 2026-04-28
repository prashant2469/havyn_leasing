import { PropertyFactCategory } from "@prisma/client";

export const propertyFactCategoryOrder: PropertyFactCategory[] = [
  PropertyFactCategory.GENERAL,
  PropertyFactCategory.FEES_AND_COSTS,
  PropertyFactCategory.PET_POLICY,
  PropertyFactCategory.PARKING,
  PropertyFactCategory.UTILITIES,
  PropertyFactCategory.AMENITIES,
  PropertyFactCategory.LEASE_TERMS,
  PropertyFactCategory.MOVE_IN,
  PropertyFactCategory.MAINTENANCE,
  PropertyFactCategory.RULES_AND_POLICIES,
  PropertyFactCategory.NEIGHBORHOOD,
  PropertyFactCategory.CUSTOM,
];

export const propertyFactCategoryLabel: Record<PropertyFactCategory, string> = {
  GENERAL: "General",
  FEES_AND_COSTS: "Fees and costs",
  PET_POLICY: "Pet policy",
  PARKING: "Parking",
  UTILITIES: "Utilities",
  AMENITIES: "Amenities",
  LEASE_TERMS: "Lease terms",
  MOVE_IN: "Move-in",
  MAINTENANCE: "Maintenance",
  RULES_AND_POLICIES: "Rules and policies",
  NEIGHBORHOOD: "Neighborhood",
  CUSTOM: "Custom",
};

export const propertyFactDefaultQuestions: Record<PropertyFactCategory, string[]> = {
  GENERAL: [
    "What makes this property unique?",
    "What should prospects know before applying?",
  ],
  FEES_AND_COSTS: [
    "What is the application fee?",
    "What is the security deposit?",
    "Are there any move-in fees?",
  ],
  PET_POLICY: [
    "Do you allow dogs and cats?",
    "What pet deposits or monthly pet fees apply?",
    "Is there a pet weight or breed restriction?",
  ],
  PARKING: [
    "Is parking included?",
    "How much does parking cost?",
    "Is covered or garage parking available?",
  ],
  UTILITIES: [
    "Which utilities are included in rent?",
    "Which utilities are paid separately by the resident?",
    "Is internet or cable included?",
  ],
  AMENITIES: [
    "What are the top amenities for this property?",
    "Are there amenity access rules or hours?",
  ],
  LEASE_TERMS: [
    "What lease term lengths are available?",
    "Are there month-to-month options?",
    "Are there lease break penalties?",
  ],
  MOVE_IN: [
    "What does a resident need to submit before move-in?",
    "How is key pickup handled on move-in day?",
  ],
  MAINTENANCE: [
    "How do residents submit maintenance requests?",
    "What is the emergency maintenance process?",
  ],
  RULES_AND_POLICIES: [
    "What are key house rules prospects should know?",
    "Is smoking allowed on property?",
  ],
  NEIGHBORHOOD: [
    "What transit options are nearby?",
    "What neighborhood highlights are most relevant to prospects?",
  ],
  CUSTOM: [],
};
