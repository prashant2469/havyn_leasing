"use client";

import {
  Building2,
  FileText,
  Home,
  Inbox,
  LayoutList,
  ListOrdered,
  MapPin,
  MessageSquare,
  ScrollText,
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

const nav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/units", label: "Units", icon: MapPin },
  { href: "/listings", label: "Listings", icon: LayoutList },
  { href: "/leasing/inbox", label: "Leasing inbox", icon: Inbox },
  { href: "/leasing/leads", label: "All leads", icon: Users },
  { href: "/tours", label: "Tours", icon: ListOrdered },
  { href: "/activity", label: "Activity", icon: ScrollText },
  { href: "/communications", label: "Communications", icon: MessageSquare },
  { href: "/ai", label: "AI copilot", icon: Sparkles },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Havyn
        </Link>
        <p className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
          Listing hub · Inbox · Copilot
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
