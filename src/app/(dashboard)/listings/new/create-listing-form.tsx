"use client";

import { ListingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listingStatusLabel } from "@/domains/listings/constants";
import { useHasPermission } from "@/lib/use-permissions";
import { createListingAction } from "@/server/actions/listings";
import { Permission } from "@/server/auth/permissions";

type UnitOption = {
  id: string;
  unitNumber: string;
  property: { id: string; name: string };
};

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

export function CreateListingForm({
  units,
  preselectedUnitId,
}: {
  units: UnitOption[];
  preselectedUnitId?: string;
}) {
  const canCreateListing = useHasPermission(Permission.LISTINGS_CREATE);
  const router = useRouter();
  const [state, action, pending] = useActionState(createListingAction, null);

  useEffect(() => {
    if (state?.ok && state.listingId) {
      router.push(`/listings/${state.listingId}`);
    }
  }, [state, router]);

  if (!canCreateListing) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-muted-foreground py-6 text-sm">
          You do not have permission to create listings.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Listing details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unitId">Unit</Label>
            <select
              id="unitId"
              name="unitId"
              required
              className={nativeSelectClass}
              defaultValue={preselectedUnitId ?? ""}
            >
              <option value="" disabled>
                Select unit
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.property.name} · {u.unitNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Sunny 2BR near campus" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className={nativeSelectClass}
              placeholder="Highlights, availability narrative…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="monthlyRent">Monthly rent</Label>
              <Input id="monthlyRent" name="monthlyRent" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availableFrom">Available from</Label>
              <Input id="availableFrom" name="availableFrom" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input id="bedrooms" name="bedrooms" type="number" step="0.5" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input id="bathrooms" name="bathrooms" type="number" step="0.25" min="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amenities">Amenities (comma-separated)</Label>
            <Input id="amenities" name="amenities" placeholder="W/D, parking, gym" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="petPolicy">Pet policy</Label>
            <Input id="petPolicy" name="petPolicy" placeholder="Cats ok, no dogs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Listing status</Label>
            <select id="status" name="status" className={nativeSelectClass} defaultValue={ListingStatus.DRAFT}>
              {Object.values(ListingStatus).map((s) => (
                <option key={s} value={s}>
                  {listingStatusLabel[s]}
                </option>
              ))}
            </select>
          </div>
          {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create listing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
