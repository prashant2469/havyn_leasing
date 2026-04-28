/** `propertyType` on single-unit Zillow rental listings (guide enum subset). */
export type ZillowPropertyType = "CONDO" | "HOUSE" | "TOWNHOUSE";

export type ZillowFeedCompany = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  city: string;
  state: string;
};

export type ZillowFeedPhoto = {
  source: string;
  label?: string | null;
  caption?: string | null;
};

export type ZillowFeedListing = {
  id: string;
  type: "RENTAL";
  propertyType: ZillowPropertyType;
  name: string;
  unit: string;
  street: string;
  streetHide?: boolean;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: string | null;
  longitude?: string | null;
  lastUpdated: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  website?: string | null;
  price: string;
  pricingFrequency: "MONTHLY" | "WEEKLY" | "YEARLY";
  numBedrooms: number;
  numFullBaths: number;
  numHalfBaths: number;
  squareFeet?: string | null;
  dateAvailable?: string | null;
  virtualTourUrl?: string | null;
  photos: ZillowFeedPhoto[];
};

export type ZillowRentalFeedPayload = {
  version: "2.1";
  company: ZillowFeedCompany;
  listings: ZillowFeedListing[];
};
