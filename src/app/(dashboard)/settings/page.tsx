import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

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
import { Permission, hasPermission } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { listGoogleCalendars } from "@/server/services/google/google-calendar.service";

import { CreateResidentForm } from "./create-resident-form";
import { InviteTeamMemberForm } from "./invite-team-member-form";
import { TeamMemberActions } from "./team-member-actions";
import { GoogleCalendarSettingsCard } from "./google-calendar-settings-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ googleCalendar?: string }>;
}) {
  const { googleCalendar } = await searchParams;
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
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
  let googleConnection: { calendarId: string } | null = null;
  let calendars: Array<{ id: string; summary: string; primary?: boolean }> = [];
  let googleCalendarUnavailable = false;
  let googleCalendarError: string | null = null;
  try {
    googleConnection = await prisma.googleCalendarConnection.findUnique({
      where: {
        organizationId_userId: { organizationId: ctx.organizationId, userId: ctx.userId },
      },
      select: { calendarId: true },
    });
    calendars = googleConnection ? await listGoogleCalendars(ctx.organizationId, ctx.userId) : [];
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      googleCalendarUnavailable = true;
    } else if (error instanceof Error) {
      googleCalendarError = error.message;
    } else {
      googleCalendarError = "Google Calendar request failed.";
    }
  }
  const connectUrl = "/api/settings/google-calendar/connect";
  const canInvite = hasPermission(ctx.role, Permission.TEAM_INVITE);
  const canManageRoles = hasPermission(ctx.role, Permission.TEAM_MANAGE_ROLES);
  const canEditSettings = hasPermission(ctx.role, Permission.SETTINGS_EDIT);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Organization profile, team memberships, security, and residents for lease creation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p className="font-medium text-foreground">{org?.name}</p>
          <p>Slug: {org?.slug}</p>
          <p className="mt-2">
            Keep{" "}
            <code className="rounded bg-muted px-1">organizationId</code> on every query.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <InviteTeamMemberForm canInvite={canInvite} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[280px]">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.user.name ?? "—"}</TableCell>
                  <TableCell>{m.user.email}</TableCell>
                  <TableCell>{m.role}</TableCell>
                  <TableCell>
                    <TeamMemberActions
                      membershipId={m.id}
                      currentRole={m.role}
                      canManageRoles={canManageRoles}
                      isCurrentUser={m.userId === ctx.userId}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Residents</CardTitle>
          {canEditSettings ? <CreateResidentForm /> : null}
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

      <GoogleCalendarSettingsCard
        connected={!googleCalendarUnavailable && Boolean(googleConnection)}
        connectUrl={connectUrl}
        selectedCalendarId={googleConnection?.calendarId ?? null}
        calendars={calendars}
        unavailableReason={
          googleCalendarUnavailable
            ? "Google Calendar setup pending: run database migration first (table not found)."
            : googleCalendarError
              ? `Google Calendar error: ${googleCalendarError}`
            : googleCalendar === "missing_env"
              ? "Google OAuth is not configured yet. Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to your environment."
              : googleCalendar === "connect_failed"
                ? "Could not start Google OAuth. Please retry and check server logs."
                : googleCalendar === "error"
                  ? "Google OAuth failed. Please retry and confirm callback URL and OAuth app settings."
            : null
        }
      />
    </div>
  );
}
