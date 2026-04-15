import Link from "next/link";
import { ChannelPublishState } from "@prisma/client";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { tryOrgContext } from "@/server/auth/context";
import { listListings } from "@/server/services/listings/listing.service";

import { ListingsHub, type HubListingRow } from "./listings-hub";

export default async function ListingsPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return (
      <PageHeader
        title="Listings"
        description="Configure dev auth on the dashboard home first."
      />
    );
  }

  const listings = await listListings(ctx);

  const hubRows: HubListingRow[] = listings.map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    monthlyRent: l.monthlyRent.toString(),
    publicSlug: l.publicSlug,
    orgSlug: l.organization.slug,
    leadCount: l._count.leads,
    photoUrl: l.photos[0]?.url ?? null,
    unitLabel: `${l.unit.property.name} · ${l.unit.unitNumber}`,
    channels: l.channels.map((c) => ({
      channelType: c.channelType,
      publishState: c.publishState,
    })),
    publishErrorCount: l.channels.filter((c) => c.publishState === ChannelPublishState.SYNC_ERROR).length,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Listing hub"
        description="Manage listings, channel publish state, and prospect microsite links. Search and filter below; copy a public link when the Website channel is published."
        actions={
          <Link href="/listings/new" className={buttonVariants()}>
            New listing
          </Link>
        }
      />

      <ListingsHub listings={hubRows} />
    </div>
  );
}
