"use client";

import {
  ChannelPublishState,
  ChannelSyncOperation,
  ChannelSyncStatus,
  ConversationReplyMode,
  ListingChannelType,
  ListingStatus,
} from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { replyModeLabel } from "@/domains/channels/constants";
import {
  channelPublishStateColor,
  channelPublishStateLabel,
  channelTypeIcon,
  channelTypeLabel,
  listingStatusLabel,
  syncOperationLabel,
  syncStatusColor,
  syncStatusLabel,
} from "@/domains/listings/constants";
import {
  pauseListingChannelAction,
  publishListingChannelAction,
  retryListingChannelSyncAction,
  unpublishListingChannelAction,
} from "@/server/actions/channel";
import { CopyTextButton } from "@/components/shell/copy-button";
import { prospectListingAbsoluteUrl, prospectListingPath } from "@/lib/public-url";
import { CheckIcon, CircleIcon } from "lucide-react";
import { attachListingChannelAction, updateListingAction } from "@/server/actions/listings";
import { PhotoUploadPanel } from "./photo-upload-panel";
import { Permission } from "@/server/auth/permissions";
import { useHasPermission } from "@/lib/use-permissions";

type SyncRun = {
  id: string;
  operation: ChannelSyncOperation;
  status: ChannelSyncStatus;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

type Channel = {
  id: string;
  channelType: ListingChannelType;
  publishState: ChannelPublishState;
  publishStatus: string;
  externalListingId: string | null;
  replyModeDefault: ConversationReplyMode;
  lastSyncedAt: string | null;
  lastPublishedAt: string | null;
  lastSyncError: string | null;
  metadata: unknown;
  syncs: SyncRun[];
};

type ListingPayload = {
  id: string;
  updatedAt: string;
  title: string;
  description: string | null;
  monthlyRent: string;
  availableFrom: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: unknown;
  petPolicy: string | null;
  metadata: unknown;
  status: ListingStatus;
  publicSlug: string | null;
  unitId: string;
  organization: { slug: string; name: string };
  unit: { unitNumber: string; property: { id: string; name: string } };
  photos: {
    id: string;
    caption: string | null;
    sortOrder: number;
    isPrimary: boolean;
    url: string | null;
  }[];
  channels: Channel[];
};

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

function amenitiesToString(amenities: unknown): string {
  if (Array.isArray(amenities)) return (amenities as string[]).join(", ");
  return "";
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function listingMetadata(metadata: unknown): {
  publicPageHeader: string;
  accentColor: string;
  contactEmail: string;
  contactPhone: string;
} {
  const obj = typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {};
  return {
    publicPageHeader: typeof obj.publicPageHeader === "string" ? obj.publicPageHeader : "",
    accentColor: typeof obj.accentColor === "string" ? obj.accentColor : "",
    contactEmail: typeof obj.contactEmail === "string" ? obj.contactEmail : "",
    contactPhone: typeof obj.contactPhone === "string" ? obj.contactPhone : "",
  };
}

function ChannelActions({ channel }: { channel: Channel }) {
  const canPublishListing = useHasPermission(Permission.LISTINGS_PUBLISH);
  const [publishState, publishAction, publishPending] = useActionState(
    publishListingChannelAction,
    null,
  );
  const [pauseState, pauseAction, pausePending] = useActionState(
    pauseListingChannelAction,
    null,
  );
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(
    unpublishListingChannelAction,
    null,
  );
  const [retryState, retryAction, retryPending] = useActionState(
    retryListingChannelSyncAction,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (
      publishState?.success ||
      pauseState?.success ||
      unpublishState?.success ||
      retryState?.success
    ) {
      router.refresh();
    }
  }, [
    publishState?.success,
    pauseState?.success,
    unpublishState?.success,
    retryState?.success,
    router,
  ]);

  const isPublished = channel.publishState === ChannelPublishState.PUBLISHED;
  const isPaused = channel.publishState === ChannelPublishState.PAUSED;
  const isError = channel.publishState === ChannelPublishState.SYNC_ERROR;
  const isDraft =
    channel.publishState === ChannelPublishState.DRAFT ||
    channel.publishState === ChannelPublishState.UNPUBLISHED;

  const error =
    publishState?.error ?? pauseState?.error ?? unpublishState?.error ?? retryState?.error;

  if (!canPublishListing) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(isDraft || isError) && (
        <form action={publishAction}>
          <input type="hidden" name="listingChannelId" value={channel.id} />
          <Button type="submit" size="xs" variant="default" disabled={publishPending}>
            {publishPending ? "Publishing…" : "Publish"}
          </Button>
        </form>
      )}
      {isPublished && (
        <form action={pauseAction}>
          <input type="hidden" name="listingChannelId" value={channel.id} />
          <Button type="submit" size="xs" variant="outline" disabled={pausePending}>
            {pausePending ? "Pausing…" : "Pause"}
          </Button>
        </form>
      )}
      {(isPublished || isPaused) && (
        <form action={unpublishAction}>
          <input type="hidden" name="listingChannelId" value={channel.id} />
          <Button type="submit" size="xs" variant="ghost" disabled={unpublishPending}>
            {unpublishPending ? "Unpublishing…" : "Unpublish"}
          </Button>
        </form>
      )}
      {isError && (
        <form action={retryAction}>
          <input type="hidden" name="listingChannelId" value={channel.id} />
          <Button
            type="submit"
            size="xs"
            variant="destructive"
            disabled={retryPending}
          >
            {retryPending ? "Retrying…" : "Retry"}
          </Button>
        </form>
      )}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

export function ListingDetailForm({ listing }: { listing: ListingPayload }) {
  const canEditListing = useHasPermission(Permission.LISTINGS_EDIT);
  const canUploadPhotos = useHasPermission(Permission.PHOTOS_UPLOAD);
  const router = useRouter();
  const [updateState, updateAction, updatePending] = useActionState(updateListingAction, null);
  const [channelState, channelAction, channelPending] = useActionState(
    attachListingChannelAction,
    null,
  );

  useEffect(() => {
    if (updateState?.ok) router.refresh();
  }, [updateState?.ok, router]);

  useEffect(() => {
    if (channelState?.ok) router.refresh();
  }, [channelState?.ok, router]);

  const availableFrom =
    listing.availableFrom != null ? listing.availableFrom.slice(0, 10) : "";

  const attachableChannels = Object.values(ListingChannelType).filter(
    (t) => !listing.channels.some((c) => c.channelType === t),
  );

  const websiteChannel = listing.channels.find((c) => c.channelType === ListingChannelType.WEBSITE);
  const websitePublished = websiteChannel?.publishState === ChannelPublishState.PUBLISHED;
  const prospectPath =
    listing.publicSlug && websitePublished
      ? prospectListingPath(listing.organization.slug, listing.publicSlug)
      : "";
  const prospectAbsolute =
    listing.publicSlug && websitePublished
      ? prospectListingAbsoluteUrl(listing.organization.slug, listing.publicSlug)
      : "";
  const metadata = listingMetadata(listing.metadata);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Listing metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              key={`listing-edit-${listing.id}-${listing.updatedAt}`}
              action={updateAction}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="unitId" value={listing.unitId} />
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required defaultValue={listing.title} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publicSlug">Public URL slug</Label>
                <Input
                  id="publicSlug"
                  name="publicSlug"
                  placeholder="e.g. foundry-101"
                  defaultValue={listing.publicSlug ?? ""}
                  autoComplete="off"
                />
                <p className="text-muted-foreground text-xs">
                  Lowercase letters, numbers, and hyphens. Used in the prospect link{" "}
                  <code className="bg-muted rounded px-1">/r/{listing.organization.slug}/…</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="publicPageHeader">Public page header</Label>
                <Input
                  id="publicPageHeader"
                  name="publicPageHeader"
                  placeholder="e.g. Welcome to The Foundry"
                  defaultValue={metadata.publicPageHeader}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent color (hex)</Label>
                  <Input
                    id="accentColor"
                    name="accentColor"
                    placeholder="#2563eb"
                    defaultValue={metadata.accentColor}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Public contact email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    placeholder="leasing@example.com"
                    defaultValue={metadata.contactEmail}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Public contact phone</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  placeholder="+1 555 123 4567"
                  defaultValue={metadata.contactPhone}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  className={nativeSelectClass}
                  defaultValue={listing.description ?? ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="monthlyRent">Monthly rent</Label>
                  <Input
                    id="monthlyRent"
                    name="monthlyRent"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={listing.monthlyRent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availableFrom">Available from</Label>
                  <Input
                    id="availableFrom"
                    name="availableFrom"
                    type="date"
                    defaultValue={availableFrom}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    name="bedrooms"
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={listing.bedrooms ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    name="bathrooms"
                    type="number"
                    step="0.25"
                    min="0"
                    defaultValue={listing.bathrooms ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                <Input
                  id="amenities"
                  name="amenities"
                  defaultValue={amenitiesToString(listing.amenities)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="petPolicy">Pet policy</Label>
                <Input id="petPolicy" name="petPolicy" defaultValue={listing.petPolicy ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  className={nativeSelectClass}
                  defaultValue={listing.status}
                >
                  {Object.values(ListingStatus).map((s) => (
                    <option key={s} value={s}>
                      {listingStatusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>
              {updateState && !updateState.ok ? (
                <p className="text-destructive text-sm">{updateState.message}</p>
              ) : null}
              {canEditListing ? (
                <Button type="submit" disabled={updatePending}>
                  {updatePending ? "Saving…" : "Save changes"}
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">You do not have permission to edit listing details.</p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {canUploadPhotos ? (
              <PhotoUploadPanel listingId={listing.id} photos={listing.photos} />
            ) : (
              <p className="text-muted-foreground text-sm">You do not have permission to manage photos.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/30 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-foreground font-medium">Public microsite readiness</p>
          <p className="text-muted-foreground text-xs">
            Live when you have a slug and the Website channel is published.
          </p>
        </div>
        <ul className="text-muted-foreground flex flex-col gap-1.5 text-xs sm:items-end">
          <li className="flex items-center gap-2">
            {listing.publicSlug ? (
              <CheckIcon className="text-green-600 size-3.5 shrink-0 dark:text-green-400" aria-hidden />
            ) : (
              <CircleIcon className="size-3.5 shrink-0 opacity-40" aria-hidden />
            )}
            Public slug set
          </li>
          <li className="flex items-center gap-2">
            {websitePublished ? (
              <CheckIcon className="text-green-600 size-3.5 shrink-0 dark:text-green-400" aria-hidden />
            ) : (
              <CircleIcon className="size-3.5 shrink-0 opacity-40" aria-hidden />
            )}
            Website channel published
          </li>
          <li>
            {prospectPath ? (
              <Link
                href={prospectPath}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                Open public preview
              </Link>
            ) : (
              <span className="opacity-70">Preview available when live</span>
            )}
          </li>
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prospect microsite</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          {!listing.publicSlug ? (
            <p>Set a public URL slug above, publish the Website channel, then share the link with prospects.</p>
          ) : !websitePublished ? (
            <p>
              This listing has slug <code className="bg-muted rounded px-1">{listing.publicSlug}</code> but the
              Website channel is not published yet — publish it to go live.
            </p>
          ) : (
            <>
              <p className="text-foreground text-xs font-medium">Shareable URL</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="bg-muted max-w-full flex-1 truncate rounded px-2 py-1.5 text-xs">
                  {prospectAbsolute || prospectPath}
                </code>
                <CopyTextButton text={prospectAbsolute || prospectPath} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Channel management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Channel management</CardTitle>
          {canEditListing && attachableChannels.length > 0 && (
            <form action={channelAction} className="flex items-center gap-2">
              <input type="hidden" name="listingId" value={listing.id} />
              <select name="channelType" className="border-input bg-background h-8 rounded-md border px-2 py-0.5 text-sm">
                {attachableChannels.map((t) => (
                  <option key={t} value={t}>
                    {channelTypeLabel[t]}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="secondary" disabled={channelPending}>
                Add channel
              </Button>
              {channelState && !channelState.ok ? (
                <span className="text-destructive text-xs">{channelState.message}</span>
              ) : null}
            </form>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>State</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Reply mode</TableHead>
                <TableHead>Last synced</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listing.channels.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-6 text-center text-sm"
                  >
                    No channels attached.
                  </TableCell>
                </TableRow>
              ) : (
                listing.channels.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <span>{channelTypeIcon[c.channelType]}</span>
                        {channelTypeLabel[c.channelType]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (channelPublishStateColor[c.publishState] as
                            | "default"
                            | "secondary"
                            | "outline"
                            | "destructive") ?? "secondary"
                        }
                      >
                        {channelPublishStateLabel[c.publishState]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {c.externalListingId ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {replyModeLabel[c.replyModeDefault]}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatRelativeDate(c.lastSyncedAt)}
                    </TableCell>
                    <TableCell
                      className="text-destructive max-w-[160px] truncate text-xs"
                      title={c.lastSyncError ?? undefined}
                    >
                      {c.lastSyncError ?? "—"}
                    </TableCell>
                    <TableCell>
                      <ChannelActions channel={c} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sync history */}
      {listing.channels.some((c) => c.syncs.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listing.channels
                  .flatMap((c) =>
                    c.syncs.map((s) => ({ ...s, channelType: c.channelType })),
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
                  )
                  .map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        {channelTypeIcon[s.channelType]} {channelTypeLabel[s.channelType]}
                      </TableCell>
                      <TableCell className="text-sm">
                        {syncOperationLabel[s.operation]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (syncStatusColor[s.status] as
                              | "default"
                              | "secondary"
                              | "outline"
                              | "destructive") ?? "secondary"
                          }
                        >
                          {syncStatusLabel[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatRelativeDate(s.startedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatRelativeDate(s.completedAt)}
                      </TableCell>
                      <TableCell
                        className="text-destructive max-w-[200px] truncate text-xs"
                        title={s.errorMessage ?? undefined}
                      >
                        {s.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
