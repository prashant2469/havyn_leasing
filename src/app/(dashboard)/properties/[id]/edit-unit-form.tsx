"use client";

import { UnitStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHasPermission } from "@/lib/use-permissions";
import { Permission } from "@/server/auth/permissions";
import { updateUnitAction } from "@/server/actions/properties";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

type Props = {
  unit: {
    id: string;
    propertyId: string;
    unitNumber: string;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    status: UnitStatus;
  };
};

export function EditUnitForm({ unit }: Props) {
  const canEditUnit = useHasPermission(Permission.UNITS_EDIT);
  const router = useRouter();
  const [state, action, pending] = useActionState(updateUnitAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  if (!canEditUnit) return null;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit unit {unit.unitNumber}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={unit.id} />
          <input type="hidden" name="propertyId" value={unit.propertyId} />
          <div className="space-y-2">
            <Label htmlFor={`unit-number-${unit.id}`}>Unit number</Label>
            <Input id={`unit-number-${unit.id}`} name="unitNumber" required defaultValue={unit.unitNumber} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`unit-beds-${unit.id}`}>Beds</Label>
              <Input
                id={`unit-beds-${unit.id}`}
                name="beds"
                type="number"
                step="0.5"
                min="0"
                defaultValue={unit.beds ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`unit-baths-${unit.id}`}>Baths</Label>
              <Input
                id={`unit-baths-${unit.id}`}
                name="baths"
                type="number"
                step="0.5"
                min="0"
                defaultValue={unit.baths ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`unit-sqft-${unit.id}`}>Sq ft</Label>
              <Input
                id={`unit-sqft-${unit.id}`}
                name="sqft"
                type="number"
                min="0"
                defaultValue={unit.sqft ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`unit-status-${unit.id}`}>Status</Label>
              <select
                id={`unit-status-${unit.id}`}
                name="status"
                className={nativeSelectClass}
                defaultValue={unit.status}
              >
                {Object.values(UnitStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving..." : "Save unit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
