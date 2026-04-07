import Link from "next/link";

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
import { listProperties } from "@/server/services/properties/property.service";

import { CreatePropertyForm } from "./create-property-form";

export default async function PropertiesPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return (
      <PageHeader title="Properties" description="Configure dev auth on the dashboard home first." />
    );
  }

  const properties = await listProperties(ctx);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Properties"
        description="Portfolio root: each property contains units, leasing interest, and operational context."
        actions={<CreatePropertyForm />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All properties</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    No properties yet. Create one to start the Property → Unit workflow.
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.city}, {p.state}
                    </TableCell>
                    <TableCell className="text-right">{p._count.units}</TableCell>
                    <TableCell>
                      <Link
                        href={`/properties/${p.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Open
                      </Link>
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
