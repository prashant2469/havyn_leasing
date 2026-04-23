"use client";

import { PropertyStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHasPermission } from "@/lib/use-permissions";
import { Permission } from "@/server/auth/permissions";
import { deletePropertyAction, updatePropertyAction } from "@/server/actions/properties";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

type Props = {
  property: {
    id: string;
    name: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    status: PropertyStatus;
    showingSchedule: unknown;
  };
};

export function EditPropertyForm({ property }: Props) {
  const canEditProperty = useHasPermission(Permission.PROPERTIES_EDIT);
  const canDeleteProperty = useHasPermission(Permission.PROPERTIES_DELETE);
  const router = useRouter();
  const [updateState, updateAction, updatePending] = useActionState(updatePropertyAction, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePropertyAction, null);

  useEffect(() => {
    if (updateState?.ok) router.refresh();
  }, [router, updateState?.ok]);

  useEffect(() => {
    if (deleteState?.ok) router.push("/properties");
  }, [deleteState?.ok, router]);

  if (!canEditProperty && !canDeleteProperty) {
    return (
      <p className="text-muted-foreground text-sm">
        You do not have permission to edit this property.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canEditProperty ? (
        <form action={updateAction} className="space-y-4">
        <input type="hidden" name="id" value={property.id} />
        <div className="space-y-2">
          <Label htmlFor="property-name">Name</Label>
          <Input id="property-name" name="name" defaultValue={property.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-street">Street</Label>
          <Input id="property-street" name="street" defaultValue={property.street} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="property-city">City</Label>
            <Input id="property-city" name="city" defaultValue={property.city} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-state">State</Label>
            <Input id="property-state" name="state" defaultValue={property.state} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="property-postal">Postal code</Label>
            <Input id="property-postal" name="postalCode" defaultValue={property.postalCode} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-country">Country</Label>
            <Input id="property-country" name="country" defaultValue={property.country} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-status">Status</Label>
          <select
            id="property-status"
            name="status"
            defaultValue={property.status}
            className={nativeSelectClass}
          >
            {Object.values(PropertyStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-schedule">Showing schedule (JSON)</Label>
          <textarea
            id="property-schedule"
            name="showingScheduleJson"
            rows={5}
            defaultValue={JSON.stringify(property.showingSchedule ?? {}, null, 2)}
            className={nativeSelectClass}
          />
        </div>
        {updateState && !updateState.ok ? (
          <p className="text-destructive text-sm">{updateState.message}</p>
        ) : null}
        {updateState?.ok ? <p className="text-sm text-green-600">Saved.</p> : null}
        <Button type="submit" disabled={updatePending}>
          {updatePending ? "Saving..." : "Save property"}
        </Button>
        </form>
      ) : null}

      {canDeleteProperty ? (
        <>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={property.id} />
            <Button type="submit" variant="destructive" disabled={deletePending}>
              {deletePending ? "Deleting..." : "Delete property"}
            </Button>
          </form>
          {deleteState && !deleteState.ok ? (
            <p className="text-destructive text-sm">{deleteState.message}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
