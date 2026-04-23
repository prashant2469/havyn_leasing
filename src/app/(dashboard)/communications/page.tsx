import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tryOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";

export default async function CommunicationsPage() {
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const conversations = await prisma.conversation.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      lead: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Communications"
        description="Unified threads (SMS / email / voice ready). Messages are logged per lead; open a lead to view the full timeline."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    No conversations yet. Log a message from a lead record.
                  </TableCell>
                </TableRow>
              ) : (
                conversations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.subject ?? "Conversation"}</TableCell>
                    <TableCell>
                      {c.lead
                        ? `${c.lead.firstName} ${c.lead.lastName}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{c._count.messages}</TableCell>
                    <TableCell>
                      {c.lead ? (
                        <Link
                          href={`/leasing/leads/${c.lead.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open lead
                        </Link>
                      ) : null}
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
