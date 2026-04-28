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
    latitude: number | null;
    longitude: number | null;
    parkingType: string | null;
    parkingSpaces: number | null;
    laundryType: string | null;
    yearBuilt: number | null;
    propertyType: string | null;
    neighborhood: string | null;
    transitNotes: string | null;
    schoolDistrict: string | null;
    petRules: unknown;
    amenities: unknown;
    utilityNotes: string | null;
    leaseTerms: unknown;
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

  const scheduleObj =
    property.showingSchedule && typeof property.showingSchedule === "object" && !Array.isArray(property.showingSchedule)
      ? (property.showingSchedule as Record<string, unknown>)
      : {};
  const windows = Array.isArray(scheduleObj.weekdayWindows)
    ? (scheduleObj.weekdayWindows as Array<Record<string, unknown>>)
    : [];
  const primaryWindow = windows[0] ?? {};
  const scheduleWeekdays = Array.isArray(primaryWindow.weekdays)
    ? (primaryWindow.weekdays as Array<number>)
    : [1, 2, 3, 4, 5];
  const scheduleStart = typeof primaryWindow.start === "string" ? primaryWindow.start : "10:00";
  const scheduleEnd = typeof primaryWindow.end === "string" ? primaryWindow.end : "16:00";
  const scheduleDuration =
    typeof scheduleObj.tourDurationMinutes === "number" ? scheduleObj.tourDurationMinutes : 30;
  const scheduleBlackouts = Array.isArray(scheduleObj.blackouts)
    ? JSON.stringify(scheduleObj.blackouts, null, 2)
    : "[]";

  const petRulesObj =
    property.petRules && typeof property.petRules === "object" && !Array.isArray(property.petRules)
      ? (property.petRules as Record<string, unknown>)
      : {};
  const leaseTermsObj =
    property.leaseTerms && typeof property.leaseTerms === "object" && !Array.isArray(property.leaseTerms)
      ? (property.leaseTerms as Record<string, unknown>)
      : {};
  const amenitiesCsv = Array.isArray(property.amenities)
    ? (property.amenities as Array<unknown>).map((x) => String(x)).join(", ")
    : "";

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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="property-latitude">Latitude</Label>
            <Input id="property-latitude" name="latitude" defaultValue={property.latitude ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-longitude">Longitude</Label>
            <Input id="property-longitude" name="longitude" defaultValue={property.longitude ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="property-type">Property type</Label>
            <Input id="property-type" name="propertyType" defaultValue={property.propertyType ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-yearBuilt">Year built</Label>
            <Input id="property-yearBuilt" name="yearBuilt" type="number" defaultValue={property.yearBuilt ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="property-neighborhood">Neighborhood</Label>
            <Input id="property-neighborhood" name="neighborhood" defaultValue={property.neighborhood ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-schoolDistrict">School district</Label>
            <Input id="property-schoolDistrict" name="schoolDistrict" defaultValue={property.schoolDistrict ?? ""} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-transitNotes">Transit notes</Label>
          <textarea id="property-transitNotes" name="transitNotes" rows={2} defaultValue={property.transitNotes ?? ""} className={nativeSelectClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="property-parkingType">Parking type</Label>
            <Input id="property-parkingType" name="parkingType" defaultValue={property.parkingType ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-parkingSpaces">Parking spaces</Label>
            <Input id="property-parkingSpaces" name="parkingSpaces" type="number" defaultValue={property.parkingSpaces ?? ""} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-laundryType">Laundry type</Label>
          <Input id="property-laundryType" name="laundryType" defaultValue={property.laundryType ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-amenitiesCsv">Amenities (comma-separated)</Label>
          <Input id="property-amenitiesCsv" name="amenitiesCsv" defaultValue={amenitiesCsv} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-utilityNotes">Utilities</Label>
          <textarea id="property-utilityNotes" name="utilityNotes" rows={2} defaultValue={property.utilityNotes ?? ""} className={nativeSelectClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="pet-dogs">Dogs allowed</Label>
            <select id="pet-dogs" name="petDogsAllowed" defaultValue={String(petRulesObj.dogs ?? false)} className={nativeSelectClass}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pet-cats">Cats allowed</Label>
            <select id="pet-cats" name="petCatsAllowed" defaultValue={String(petRulesObj.cats ?? false)} className={nativeSelectClass}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="pet-maxWeight">Pet max weight</Label>
            <Input id="pet-maxWeight" name="petMaxWeight" type="number" defaultValue={typeof petRulesObj.maxWeight === "number" ? petRulesObj.maxWeight : ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pet-deposit">Pet deposit</Label>
            <Input id="pet-deposit" name="petDeposit" type="number" defaultValue={typeof petRulesObj.deposit === "number" ? petRulesObj.deposit : ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pet-monthlyFee">Pet monthly fee</Label>
            <Input id="pet-monthlyFee" name="petMonthlyFee" type="number" defaultValue={typeof petRulesObj.monthlyFee === "number" ? petRulesObj.monthlyFee : ""} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lease-min">Lease min months</Label>
            <Input id="lease-min" name="leaseMinMonths" type="number" defaultValue={typeof leaseTermsObj.minMonths === "number" ? leaseTermsObj.minMonths : ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lease-max">Lease max months</Label>
            <Input id="lease-max" name="leaseMaxMonths" type="number" defaultValue={typeof leaseTermsObj.maxMonths === "number" ? leaseTermsObj.maxMonths : ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lease-preferred">Lease preferred months</Label>
            <Input id="lease-preferred" name="leasePreferredMonths" type="number" defaultValue={typeof leaseTermsObj.preferredMonths === "number" ? leaseTermsObj.preferredMonths : ""} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Showing weekdays</Label>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {[
              { value: 0, label: "Sun" },
              { value: 1, label: "Mon" },
              { value: 2, label: "Tue" },
              { value: 3, label: "Wed" },
              { value: 4, label: "Thu" },
              { value: 5, label: "Fri" },
              { value: 6, label: "Sat" },
            ].map((d) => (
              <label key={d.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="scheduleWeekdays"
                  value={String(d.value)}
                  defaultChecked={scheduleWeekdays.includes(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
          <Input
            id="scheduleWeekdaysCsv"
            name="scheduleWeekdaysCsv"
            defaultValue={scheduleWeekdays.join(",")}
            className="mt-2"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="scheduleStart">Window start</Label>
            <Input id="scheduleStart" name="scheduleStart" defaultValue={scheduleStart} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduleEnd">Window end</Label>
            <Input id="scheduleEnd" name="scheduleEnd" defaultValue={scheduleEnd} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tourDurationMinutes">Tour duration (min)</Label>
            <Input id="tourDurationMinutes" name="tourDurationMinutes" type="number" defaultValue={scheduleDuration} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduleBlackoutsJson">Blackouts JSON</Label>
          <textarea id="scheduleBlackoutsJson" name="scheduleBlackoutsJson" rows={4} defaultValue={scheduleBlackouts} className={nativeSelectClass} />
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
