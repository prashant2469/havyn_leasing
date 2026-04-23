"use client";

import { useActionState } from "react";

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
import { createUnitAction } from "@/server/actions/properties";

export function CreateUnitForm({ propertyId }: { propertyId: string }) {
  const canCreateUnit = useHasPermission(Permission.UNITS_CREATE);
  const [state, action, pending] = useActionState(createUnitAction, null);

  if (!canCreateUnit) return null;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="secondary">
            Add unit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New unit</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="propertyId" value={propertyId} />
          <div className="space-y-2">
            <Label htmlFor="unitNumber">Unit number</Label>
            <Input id="unitNumber" name="unitNumber" required placeholder="101" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="beds">Beds</Label>
              <Input id="beds" name="beds" type="number" step="0.5" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baths">Baths</Label>
              <Input id="baths" name="baths" type="number" step="0.5" min="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sqft">Sq ft</Label>
            <Input id="sqft" name="sqft" type="number" min="0" />
          </div>
          {state && !state.ok ? (
            <p className="text-destructive text-sm">{state.message}</p>
          ) : null}
          {state?.ok ? <p className="text-sm text-green-600">Unit created.</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Create unit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
