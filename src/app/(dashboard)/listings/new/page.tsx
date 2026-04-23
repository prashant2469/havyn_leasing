import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { listUnitsForOrg } from "@/server/services/properties/property.service";

import { CreateListingForm } from "./create-listing-form";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string }>;
}) {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return <PageHeader title="New listing" description="Configure dev auth on the dashboard home first." />;
  }

  const units = await listUnitsForOrg(ctx);
  const { unitId } = await searchParams;

  return (
    <div className="space-y-8">
      <PageHeader
        title="New listing"
        description="Associate a listing with a unit. Photos and file upload can plug in later; metadata is modeled on the listing."
        actions={
          <Link href="/listings" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to listings
          </Link>
        }
      />
      <CreateListingForm units={JSON.parse(JSON.stringify(units))} preselectedUnitId={unitId} />
    </div>
  );
}
