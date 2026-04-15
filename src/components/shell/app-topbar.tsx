import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { OrgSwitcher } from "./org-switcher";
import { SignOutControl } from "./sign-out-control";

export type OrgOption = { organizationId: string; name: string };

export function AppTopbar({
  subtitle,
  orgs,
  currentOrgId,
  showSignOut,
}: {
  subtitle?: string;
  orgs?: OrgOption[];
  currentOrgId?: string;
  showSignOut?: boolean;
}) {
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-6" />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-sm">
          {subtitle ?? "Property management workspace"}
        </p>
      </div>
      {orgs && currentOrgId ? <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} /> : null}
      {showSignOut ? (
        <SignOutControl className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")} />
      ) : null}
    </header>
  );
}
