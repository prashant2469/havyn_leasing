import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applicationStatusLabel } from "@/domains/leasing/constants";
import { inboxStageLabel } from "@/domains/leasing/inbox";
import { cn } from "@/lib/utils";
import { tryOrgContext } from "@/server/auth/context";
import { listApplicationsForOrg } from "@/server/services/leasing/application.service";

export default async function ApplicationsPipelinePage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const applications = await listApplicationsForOrg(ctx);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Rental applications across your organization, newest first. Open the lead workspace to change status or pipeline notes."
        actions={
          <>
            <Link href="/analysis" className={cn(buttonVariants({ variant: "outline" }))}>
              Analysis
            </Link>
            <Link href="/leasing/inbox" className={cn(buttonVariants({ variant: "outline" }))}>
              Inbox
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All applications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Lead stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                    No applications yet.
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.lead.firstName} {a.lead.lastName}
                      <div className="text-muted-foreground text-xs font-normal">{a.lead.email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inboxStageLabel[a.lead.inboxStage]}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{applicationStatusLabel[a.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/leasing/leads/${a.lead.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                        Lead
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
