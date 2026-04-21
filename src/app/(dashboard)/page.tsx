import {
  BarChart3,
  Building2,
  Inbox,
  LayoutList,
  ListOrdered,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";

const shortcuts = [
  {
    href: "/leasing",
    title: "Leasing workspace",
    description: "Single command center for inbox, leads, applications, and tours.",
    icon: Users,
  },
  {
    href: "/leasing/inbox",
    title: "Leasing inbox",
    description: "Queues, conversation thread, lead context — operations command center.",
    icon: Inbox,
  },
  {
    href: "/analysis",
    title: "Analysis",
    description: "Track response speed, tour completion, and application-to-lease conversion.",
    icon: BarChart3,
  },
  {
    href: "/listings",
    title: "Listing hub",
    description: "Create listings, attach channels, publish state and sync history.",
    icon: LayoutList,
  },
  {
    href: "/properties",
    title: "Portfolio",
    description: "Property and unit structure feeding listings and leasing.",
    icon: Building2,
  },
  {
    href: "/tours",
    title: "Tours",
    description: "Scheduled tours across leads and listings.",
    icon: ListOrdered,
  },
  {
    href: "/activity",
    title: "Activity",
    description: "Cross-entity audit trail from logged events.",
    icon: ScrollText,
  },
  {
    href: "/ai",
    title: "AI copilot",
    description: "Structure for drafts, summaries, and review-gated actions.",
    icon: Sparkles,
  },
];

export default async function DashboardHomePage() {
  const ctx = await tryOrgContext();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome to Havyn"
        description={
          ctx
            ? "Jump into the workflows that matter. Counts live in list views and the inbox."
            : "Local dev needs a database once. After setup, this page loads full data across the app."
        }
        actions={
          ctx ? (
            <Link href="/leasing" className={buttonVariants()}>
              Open leasing workspace
            </Link>
          ) : null
        }
      />

      {!ctx ? (
        <div className="border-border bg-muted/40 rounded-lg border p-4 text-sm">
          <p className="font-medium">Finish local setup (one command)</p>
          <p className="text-muted-foreground mt-1">
            Starts Postgres in Docker, applies the schema, seeds demo data, and writes{" "}
            <code className="rounded bg-muted px-1">DEV_*</code> to{" "}
            <code className="rounded bg-muted px-1">.env.local</code> for you.
          </p>
          <pre className="bg-background mt-3 overflow-x-auto rounded-md border p-3 font-mono text-xs">
            npm run db:setup
          </pre>
          <p className="text-muted-foreground mt-2 text-xs">
            Requires Docker. Then restart <code className="rounded bg-muted px-1">npm run dev</code> if
            it is already running.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                    <Icon className="text-muted-foreground size-4" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <span className={cn(buttonVariants({ variant: "link", className: "h-auto px-0" }))}>
                    Go →
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
