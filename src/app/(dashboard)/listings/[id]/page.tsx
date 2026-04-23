import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { getListingById } from "@/server/services/listings/listing.service";

import { IngestInquiryForm } from "./ingest-inquiry-form";
import { ListingDetailForm } from "./listing-detail-form";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const listing = await getListingById(ctx, id);
  if (!listing) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={listing.title}
        description={`${listing.unit.property.name} · Unit ${listing.unit.unitNumber}`}
        actions={
          <Link href="/listings" className={cn(buttonVariants({ variant: "outline" }))}>
            All listings
          </Link>
        }
      />
      <ListingDetailForm listing={JSON.parse(JSON.stringify(listing))} />
      <IngestInquiryForm listingId={listing.id} />
    </div>
  );
}
