import { format } from "date-fns";
import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { ListingStatus } from "@prisma/client";

import { buildZillowRentalFeedXml } from "@/lib/zillow-rental-feed/build-feed-xml";
import type { ZillowFeedListing, ZillowPropertyType } from "@/lib/zillow-rental-feed/types";
import { prisma } from "@/server/db/client";

function readMetadataString(record: { metadata: Prisma.JsonValue }, key: string): string | undefined {
  if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) {
    return undefined;
  }
  const v = (record.metadata as Record<string, unknown>)[key];
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

function readMetadataBoolean(
  record: { metadata: Prisma.JsonValue },
  key: string
): boolean | undefined {
  if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) {
    return undefined;
  }
  const v = (record.metadata as Record<string, unknown>)[key];
  if (typeof v === "boolean") return v;
  return undefined;
}

function zillowPropertyType(listing: { metadata: Prisma.JsonValue }): ZillowPropertyType {
  if (!listing.metadata || typeof listing.metadata !== "object" || Array.isArray(listing.metadata)) {
    return "HOUSE";
  }
  const t = (listing.metadata as Record<string, unknown>).zillowPropertyType;
  if (t === "CONDO" || t === "HOUSE" || t === "TOWNHOUSE") return t;
  return "HOUSE";
}

function splitBaths(bathrooms: number | null | undefined): { full: number; half: number } {
  if (bathrooms == null || Number.isNaN(bathrooms) || bathrooms < 0) {
    return { full: 0, half: 0 };
  }
  const full = Math.floor(bathrooms);
  const frac = bathrooms - full;
  return { full, half: frac > 0.1 && frac < 0.9 ? 1 : 0 };
}

function asPrice(d: Decimal): string {
  return d.toFixed(0);
}

/**
 * Produces a single-org Zillow `hotPadsItems` XML string for {organizationId}’s ACTIVE listings.
 * Requires Zillow contact env (see .env.example). `Company` address uses env or first listing’s property.
 */
export async function getZillowRentalFeedXmlForOrganization(organizationId: string): Promise<string> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    throw new Error("Organization not found for Zillow feed.");
  }

  const contactName = process.env.ZILLOW_RENTAL_FEED_CONTACT_NAME?.trim();
  const contactEmail = process.env.ZILLOW_RENTAL_FEED_CONTACT_EMAIL?.trim();
  const contactPhone = process.env.ZILLOW_RENTAL_FEED_CONTACT_PHONE?.trim();
  if (!contactName || !contactEmail || !contactPhone) {
    throw new Error(
      "Set ZILLOW_RENTAL_FEED_CONTACT_NAME, ZILLOW_RENTAL_FEED_CONTACT_EMAIL, and ZILLOW_RENTAL_FEED_CONTACT_PHONE for the Zillow rental feed."
    );
  }

  const listings = await prisma.listing.findMany({
    where: { organizationId, status: ListingStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
    include: {
      unit: { include: { property: true } },
      organization: { select: { slug: true } },
      photos: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });

  const first = listings[0];
  const companyCity =
    process.env.ZILLOW_RENTAL_FEED_COMPANY_CITY?.trim() || first?.unit.property.city || "";
  const companyState =
    process.env.ZILLOW_RENTAL_FEED_COMPANY_STATE?.trim() || first?.unit.property.state || "";
  if (!companyCity || !companyState) {
    throw new Error(
      "Zillow feed needs company city and state. Set ZILLOW_RENTAL_FEED_COMPANY_CITY and ZILLOW_RENTAL_FEED_COMPANY_STATE, or keep at least one ACTIVE listing for fallback from its property address."
    );
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const companySite =
    process.env.ZILLOW_RENTAL_FEED_COMPANY_WEBSITE?.trim() || (appBase ? appBase : null);
  const logo = process.env.ZILLOW_RENTAL_FEED_COMPANY_LOGO_URL?.trim() || null;

  const payloadListings: ZillowFeedListing[] = listings.map((l) => {
    const p = l.unit.property;
    const bedRaw = l.bedrooms ?? l.unit.beds;
    const numBed = bedRaw != null ? Math.max(0, Math.round(bedRaw)) : 0;
    const bathSource =
      l.bathrooms != null ? Number(l.bathrooms) : l.unit.baths != null ? l.unit.baths : null;
    const baths = splitBaths(bathSource);

    const publicSite =
      l.publicSlug && appBase
        ? `${appBase}/r/${l.organization.slug}/${l.publicSlug}`
        : null;

    const descParts = [l.title];
    if (l.description) descParts.push(l.description);
    const description = descParts.join("\n\n");

    const virtualTour = readMetadataString(l, "virtualTourUrl");
    const hide = readMetadataBoolean(l, "hideStreetAddress");
    const lat = readMetadataString(l, "latitude") ?? readMetadataString(l, "lat");
    const lon = readMetadataString(l, "longitude") ?? readMetadataString(l, "lng");

    const photos = l.photos
      .filter((ph): ph is (typeof l.photos)[number] & { url: string } => Boolean(ph.url))
      .map((ph) => ({
        source: ph.url!,
        label: null,
        caption: ph.caption,
      }));

    return {
      id: l.id,
      type: "RENTAL" as const,
      propertyType: zillowPropertyType(l),
      name: l.title,
      unit: l.unit.unitNumber,
      street: p.street,
      streetHide: hide === true,
      city: p.city,
      state: p.state,
      zip: p.postalCode,
      country: p.country,
      latitude: lat,
      longitude: lon,
      lastUpdated: l.updatedAt.toISOString(),
      contactName,
      contactEmail,
      contactPhone,
      website: publicSite,
      price: asPrice(l.monthlyRent as Decimal),
      pricingFrequency: "MONTHLY",
      numBedrooms: numBed,
      numFullBaths: baths.full,
      numHalfBaths: baths.half,
      squareFeet: l.unit.sqft != null ? String(l.unit.sqft) : null,
      dateAvailable: l.availableFrom ? format(l.availableFrom, "yyyy-MM-dd") : null,
      virtualTourUrl: virtualTour,
      description,
      photos,
    };
  });

  return buildZillowRentalFeedXml({
    version: "2.1",
    company: {
      id: org.id,
      name: org.name,
      websiteUrl: companySite,
      logoUrl: logo,
      city: companyCity,
      state: companyState,
    },
    listings: payloadListings,
  });
}
