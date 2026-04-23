import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { unitStatusLabel } from "@/domains/properties/constants";
import { tryOrgContext } from "@/server/auth/context";
import { listUnitsForOrg } from "@/server/services/properties/property.service";

export default async function UnitsPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const units = await listUnitsForOrg(ctx);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Units"
        description="Org-wide inventory. Listings and leads reference units for a single source of truth."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All units</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Beds / baths</TableHead>
                <TableHead>Sqft</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No units yet. Add properties and units first.
                  </TableCell>
                </TableRow>
              ) : (
                units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.property.name}</TableCell>
                    <TableCell>{u.unitNumber}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.beds ?? "—"} / {u.baths ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{u.sqft ?? "—"}</TableCell>
                    <TableCell>{unitStatusLabel[u.status]}</TableCell>
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
