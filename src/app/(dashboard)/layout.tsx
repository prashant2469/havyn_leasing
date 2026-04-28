import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { prisma } from "@/server/db/client";
import { listSessionMembershipOrgs, tryOrgContext } from "@/server/auth/context";
import { listRolePermissions } from "@/server/auth/permissions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/no-access");
  }
  const orgs = await listSessionMembershipOrgs();
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true },
  });
  const permissions = listRolePermissions(ctx.role);

  return (
    <PermissionsProvider value={{ role: ctx.role, permissions }}>
      <QueryProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex min-h-svh flex-col">
            <AppTopbar
              subtitle={org?.name}
              orgs={orgs}
              currentOrgId={ctx.organizationId}
              showSignOut={!!session?.user}
            />
            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </QueryProvider>
    </PermissionsProvider>
  );
}
