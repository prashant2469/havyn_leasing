import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leaseStatusLabel } from "@/domains/leases/constants";
import { tryOrgContext } from "@/server/auth/context";
import { listLeases } from "@/server/services/leases/lease.service";

export default async function LeasesPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const leases = await listLeases(ctx);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leases"
        description="Workflow: Lease → Charges → Payments → Ledger. Open a lease for balances and allocations."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All leases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No leases yet. Convert an approved application from a lead.
                  </TableCell>
                </TableRow>
              ) : (
                leases.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.unit.property.name} · {l.unit.unitNumber}
                    </TableCell>
                    <TableCell>
                      {l.resident.firstName} {l.resident.lastName}
                    </TableCell>
                    <TableCell>{leaseStatusLabel[l.status]}</TableCell>
                    <TableCell>${Number(l.rentAmount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/leases/${l.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
