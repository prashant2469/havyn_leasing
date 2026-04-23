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
import { createPropertyAction } from "@/server/actions/properties";
import { Permission } from "@/server/auth/permissions";

export function CreatePropertyForm() {
  const canCreateProperty = useHasPermission(Permission.PROPERTIES_CREATE);
  const [state, action, pending] = useActionState(createPropertyAction, null);

  if (!canCreateProperty) return null;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="default">
            Add property
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New property</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="The Foundry" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="street">Street</Label>
            <Input id="street" name="street" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" name="postalCode" required />
          </div>
          <input type="hidden" name="country" value="US" />
          {state && !state.ok ? (
            <p className="text-destructive text-sm">{state.message}</p>
          ) : null}
          {state?.ok ? <p className="text-sm text-green-600">Saved.</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Create property"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
