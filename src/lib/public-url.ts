/** Path segment for the public prospect microsite (no base URL). */
export function prospectListingPath(orgSlug: string, listingSlug: string) {
  return `/r/${orgSlug}/${listingSlug}`;
}

export function prospectListingAbsoluteUrl(orgSlug: string, listingSlug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const path = prospectListingPath(orgSlug, listingSlug);
  return base ? `${base}${path}` : path;
}
