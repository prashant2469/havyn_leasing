"use client";

import { PropertyStatus, UnitStatus } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PropertyRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  status: PropertyStatus;
  _count: { units: number };
  units: { id: string; status: UnitStatus }[];
};

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-[180px] rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

export function PropertiesTable({ properties }: { properties: PropertyRow[] }) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | PropertyStatus>("ALL");

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return properties;
    return properties.filter((property) => property.status === statusFilter);
  }, [properties, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label htmlFor="property-status-filter" className="text-sm font-medium">
          Status
        </label>
        <select
          id="property-status-filter"
          className={nativeSelectClass}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | PropertyStatus)}
        >
          <option value="ALL">All statuses</option>
          {Object.values(PropertyStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-right">Vacancy</TableHead>
            <TableHead className="w-[120px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                No properties match this filter.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((property) => {
              const totalUnits = property._count.units;
              const vacantUnits = property.units.filter((unit) => unit.status === UnitStatus.VACANT).length;
              return (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">{property.name}</TableCell>
                  <TableCell>
                    {property.city}, {property.state}
                  </TableCell>
                  <TableCell>
                    <Badge variant={property.status === PropertyStatus.ACTIVE ? "default" : "outline"}>
                      {property.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{totalUnits}</TableCell>
                  <TableCell className="text-right">{vacantUnits}/{totalUnits || 0} vacant</TableCell>
                  <TableCell>
                    <Link
                      href={`/properties/${property.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
