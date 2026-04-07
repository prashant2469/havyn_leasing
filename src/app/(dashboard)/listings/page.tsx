import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
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
import {
  channelPublishStateColor,
  channelPublishStateLabel,
  channelTypeIcon,
  channelTypeLabel,
  listingStatusLabel,
} from "@/domains/listings/constants";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { listListings } from "@/server/services/listings/listing.service";

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Listing hub"
        description="Manage listings and per-channel publish state. Zillow/Facebook adapters are placeholder until external APIs are integrated."
        actions={
          <Link href="/listings/new" className={buttonVariants()}>
            New listing
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All listings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rent / mo</TableHead>
                <TableHead>Channel health</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No listings yet. Create one from a unit.
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((l) => {
                  const publishedCount = l.channels.filter(
                    (c) => c.publishState === "PUBLISHED",
                  ).length;
                  const errorCount = l.channels.filter(
                    (c) => c.publishState === "SYNC_ERROR",
                  ).length;

                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {l.unit.property.name} · {l.unit.unitNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{listingStatusLabel[l.status]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        ${l.monthlyRent.toString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {l.channels.map((c) => (
                            <span
                              key={c.id}
                              title={`${channelTypeLabel[c.channelType]}: ${channelPublishStateLabel[c.publishState]}`}
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                                c.publishState === "PUBLISHED"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : c.publishState === "SYNC_ERROR"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                    : c.publishState === "PAUSED"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                      : "bg-muted text-muted-foreground",
                              )}
                            >
                              {channelTypeIcon[c.channelType]}
                              <span className="hidden sm:inline">
                                {channelTypeLabel[c.channelType]}
                              </span>
                            </span>
                          ))}
                          {errorCount > 0 && (
                            <span className="text-destructive ml-1 text-xs">
                              {errorCount} error{errorCount > 1 ? "s" : ""}
                            </span>
                          )}
                          {publishedCount === 0 && l.channels.length > 0 && (
                            <span className="text-muted-foreground text-xs">
                              Not published
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {l._count.leads}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/listings/${l.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Manage
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
