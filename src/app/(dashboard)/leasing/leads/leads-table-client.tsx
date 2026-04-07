"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inboxStageLabel } from "@/domains/leasing/inbox";
import { leadStatusLabel } from "@/domains/leasing/constants";
import type { LeadInboxStage, LeadStatus } from "@prisma/client";

type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: LeadStatus;
  inboxStage: LeadInboxStage;
  nextActionAt: string | null;
  property: { name: string } | null;
  listing: { title: string } | null;
  assignedTo: { name: string | null; email: string } | null;
};

export function LeadsTableClient() {
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load leads");
      return json as { leads: LeadRow[] };
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading leads…</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        {error instanceof Error ? error.message : "Could not load leads"}
      </p>
    );
  }

  const leads = data?.leads ?? [];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Inbox</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Listing</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Next action</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.length === 0 ? (
            <TableRow>
            <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
              No leads yet.
            </TableCell>
          </TableRow>
        ) : (
          leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">
                {lead.firstName} {lead.lastName}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {inboxStageLabel[lead.inboxStage]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{leadStatusLabel[lead.status]}</Badge>
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm">
                {lead.listing?.title ?? "—"}
              </TableCell>
              <TableCell>{lead.property?.name ?? "—"}</TableCell>
              <TableCell>{lead.assignedTo?.name ?? lead.assignedTo?.email ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {lead.nextActionAt
                  ? new Date(lead.nextActionAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—"}
              </TableCell>
              <TableCell>
                <Link
                  href={`/leasing/leads/${lead.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open
                </Link>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
