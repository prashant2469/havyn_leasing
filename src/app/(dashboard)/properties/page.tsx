import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tryOrgContext } from "@/server/auth/context";
import { listProperties } from "@/server/services/properties/property.service";

import { CreatePropertyForm } from "./create-property-form";
import { PropertiesTable } from "./properties-table";

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
        <CardContent>
          {properties.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No properties yet. Create one to start the Property → Unit workflow.
            </p>
          ) : (
            <PropertiesTable properties={properties} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
