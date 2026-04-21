import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";

import { CreateLeadForm } from "./create-lead-form";
import { LeadsTableClient } from "./leads-table-client";

export default async function LeadsPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return (
      <PageHeader title="Leasing hub" description="Configure dev auth on the dashboard home first." />
    );
  }

  const [properties, listings] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        units: { select: { id: true, unitNumber: true }, orderBy: { unitNumber: "asc" } },
      },
    }),
    prisma.listing.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leasing hub"
        description="Pipeline: listing → lead → inbox → tour → application. Table uses React Query (GET /api/leads). Prefer the unified inbox for daily ops."
        actions={
          <>
            <Link href="/analysis" className={cn(buttonVariants({ variant: "outline" }))}>
              Analysis
            </Link>
            <CreateLeadForm properties={properties} listings={listings} />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4">
            <LeadsTableClient />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
