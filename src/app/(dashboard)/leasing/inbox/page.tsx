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
        title="Pipeline board"
        description="Kanban command workspace for triage, communications, qualification, tours, and applications."
        actions={
          <>
            <Link href="/analysis" className={cn(buttonVariants({ variant: "outline" }))}>
              Analysis
            </Link>
            <Link href="/leasing/calendar" className={cn(buttonVariants({ variant: "outline" }))}>
              Calendar
            </Link>
          </>
        }
      />
      <LeasingInboxClient />
    </div>
  );
}
