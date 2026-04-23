import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { tourStatusLabel } from "@/domains/leasing/constants";
import { tryOrgContext } from "@/server/auth/context";
import { listToursForOrg } from "@/server/services/leasing/tour.service";

export default async function ToursPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const tours = await listToursForOrg(ctx);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tours"
        description="Scheduled tours across the portfolio. Creating a tour moves the lead to the tour queue when applicable."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming and past</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tours.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No tours yet.
                  </TableCell>
                </TableRow>
              ) : (
                tours.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(t.scheduledAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      {t.lead.firstName} {t.lead.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.listing?.title ?? "—"}
                    </TableCell>
                    <TableCell>{tourStatusLabel[t.status]}</TableCell>
                    <TableCell>
                      <Link
                        href={`/leasing/leads/${t.lead.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Lead
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
