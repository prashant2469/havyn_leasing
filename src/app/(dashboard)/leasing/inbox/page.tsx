import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";

import { LeasingInboxClient } from "./leasing-inbox-client";

export default async function LeasingInboxPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    return (
      <PageHeader title="Leasing inbox" description="Configure dev auth on the dashboard home first." />
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title="Leasing inbox"
        description="Queues on the left, thread in the center, lead context on the right. Data from GET /api/leads?stage= and GET /api/leads/[id]."
        actions={
          <Link href="/leasing/leads" className={cn(buttonVariants({ variant: "outline" }))}>
            Table view
          </Link>
        }
      />
      <LeasingInboxClient />
    </div>
  );
}
