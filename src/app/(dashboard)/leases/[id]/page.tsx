import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { leaseStatusLabel } from "@/domains/leases/constants";
import { tryOrgContext } from "@/server/auth/context";
import { getLeaseById } from "@/server/services/leases/lease.service";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const lease = await getLeaseById(ctx, id);
  if (!lease) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Lease · ${lease.unit.property.name} ${lease.unit.unitNumber}`}
        description={`${lease.resident.firstName} ${lease.resident.lastName} · ${leaseStatusLabel[lease.status]}`}
        actions={
          <Link href="/leases" className={cn(buttonVariants({ variant: "outline" }))}>
            All leases
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Term: {lease.startDate.toLocaleDateString()}
            {lease.endDate ? ` – ${lease.endDate.toLocaleDateString()}` : " (open-ended)"}
          </p>
          <p>Rent: {lease.rentAmount.toString()}</p>
          <p>Deposit: {lease.depositAmount?.toString() ?? "—"}</p>
          <p className="text-xs">
            V1 focuses on leasing workflows; charge/payment ledger can return when you add billing
            integrations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
