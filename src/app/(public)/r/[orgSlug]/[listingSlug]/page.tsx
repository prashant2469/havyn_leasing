import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { prospectListingAbsoluteUrl } from "@/lib/public-url";
import { getS3PublicUrl } from "@/lib/s3";
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
  const photos = listing.photos
    .map((photo) => ({ ...photo, displayUrl: photo.url ?? getS3PublicUrl(photo.storageKey) }))
    .filter((photo) => !!photo.displayUrl);
  const primaryPhoto = photos.find((p) => p.isPrimary) ?? photos[0];
  const orgName = listing.organization.name;
  const metadata =
    typeof listing.metadata === "object" && listing.metadata !== null
      ? (listing.metadata as Record<string, unknown>)
      : {};
  const publicHeader =
    typeof metadata.publicPageHeader === "string" && metadata.publicPageHeader.trim()
      ? metadata.publicPageHeader
      : listing.title;
  const accentColor =
    typeof metadata.accentColor === "string" && metadata.accentColor.trim()
      ? metadata.accentColor
      : null;
  const contactEmail =
    typeof metadata.contactEmail === "string" && metadata.contactEmail.trim()
      ? metadata.contactEmail
      : null;
  const contactPhone =
    typeof metadata.contactPhone === "string" && metadata.contactPhone.trim()
      ? metadata.contactPhone
      : null;

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
          <p
            className="text-muted-foreground text-xs font-semibold uppercase tracking-wider"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {orgName}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{publicHeader}</h1>
          <p className="text-muted-foreground text-sm md:text-base">{address}</p>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border border-border/80 bg-muted/15 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          {primaryPhoto?.displayUrl ? (
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={primaryPhoto.displayUrl}
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

        {photos.length > 1 ? (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            {photos.slice(0, 6).map((photo) => (
              <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-lg border">
                <Image
                  src={photo.displayUrl}
                  alt={photo.caption ?? listing.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 240px"
                  unoptimized
                />
              </div>
            ))}
          </div>
        ) : null}

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

        {contactEmail || contactPhone ? (
          <section className="mb-10">
            <h2 className="mb-3 text-base font-semibold tracking-tight">Leasing contact</h2>
            <div className="text-muted-foreground space-y-1 text-sm">
              {contactEmail ? <p>Email: {contactEmail}</p> : null}
              {contactPhone ? <p>Phone: {contactPhone}</p> : null}
            </div>
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
