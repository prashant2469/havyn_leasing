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
  const upcoming = tours.filter((t) => t.status === "SCHEDULED");
  const byDate = upcoming.reduce<Record<string, typeof upcoming>>((acc, t) => {
    const key = new Date(t.scheduledAt).toISOString().slice(0, 10);
    acc[key] = acc[key] ?? [];
    acc[key].push(t);
    return acc;
  }, {});
  const dateKeys = Object.keys(byDate).sort();

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar view</CardTitle>
        </CardHeader>
        <CardContent>
          {dateKeys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scheduled tours.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dateKeys.map((d) => (
                <div key={d} className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">
                    {new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <ul className="space-y-2">
                    {byDate[d]
                      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
                      .map((t) => (
                        <li key={t.id} className="text-sm">
                          <p className="font-medium">
                            {new Date(t.scheduledAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-muted-foreground">
                            {t.lead.firstName} {t.lead.lastName}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
