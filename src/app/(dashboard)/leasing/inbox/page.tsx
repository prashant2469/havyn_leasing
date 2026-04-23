import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";

import { LeasingInboxClient } from "./leasing-inbox-client";

export default async function LeasingInboxPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title="Leasing inbox"
        description="Queues on the left, thread in the center, lead context on the right. Data from GET /api/leads?stage= and GET /api/leads/[id]."
        actions={
          <>
            <Link href="/analysis" className={cn(buttonVariants({ variant: "outline" }))}>
              Analysis
            </Link>
            <Link href="/leasing/leads" className={cn(buttonVariants({ variant: "outline" }))}>
              Table view
            </Link>
          </>
        }
      />
      <LeasingInboxClient />
    </div>
  );
}
