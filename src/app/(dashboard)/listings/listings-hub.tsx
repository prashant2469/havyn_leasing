"use client";

import { ChannelPublishState, ListingChannelType, ListingStatus } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CopyTextButton } from "@/components/shell/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  channelPublishStateLabel,
  channelTypeIcon,
  channelTypeLabel,
  listingStatusLabel,
} from "@/domains/listings/constants";
import { prospectListingAbsoluteUrl } from "@/lib/public-url";
import { cn } from "@/lib/utils";

export type HubListingRow = {
  id: string;
  title: string;
  status: ListingStatus;
  monthlyRent: string;
  publicSlug: string | null;
  orgSlug: string;
  leadCount: number;
  photoUrl: string | null;
  unitLabel: string;
  channels: { channelType: ListingChannelType; publishState: ChannelPublishState }[];
  publishErrorCount: number;
};

function websitePublished(channels: HubListingRow["channels"]) {
  return channels.some(
    (c) => c.channelType === ListingChannelType.WEBSITE && c.publishState === ChannelPublishState.PUBLISHED,
  );
}

function publicMicrositeUrl(row: HubListingRow): string | null {
  if (!row.publicSlug?.trim() || !row.orgSlug?.trim()) return null;
  if (!websitePublished(row.channels)) return null;
  return prospectListingAbsoluteUrl(row.orgSlug, row.publicSlug);
}

function hasPublicSlug(row: HubListingRow) {
  return Boolean(row.publicSlug?.trim());
}

export function ListingsHub({ listings }: { listings: HubListingRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | ListingStatus>("all");
  const [micro, setMicro] = useState<"all" | "live" | "not_live" | "errors">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      const live = Boolean(publicMicrositeUrl(l));
      if (micro === "live" && !live) return false;
      if (micro === "not_live" && live) return false;
      if (micro === "errors" && l.publishErrorCount === 0) return false;
      if (!needle) return true;
      const hay = `${l.title} ${l.unitLabel}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [listings, q, status, micro]);

  const ChannelChips = ({ row }: { row: HubListingRow }) => (
    <div className="flex flex-wrap items-center gap-1">
      {row.channels.map((c) => (
        <span
          key={`${row.id}-${c.channelType}`}
          title={`${channelTypeLabel[c.channelType]}: ${channelPublishStateLabel[c.publishState]}`}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
            c.publishState === ChannelPublishState.PUBLISHED
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : c.publishState === ChannelPublishState.SYNC_ERROR
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                : c.publishState === ChannelPublishState.PAUSED
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-muted text-muted-foreground",
          )}
        >
          {channelTypeIcon[c.channelType]}
          <span className="hidden sm:inline">{channelTypeLabel[c.channelType]}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium" htmlFor="hub-search">
            Search
          </label>
          <Input
            id="hub-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title or unit…"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Status</span>
          <select
            className="border-input bg-background focus-visible:ring-ring flex h-9 rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All statuses</option>
            {Object.values(ListingStatus).map((s) => (
              <option key={s} value={s}>
                {listingStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Microsite</span>
          <select
            className="border-input bg-background focus-visible:ring-ring flex h-9 rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
            value={micro}
            onChange={(e) => setMicro(e.target.value as typeof micro)}
          >
            <option value="all">All</option>
            <option value="live">Public link live</option>
            <option value="not_live">Not live / no link</option>
            <option value="errors">Has publish errors</option>
          </select>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Showing {filtered.length} of {listings.length} listing{listings.length === 1 ? "" : "s"}
      </p>

      {/* Cards — mobile / tablet */}
      <div className="grid gap-4 lg:hidden">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No listings match your filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((l) => {
            const url = publicMicrositeUrl(l);
            const disabledReason = !hasPublicSlug(l)
              ? "Set a public slug on the listing detail page."
              : !websitePublished(l.channels)
                ? "Publish the Website channel to enable the public link."
                : !url
                  ? "Public URL unavailable."
                  : "";

            return (
              <Card key={l.id}>
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                  <div className="bg-muted relative h-16 w-24 shrink-0 overflow-hidden rounded-md">
                    {l.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center text-[10px]">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="text-base leading-tight">{l.title}</CardTitle>
                    <p className="text-muted-foreground text-xs">{l.unitLabel}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="outline">{listingStatusLabel[l.status]}</Badge>
                      <span className="text-muted-foreground text-xs tabular-nums">${l.monthlyRent}/mo</span>
                      <span className="text-muted-foreground text-xs">{l.leadCount} leads</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <ChannelChips row={l} />
                  {l.publishErrorCount > 0 ? (
                    <p className="text-destructive text-xs">
                      {l.publishErrorCount} channel publish error{l.publishErrorCount > 1 ? "s" : ""}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {url ? (
                      <>
                        <CopyTextButton text={url} label="Copy public link" />
                        <Link
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                        >
                          Open public page
                        </Link>
                      </>
                    ) : (
                      <span title={disabledReason} className="inline-flex">
                        <Button type="button" variant="secondary" size="sm" disabled>
                          Public page unavailable
                        </Button>
                      </span>
                    )}
                    <Link href={`/listings/${l.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      Manage
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Table — desktop */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[72px]" />
                <TableHead>Title</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rent / mo</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead className="w-[200px]">Public</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    No listings match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => {
                  const url = publicMicrositeUrl(l);
                  const disabledReason = !hasPublicSlug(l)
                    ? "Set a public slug on the listing detail page."
                    : !websitePublished(l.channels)
                      ? "Publish the Website channel to enable the public link."
                      : "";

                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="bg-muted relative h-12 w-16 overflow-hidden rounded">
                          {l.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.photoUrl} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{l.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{l.unitLabel}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{listingStatusLabel[l.status]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">${l.monthlyRent}</TableCell>
                      <TableCell>
                        <ChannelChips row={l} />
                        {l.publishErrorCount > 0 ? (
                          <span className="text-destructive ml-1 text-xs">
                            {l.publishErrorCount} error{l.publishErrorCount > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{l.leadCount}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {url ? (
                            <>
                              <CopyTextButton text={url} label="Copy link" className="w-full" />
                              <Link
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}
                              >
                                Open public page
                              </Link>
                            </>
                          ) : (
                            <span title={disabledReason} className="inline-flex w-full">
                              <Button type="button" variant="secondary" size="sm" className="w-full" disabled>
                                Public page unavailable
                              </Button>
                            </span>
                          )}
                        </div>
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
