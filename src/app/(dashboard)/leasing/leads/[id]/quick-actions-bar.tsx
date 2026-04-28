"use client";

import { ApplicationStatus, LeadStatus } from "@prisma/client";
import { useActionState, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prospectListingPath } from "@/lib/public-url";
import {
  fastTrackLeaseAction,
  markContactedAction,
  quickApproveApplicationAction,
  quickScheduleTourAction,
} from "@/server/actions/lead-pipeline";

type QuickActionsBarProps = {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: LeadStatus;
    primaryUnitId: string | null;
    listing: {
      id: string;
      publicSlug: string | null;
      organizationSlug: string;
      monthlyRent: string;
      unit: { id: string };
    } | null;
    tours: { id: string }[];
  };
  application: { id: string; status: ApplicationStatus; lease: { id: string; status: string } | null } | null;
  units: { id: string; unitNumber: string; propertyName: string }[];
  onDone: () => void;
};

export function QuickActionsBar({
  lead,
  application,
  units,
  onDone,
}: QuickActionsBarProps) {
  const hasTour = lead.tours.length > 0;
  const hasLease = Boolean(application?.lease);
  const canMarkContacted = lead.status === LeadStatus.NEW;
  const canScheduleTour = !hasTour && (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED);
  const canShareApplicationLink =
    !application && (lead.status === LeadStatus.CONTACTED || lead.status === LeadStatus.TOURING);
  const canQuickApprove = Boolean(application && application.status !== ApplicationStatus.APPROVED && !hasLease);
  const canConvertToLease = Boolean(application && application.status === ApplicationStatus.APPROVED && !hasLease);

  const [showTourForm, setShowTourForm] = useState(false);
  const [showLeaseForm, setShowLeaseForm] = useState(false);
  const [tourScheduledAt, setTourScheduledAt] = useState("");
  const [tourNotes, setTourNotes] = useState("");
  const [leaseUnitId, setLeaseUnitId] = useState(lead.primaryUnitId ?? lead.listing?.unit.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [leaseStartDate, setLeaseStartDate] = useState(today);
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [leaseRentAmount, setLeaseRentAmount] = useState(lead.listing?.monthlyRent ?? "");
  const [leaseDepositAmount, setLeaseDepositAmount] = useState(lead.listing?.monthlyRent ?? "");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [markState, markAction, markPending] = useActionState(markContactedAction, null);
  const [tourState, tourAction, tourPending] = useActionState(quickScheduleTourAction, null);
  const [approveState, approveAction, approvePending] = useActionState(quickApproveApplicationAction, null);
  const [leaseState, leaseAction, leasePending] = useActionState(fastTrackLeaseAction, null);

  const latestError = useMemo(
    () =>
      (markState && !markState.ok ? markState.message : null) ??
      (tourState && !tourState.ok ? tourState.message : null) ??
      (approveState && !approveState.ok ? approveState.message : null) ??
      (leaseState && !leaseState.ok ? leaseState.message : null),
    [approveState, leaseState, markState, tourState],
  );

  useEffect(() => {
    if (markState?.ok || tourState?.ok || approveState?.ok || leaseState?.ok) {
      onDone();
    }
  }, [approveState?.ok, leaseState?.ok, markState?.ok, onDone, tourState?.ok]);

  const applicationPath =
    lead.listing?.publicSlug && lead.listing.organizationSlug
      ? prospectListingPath(lead.listing.organizationSlug, lead.listing.publicSlug)
      : null;

  const copyApplicationLink = async () => {
    if (!applicationPath) {
      setCopyFeedback("No listing linked");
      return;
    }
    const url = typeof window === "undefined" ? applicationPath : `${window.location.origin}${applicationPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback("Application link copied");
    } catch {
      setCopyFeedback("Copy failed - copy manually from the Application tab");
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Quick actions</Badge>
          <span className="text-muted-foreground text-sm">
            {lead.firstName} {lead.lastName}
          </span>
          {hasLease ? (
            <Badge variant="secondary">Lease created</Badge>
          ) : (
            <Badge variant="secondary">Pipeline in progress</Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canMarkContacted ? (
            <form action={markAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <Button type="submit" size="sm" disabled={markPending}>
                {markPending ? "Marking..." : "Mark contacted"}
              </Button>
            </form>
          ) : null}

          {canScheduleTour ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowTourForm((s) => !s)}>
              {showTourForm ? "Hide tour form" : "Schedule tour"}
            </Button>
          ) : null}

          {canShareApplicationLink ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!applicationPath}
              onClick={() => {
                void copyApplicationLink();
              }}
            >
              {applicationPath ? "Share application link" : "No listing linked"}
            </Button>
          ) : null}

          {canQuickApprove && application ? (
            <form action={approveAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <Button type="submit" size="sm" variant="secondary" disabled={approvePending}>
                {approvePending ? "Approving..." : "Approve application"}
              </Button>
            </form>
          ) : null}

          {canConvertToLease ? (
            <Button type="button" size="sm" onClick={() => setShowLeaseForm((s) => !s)}>
              {showLeaseForm ? "Hide lease form" : "Convert to lease"}
            </Button>
          ) : null}
        </div>

        {showTourForm ? (
          <form action={tourAction} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <input type="hidden" name="leadId" value={lead.id} />
            {lead.listing?.id ? <input type="hidden" name="listingId" value={lead.listing.id} /> : null}
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="qa-scheduledAt">Tour time</Label>
              <Input
                id="qa-scheduledAt"
                name="scheduledAt"
                type="datetime-local"
                required
                value={tourScheduledAt}
                onChange={(e) => setTourScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="qa-notes">Notes</Label>
              <Input
                id="qa-notes"
                name="notes"
                value={tourNotes}
                onChange={(e) => setTourNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" size="sm" disabled={tourPending}>
                {tourPending ? "Scheduling..." : "Save tour"}
              </Button>
            </div>
          </form>
        ) : null}

        {showLeaseForm && canConvertToLease ? (
          <form action={leaseAction} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <input type="hidden" name="leadId" value={lead.id} />
            {application?.id ? <input type="hidden" name="applicationId" value={application.id} /> : null}
            <input type="hidden" name="residentFirstName" value={lead.firstName} />
            <input type="hidden" name="residentLastName" value={lead.lastName} />
            <input type="hidden" name="residentEmail" value={lead.email ?? ""} />
            <input type="hidden" name="residentPhone" value={lead.phone ?? ""} />
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="qa-lease-unit">Unit</Label>
              <select
                id="qa-lease-unit"
                name="unitId"
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
                value={leaseUnitId}
                onChange={(e) => setLeaseUnitId(e.target.value)}
                required
              >
                <option value="">Select unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.propertyName} · {u.unitNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-lease-start">Start</Label>
              <Input id="qa-lease-start" name="startDate" type="date" value={leaseStartDate} onChange={(e) => setLeaseStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-lease-end">End</Label>
              <Input id="qa-lease-end" name="endDate" type="date" value={leaseEndDate} onChange={(e) => setLeaseEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-lease-rent">Rent</Label>
              <Input id="qa-lease-rent" name="rentAmount" type="number" min={0} step="0.01" value={leaseRentAmount} onChange={(e) => setLeaseRentAmount(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-lease-deposit">Deposit</Label>
              <Input id="qa-lease-deposit" name="depositAmount" type="number" min={0} step="0.01" value={leaseDepositAmount} onChange={(e) => setLeaseDepositAmount(e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" size="sm" disabled={leasePending}>
                {leasePending ? "Creating lease..." : "Create lease"}
              </Button>
            </div>
          </form>
        ) : null}

        {hasLease && application?.lease ? (
          <p className="text-muted-foreground text-xs">Lease ID: {application.lease.id}</p>
        ) : null}
        {copyFeedback ? <p className="text-muted-foreground text-xs">{copyFeedback}</p> : null}
        {latestError ? <p className="text-destructive text-sm">{latestError}</p> : null}
      </CardContent>
    </Card>
  );
}
