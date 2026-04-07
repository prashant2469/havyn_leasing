import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { QueryProvider } from "@/components/providers/query-provider";
import { prisma } from "@/server/db/client";
import { tryOrgContext } from "@/server/auth/context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await tryOrgContext();
  const org = ctx
    ? await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      })
    : null;

  return (
    <QueryProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex min-h-svh flex-col">
          <AppTopbar subtitle={org?.name} />
          <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
