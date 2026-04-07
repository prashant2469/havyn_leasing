"use client";

import { ListingChannelType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { channelTypeLabel } from "@/domains/listings/constants";
import { ingestInquiryAction } from "@/server/actions/channel";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

export function IngestInquiryForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(ingestInquiryAction, null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Simulate inquiry ingestion</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Simulate a lead inquiry arriving from a channel. This runs the full ingest flow:
          creates a Lead, Conversation, Message, and logs activity events.
        </p>
        <form action={action} className="grid gap-3 max-w-md">
          <input type="hidden" name="listingId" value={listingId} />

          <div className="space-y-1.5">
            <Label htmlFor="channelType">Source channel</Label>
            <select
              id="channelType"
              name="channelType"
              className={nativeSelectClass}
              defaultValue={ListingChannelType.WEBSITE}
            >
              {Object.values(ListingChannelType).map((c) => (
                <option key={c} value={c}>
                  {channelTypeLabel[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required placeholder="Alex" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" required placeholder="Johnson" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="alex@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+1 555 0100" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Inquiry message</Label>
            <textarea
              id="message"
              name="message"
              rows={3}
              required
              className={nativeSelectClass}
              defaultValue="Hi, I'm interested in this listing. Is it still available?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="externalLeadId">External lead ID (optional)</Label>
            <Input
              id="externalLeadId"
              name="externalLeadId"
              placeholder="e.g. zillow-lead-12345"
            />
          </div>

          {state?.success && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ Inquiry ingested. Lead ID:{" "}
              <code className="font-mono">{state.data?.leadId}</code>
            </p>
          )}
          {state && !state.success && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Ingesting…" : "Ingest inquiry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
