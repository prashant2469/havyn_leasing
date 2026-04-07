"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListingOption, PropertyWithUnitsOption } from "@/domains/leasing/types";
import { createLeadAction } from "@/server/actions/leads";

export function CreateLeadForm({
  properties,
  listings,
}: {
  properties: PropertyWithUnitsOption[];
  listings: ListingOption[];
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const handleSuccess = useCallback(() => setOpen(false), []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((s) => s + 1);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="default">
            New lead
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        {open ? (
          <CreateLeadFormBody
            key={session}
            properties={properties}
            listings={listings}
            onSuccess={handleSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateLeadFormBody({
  properties,
  listings,
  onSuccess,
}: {
  properties: PropertyWithUnitsOption[];
  listings: ListingOption[];
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [state, action, pending] = useActionState(createLeadAction, null);
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [listingId, setListingId] = useState("");

  const units = useMemo(() => {
    const p = properties.find((x) => x.id === propertyId);
    return p?.units ?? [];
  }, [properties, propertyId]);

  useEffect(() => {
    if (state?.ok) {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      onSuccess();
    }
  }, [state?.ok, qc, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source">Source</Label>
        <Input id="source" name="source" placeholder="Zillow, walk-in…" />
      </div>

      <div className="space-y-2">
        <Label>Property interest</Label>
        <Select
          value={propertyId || "_none"}
          onValueChange={(v) => {
            setPropertyId(!v || v === "_none" ? "" : v);
            setUnitId("");
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Optional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">None</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="propertyId" value={propertyId} />
      </div>

      <div className="space-y-2">
        <Label>Unit interest</Label>
        <Select
          value={unitId || "_none"}
          onValueChange={(v) => setUnitId(!v || v === "_none" ? "" : v)}
          disabled={!propertyId || units.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={propertyId ? "Optional" : "Pick a property first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">None</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.unitNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="primaryUnitId" value={unitId} />
      </div>

      <div className="space-y-2">
        <Label>Listing (optional)</Label>
        <Select
          value={listingId || "_none"}
          onValueChange={(v) => setListingId(!v || v === "_none" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Link to listing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">None</SelectItem>
            {listings.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title} · {l.unit.property.name} #{l.unit.unitNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="listingId" value={listingId} />
      </div>

      {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Create lead"}
      </Button>
    </form>
  );
}
