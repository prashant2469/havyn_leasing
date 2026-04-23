import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tryOrgContext } from "@/server/auth/context";
import { getPropertyById } from "@/server/services/properties/property.service";

import { CreateUnitForm } from "./create-unit-form";
import { EditPropertyForm } from "./edit-property-form";
import { EditUnitForm } from "./edit-unit-form";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await tryOrgContext();
  if (!ctx) {
    return <PageHeader title="Property" description="Configure dev auth first." />;
  }

  const property = await getPropertyById(ctx, id);
  if (!property) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={property.name}
        description={`${property.street}, ${property.city}, ${property.state} ${property.postalCode}`}
        actions={
          <Link
            href="/properties"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to properties
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property profile</CardTitle>
        </CardHeader>
        <CardContent>
          <EditPropertyForm property={property} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Units</CardTitle>
          <CreateUnitForm propertyId={property.id} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Beds / baths</TableHead>
                <TableHead>Sq ft</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {property.units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No units yet.
                  </TableCell>
                </TableRow>
              ) : (
                property.units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.unitNumber}</TableCell>
                    <TableCell>
                      {u.beds ?? "—"} / {u.baths ?? "—"}
                    </TableCell>
                    <TableCell>{u.sqft ?? "—"}</TableCell>
                    <TableCell>{u.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/listings/new?unitId=${u.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Create listing
                        </Link>
                        <EditUnitForm
                          unit={{
                            id: u.id,
                            propertyId: property.id,
                            unitNumber: u.unitNumber,
                            beds: u.beds,
                            baths: u.baths,
                            sqft: u.sqft,
                            status: u.status,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
