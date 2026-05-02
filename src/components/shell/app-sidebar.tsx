"use client";

import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  FileText,
  Inbox,
  LayoutList,
  type LucideIcon,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const primaryNav = [
  { href: "/leasing", label: "Command center", icon: Inbox },
  { href: "/leasing/inbox", label: "Pipeline board", icon: LayoutList },
  { href: "/leasing/calendar", label: "Calendar", icon: Calendar },
  { href: "/listings", label: "Listings", icon: LayoutList },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/activity", label: "Activity log", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavList({
  items,
  pathname,
}: {
  items: { href: string; label: string; icon: LucideIcon }[];
  pathname: string;
}) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={item.label}
              render={
                <Link href={item.href} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Havyn
        </Link>
        <p className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
          Leasing workspace and performance
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Primary</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={primaryNav} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
