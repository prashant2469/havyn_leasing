import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { prospectListingAbsoluteUrl } from "@/lib/public-url";
import { getPublishedPublicListing } from "@/server/services/listings/public-listing.service";
import { generateTourSlots } from "@/server/services/tours/slot-generator.service";

import { PublicListingLeadPanel } from "./public-listing-lead-panel";
import { PublicListingStickyCta } from "./public-listing-sticky-cta";

type Props = { params: Promise<{ orgSlug: string; listingSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug, listingSlug } = await params;
  const listing = await getPublishedPublicListing(orgSlug, listingSlug);
  if (!listing) return { title: "Listing" };
  return {
    title: `${listing.title} · ${listing.organization.name}`,
    description: listing.description?.slice(0, 160) ?? undefined,
    openGraph: {
      title: listing.title,
      description: listing.description?.slice(0, 160) ?? undefined,
      url: prospectListingAbsoluteUrl(orgSlug, listingSlug),
    },
  };
}

function formatMoney(n: { toString(): string }) {
  const num = Number(n.toString());
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    num,
  );
}

export default async function PublicListingPage({ params }: Props) {
  const { orgSlug, listingSlug } = await params;
  const listing = await getPublishedPublicListing(orgSlug, listingSlug);
  if (!listing) notFound();

  const amenities = Array.isArray(listing.amenities) ? (listing.amenities as string[]) : [];
  const property = listing.unit.property;
  const address = `${property.street}, ${property.city}, ${property.state} ${property.postalCode}`;
  const primaryPhoto = listing.photos.find((p) => p.isPrimary) ?? listing.photos[0];
  const orgName = listing.organization.name;

  const slotDates = generateTourSlots(property.showingSchedule, new Date(), 8);
  const tourSlots = slotDates.map((d) => ({
    iso: d.toISOString(),
    label: d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  }));

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 md:px-6 md:pb-12 md:pt-10">
        <div className="mb-8 flex flex-col gap-1 border-b border-border/60 pb-6">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{orgName}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{listing.title}</h1>
          <p className="text-muted-foreground text-sm md:text-base">{address}</p>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border border-border/80 bg-muted/15 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          {primaryPhoto?.url ? (
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={primaryPhoto.url}
                alt={primaryPhoto.caption ?? listing.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
                unoptimized
              />
            </div>
          ) : (
            <div className="bg-muted flex aspect-[16/10] items-center justify-center text-sm text-muted-foreground">
              Photos coming soon
            </div>
          )}
        </div>

        <div className="mb-10 flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-border/40 pb-8">
          <div>
            <p className="text-muted-foreground mb-0.5 text-xs font-medium uppercase tracking-wide">Rent</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight md:text-4xl">{formatMoney(listing.monthlyRent)}</p>
            <p className="text-muted-foreground mt-0.5 text-sm">per month</p>
          </div>
          {listing.bedrooms != null && listing.bathrooms != null ? (
            <div className="text-muted-foreground min-h-[3.5rem] border-l border-border/60 pl-6 text-sm leading-relaxed">
              <span className="text-foreground font-medium">{listing.bedrooms} bed</span>
              <span className="mx-1.5 text-border">·</span>
              <span className="text-foreground font-medium">{listing.bathrooms} bath</span>
              {listing.unit.sqft ? (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  <span className="text-foreground font-medium">{listing.unit.sqft} sq ft</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {listing.description ? (
          <section className="mb-10">
            <h2 className="mb-3 text-base font-semibold tracking-tight">About this home</h2>
            <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap md:text-[1.05rem]">
              {listing.description}
            </p>
          </section>
        ) : null}

        {amenities.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-3 text-base font-semibold tracking-tight">Amenities</h2>
            <ul className="flex flex-wrap gap-2">
              {amenities.map((a) => (
                <li
                  key={a}
                  className="bg-muted/80 text-muted-foreground rounded-full border border-border/50 px-3 py-1.5 text-xs font-medium"
                >
                  {a.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {listing.petPolicy ? (
          <section className="mb-10">
            <h2 className="mb-3 text-base font-semibold tracking-tight">Pet policy</h2>
            <p className="text-muted-foreground text-base leading-relaxed">{listing.petPolicy}</p>
          </section>
        ) : null}

        <section className="pt-2">
          <PublicListingLeadPanel
            orgSlug={orgSlug}
            listingSlug={listingSlug}
            orgName={orgName}
            tourSlots={tourSlots}
          />
        </section>
      </main>
      <PublicListingStickyCta />
    </>
  );
}
