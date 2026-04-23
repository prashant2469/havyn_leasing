"use client";

import type { ApplicationStatus } from "@prisma/client";
import { addMonths, formatISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fastTrackLeaseAction } from "@/server/actions/lead-pipeline";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";

type ResidentOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type UnitOption = {
  id: string;
  unitNumber: string;
  propertyName: string;
};

type FastTrackWizardProps = {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    primaryUnitId: string | null;
    listing: {
      id: string;
      monthlyRent: string;
      unit: { id: string };
    } | null;
  };
  application: { id: string; status: ApplicationStatus } | null;
  residents: ResidentOption[];
  units: UnitOption[];
  onDone?: (leaseId: string) => void;
};

export function FastTrackWizard({ lead, application, residents, units, onDone }: FastTrackWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [useExistingResident, setUseExistingResident] = useState<boolean>(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string>("");
  const [residentFirstName, setResidentFirstName] = useState(lead.firstName);
  const [residentLastName, setResidentLastName] = useState(lead.lastName);
  const [residentEmail, setResidentEmail] = useState(lead.email ?? "");
  const [residentPhone, setResidentPhone] = useState(lead.phone ?? "");
  const [unitId, setUnitId] = useState(lead.primaryUnitId ?? lead.listing?.unit.id ?? "");
  const [startDate, setStartDate] = useState(formatISO(new Date(), { representation: "date" }));
  const [endDate, setEndDate] = useState(
    formatISO(addMonths(new Date(), 12), { representation: "date" }),
  );
  const [rentAmount, setRentAmount] = useState(lead.listing?.monthlyRent ?? "");
  const [depositAmount, setDepositAmount] = useState(lead.listing?.monthlyRent ?? "");

  const [state, action, pending] = useActionState(fastTrackLeaseAction, null);

  const matchedResident = useMemo(() => {
    if (!lead.email) return null;
    const email = lead.email.trim().toLowerCase();
    return residents.find((r) => (r.email ?? "").trim().toLowerCase() === email) ?? null;
  }, [lead.email, residents]);

  const resetWizard = () => {
    setStep(1);
    if (matchedResident) {
      setUseExistingResident(true);
      setSelectedResidentId(matchedResident.id);
    } else {
      setUseExistingResident(false);
      setSelectedResidentId("");
    }
  };

  useEffect(() => {
    if (state?.ok && state.leaseId) {
      onDone?.(state.leaseId);
      router.refresh();
    }
  }, [onDone, router, state?.leaseId, state?.ok]);

  const canContinueResident =
    useExistingResident
      ? Boolean(selectedResidentId)
      : residentFirstName.trim().length > 0 && residentLastName.trim().length > 0;

  const selectedUnit = units.find((u) => u.id === unitId) ?? null;
  const selectedResident = residents.find((r) => r.id === selectedResidentId) ?? null;
  const reviewResidentName = useExistingResident
    ? `${selectedResident?.firstName ?? ""} ${selectedResident?.lastName ?? ""}`.trim()
    : `${residentFirstName} ${residentLastName}`.trim();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" onClick={resetWizard}>
            Convert to lease
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Fast Track to Lease</DialogTitle>
          <DialogDescription>
            Move from approved lead to lease in one guided flow.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs">
          <span className={step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>1. Resident</span>
          <span className="text-muted-foreground">-</span>
          <span className={step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            2. Terms
          </span>
          <span className="text-muted-foreground">-</span>
          <span className={step === 3 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            3. Review
          </span>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            {matchedResident ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  Existing resident match: {matchedResident.firstName} {matchedResident.lastName}
                </p>
                <p className="text-muted-foreground text-xs">{matchedResident.email}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="residentMode">Resident source</Label>
              <select
                id="residentMode"
                className={nativeSelectClass}
                value={useExistingResident ? "existing" : "new"}
                onChange={(e) => setUseExistingResident(e.target.value === "existing")}
              >
                <option value="new">Create or match by lead info</option>
                <option value="existing">Use existing resident</option>
              </select>
            </div>

            {useExistingResident ? (
              <div className="space-y-2">
                <Label htmlFor="residentId">Resident</Label>
                <select
                  id="residentId"
                  className={nativeSelectClass}
                  value={selectedResidentId}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                >
                  <option value="">Select resident</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.firstName} {resident.lastName}
                      {resident.email ? ` (${resident.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="residentFirstName">First name</Label>
                  <Input
                    id="residentFirstName"
                    value={residentFirstName}
                    onChange={(e) => setResidentFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentLastName">Last name</Label>
                  <Input
                    id="residentLastName"
                    value={residentLastName}
                    onChange={(e) => setResidentLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentEmail">Email</Label>
                  <Input
                    id="residentEmail"
                    type="email"
                    value={residentEmail}
                    onChange={(e) => setResidentEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentPhone">Phone</Label>
                  <Input
                    id="residentPhone"
                    value={residentPhone}
                    onChange={(e) => setResidentPhone(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="unitId">Unit</Label>
              <select id="unitId" className={nativeSelectClass} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.propertyName} · {unit.unitNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="leaseStartDate">Start date</Label>
                <Input
                  id="leaseStartDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaseEndDate">End date</Label>
                <Input id="leaseEndDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="leaseRentAmount">Rent amount</Label>
                <Input
                  id="leaseRentAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaseDepositAmount">Deposit amount</Label>
                <Input
                  id="leaseDepositAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="leadId" value={lead.id} />
            {application ? <input type="hidden" name="applicationId" value={application.id} /> : null}
            {useExistingResident ? (
              <input type="hidden" name="residentId" value={selectedResidentId} />
            ) : (
              <>
                <input type="hidden" name="residentFirstName" value={residentFirstName} />
                <input type="hidden" name="residentLastName" value={residentLastName} />
                <input type="hidden" name="residentEmail" value={residentEmail} />
                <input type="hidden" name="residentPhone" value={residentPhone} />
              </>
            )}
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="startDate" value={startDate} />
            <input type="hidden" name="endDate" value={endDate} />
            <input type="hidden" name="rentAmount" value={rentAmount} />
            <input type="hidden" name="depositAmount" value={depositAmount} />

            <div className="rounded-md border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Resident:</span> {reviewResidentName || "Not selected"}
              </p>
              <p>
                <span className="text-muted-foreground">Unit:</span>{" "}
                {selectedUnit ? `${selectedUnit.propertyName} · ${selectedUnit.unitNumber}` : "Not selected"}
              </p>
              <p>
                <span className="text-muted-foreground">Dates:</span> {startDate} to {endDate || "Open"}
              </p>
              <p>
                <span className="text-muted-foreground">Rent / Deposit:</span> ${rentAmount || "0"} / $
                {depositAmount || "0"}
              </p>
              {application ? (
                <p>
                  <span className="text-muted-foreground">Application:</span> {application.status}
                </p>
              ) : (
                <p className="text-muted-foreground">No application linked (fast-track path).</p>
              )}
            </div>

            {state && !state.ok ? <p className="text-destructive text-sm">{state.message}</p> : null}

            <Button type="submit" disabled={pending}>
              {pending ? "Creating lease..." : "Create lease"}
            </Button>
          </form>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || pending}>
            Back
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={step === 1 ? !canContinueResident : !unitId || !startDate || !rentAmount}
            >
              Continue
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
