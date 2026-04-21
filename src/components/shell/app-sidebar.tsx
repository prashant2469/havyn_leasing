"use client";

import {
  Activity,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Inbox,
  LayoutList,
  type LucideIcon,
  ListOrdered,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
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
  { href: "/leasing", label: "Leasing", icon: Inbox },
  { href: "/listings", label: "Listings", icon: LayoutList },
  { href: "/properties", label: "Portfolio", icon: Building2 },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const secondaryNav = [
  { href: "/leasing/inbox", label: "Inbox", icon: Inbox },
  { href: "/leasing/leads", label: "Leads", icon: Users },
  { href: "/leasing/applications", label: "Applications", icon: ClipboardList },
  { href: "/tours", label: "Tours", icon: ListOrdered },
  { href: "/communications", label: "Communications", icon: MessageSquare },
  { href: "/ai", label: "AI copilot", icon: Sparkles },
  { href: "/activity", label: "Activity", icon: Activity },
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

        <SidebarGroup>
          <SidebarGroupLabel>Leasing tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={secondaryNav} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
