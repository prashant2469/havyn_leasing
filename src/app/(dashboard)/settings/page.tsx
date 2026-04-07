import { PageHeader } from "@/components/shell/page-header";
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
import { prisma } from "@/server/db/client";

import { CreateResidentForm } from "./create-resident-form";

export default async function SettingsPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return <PageHeader title="Settings" description="Configure dev auth on the dashboard home first." />;
  }

  const [org, memberships, residents] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.organizationId } }),
    prisma.membership.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.resident.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Organization profile, team memberships (dev stub), and residents for lease creation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p className="font-medium text-foreground">{org?.name}</p>
          <p>Slug: {org?.slug}</p>
          <p className="mt-2">
            Replace the dev auth stub with Clerk, Auth.js, or your IdP; keep{" "}
            <code className="rounded bg-muted px-1">organizationId</code> on every query.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.user.name ?? "—"}</TableCell>
                  <TableCell>{m.user.email}</TableCell>
                  <TableCell>{m.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Residents</CardTitle>
          <CreateResidentForm />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                    No residents. Add one before creating a lease from an application.
                  </TableCell>
                </TableRow>
              ) : (
                residents.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.firstName} {r.lastName}
                    </TableCell>
                    <TableCell>{r.email ?? "—"}</TableCell>
                    <TableCell>{r.phone ?? "—"}</TableCell>
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
