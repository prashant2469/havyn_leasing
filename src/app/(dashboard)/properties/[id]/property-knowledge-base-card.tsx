"use client";

import { PropertyFactCategory } from "@prisma/client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  createPropertyFactAction,
  deletePropertyFactAction,
  importStructuredPropertyFactsAction,
  seedPropertyFactsAction,
  updatePropertyFactAction,
} from "@/server/actions/property-facts";
import {
  propertyFactCategoryLabel,
  propertyFactCategoryOrder,
} from "@/domains/knowledge-base/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type FactRow = {
  id: string;
  propertyId: string;
  unitId: string | null;
  category: PropertyFactCategory;
  question: string;
  answer: string;
  isPublic: boolean;
  sortOrder: number;
  unit: { id: string; unitNumber: string } | null;
};

export function PropertyKnowledgeBaseCard({
  propertyId,
  facts,
  units,
}: {
  propertyId: string;
  facts: FactRow[];
  units: Array<{ id: string; unitNumber: string }>;
}) {
  const grouped = Object.fromEntries(
    propertyFactCategoryOrder.map((category) => [
      category,
      facts.filter((f) => f.category === category),
    ]),
  ) as Record<PropertyFactCategory, FactRow[]>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Knowledge base</CardTitle>
        <div className="flex items-center gap-2">
          <SeedDefaultsForm propertyId={propertyId} />
          <ImportStructuredForm propertyId={propertyId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateFactForm propertyId={propertyId} units={units} />
        {propertyFactCategoryOrder.map((category) => {
          const rows = grouped[category] ?? [];
          return (
            <details key={category} className="rounded-md border p-3" open={rows.length > 0}>
              <summary className="cursor-pointer text-sm font-semibold">
                {propertyFactCategoryLabel[category]}{" "}
                <span className="text-muted-foreground text-xs">({rows.length})</span>
              </summary>
              <div className="mt-3 space-y-3">
                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No facts yet in this category.</p>
                ) : (
                  rows.map((fact) => <FactEditorRow key={fact.id} fact={fact} units={units} />)
                )}
              </div>
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CreateFactForm({
  propertyId,
  units,
}: {
  propertyId: string;
  units: Array<{ id: string; unitNumber: string }>;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createPropertyFactAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <form action={action} className="grid gap-3 rounded-md border p-3 md:grid-cols-6">
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="fact-question">Question</Label>
        <Input id="fact-question" name="question" placeholder="e.g. Do you allow large dogs?" required />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="fact-answer">Answer</Label>
        <Input id="fact-answer" name="answer" placeholder="e.g. Yes, up to 50 lbs with deposit + fee." required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="fact-category">Category</Label>
        <select
          id="fact-category"
          name="category"
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          defaultValue={PropertyFactCategory.GENERAL}
        >
          {propertyFactCategoryOrder.map((c) => (
            <option key={c} value={c}>
              {propertyFactCategoryLabel[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="fact-unit">Scope</Label>
        <select
          id="fact-unit"
          name="unitId"
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          defaultValue=""
        >
          <option value="">Property-wide</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              Unit {u.unitNumber}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-6 flex items-center justify-between">
        <label className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <input type="checkbox" name="isPublic" value="true" defaultChecked />
          Publicly shareable fact
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding..." : "Add fact"}
        </Button>
      </div>
      {state && !state.ok ? <p className="text-destructive text-xs md:col-span-6">{state.message}</p> : null}
    </form>
  );
}

function FactEditorRow({
  fact,
  units,
}: {
  fact: FactRow;
  units: Array<{ id: string; unitNumber: string }>;
}) {
  const router = useRouter();
  const [updateState, updateAction, updating] = useActionState(updatePropertyFactAction, null);
  const [deleteState, deleteAction, deleting] = useActionState(deletePropertyFactAction, null);
  useEffect(() => {
    if (updateState?.ok || deleteState?.ok) router.refresh();
  }, [updateState?.ok, deleteState?.ok, router]);

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{propertyFactCategoryLabel[fact.category]}</Badge>
        <Badge variant="secondary">{fact.unit ? `Unit ${fact.unit.unitNumber}` : "Property-wide"}</Badge>
      </div>

      <form action={updateAction} className="grid gap-2 md:grid-cols-6">
        <input type="hidden" name="id" value={fact.id} />
        <input type="hidden" name="propertyId" value={fact.propertyId} />
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`q-${fact.id}`}>Question</Label>
          <Input id={`q-${fact.id}`} name="question" defaultValue={fact.question} required />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`a-${fact.id}`}>Answer</Label>
          <Input id={`a-${fact.id}`} name="answer" defaultValue={fact.answer} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`c-${fact.id}`}>Category</Label>
          <select
            id={`c-${fact.id}`}
            name="category"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            defaultValue={fact.category}
          >
            {propertyFactCategoryOrder.map((c) => (
              <option key={c} value={c}>
                {propertyFactCategoryLabel[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`u-${fact.id}`}>Scope</Label>
          <select
            id={`u-${fact.id}`}
            name="unitId"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            defaultValue={fact.unitId ?? ""}
          >
            <option value="">Property-wide</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.unitNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <input type="checkbox" name="isPublic" value="true" defaultChecked={fact.isPublic} />
              Public
            </label>
            <label className="text-xs text-muted-foreground inline-flex items-center gap-2">
              Sort
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={fact.sortOrder}
                className="border-input bg-background h-8 w-20 rounded-md border px-2 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="secondary" disabled={updating}>
              {updating ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
      <form action={deleteAction} className="mt-2">
        <input type="hidden" name="id" value={fact.id} />
        <input type="hidden" name="propertyId" value={fact.propertyId} />
        <Button type="submit" size="sm" variant="destructive" disabled={deleting}>
          {deleting ? "Removing..." : "Delete"}
        </Button>
      </form>
      {updateState && !updateState.ok ? (
        <p className="text-destructive mt-2 text-xs">{updateState.message}</p>
      ) : null}
      {deleteState && !deleteState.ok ? (
        <p className="text-destructive mt-1 text-xs">{deleteState.message}</p>
      ) : null}
    </div>
  );
}

function SeedDefaultsForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(seedPropertyFactsAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Seeding..." : "Seed defaults"}
      </Button>
      {state && !state.ok ? <span className="text-destructive text-xs">{state.message}</span> : null}
    </form>
  );
}

function ImportStructuredForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(importStructuredPropertyFactsAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Importing..." : "Import structured"}
      </Button>
      {state && !state.ok ? <span className="text-destructive text-xs">{state.message}</span> : null}
    </form>
  );
}
