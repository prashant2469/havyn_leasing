"use client";

import { CheckCircle2 } from "lucide-react";
import { type FormEvent, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PUBLIC_INTAKE_HONEYPOT_FIELD } from "@/lib/public-intake-honeypot";
import { submitPublicApplicationAction } from "@/server/actions/public-application";
import { bookPublicTourSlotAction } from "@/server/actions/public-tour";

const fieldClass =
  "border-input bg-background focus-visible:ring-ring flex min-h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2";

type SuccessState = { kind: "apply" | "book"; message: string };
type FieldError = { message: string; target: "apply" | "book" };

const steps = [
  "Personal",
  "Household",
  "Income",
  "Credit",
  "Residence",
  "Vehicles + Extras",
  "Review",
] as const;

type ApplicationValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occupants: string;
  hasPets: "" | "yes" | "no";
  petsDescription: string;
  desiredLeaseStart: string;
  leaseTermMonths: string;
  employer: string;
  jobTitle: string;
  monthlyIncome: string;
  otherIncome: string;
  creditScoreRange: string;
  currentAddress: string;
  currentResidenceMonths: string;
  landlordName: string;
  landlordPhone: string;
  moveReason: string;
  vehicleParking: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  additionalNotes: string;
};

const initialValues: ApplicationValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  occupants: "",
  hasPets: "",
  petsDescription: "",
  desiredLeaseStart: "",
  leaseTermMonths: "",
  employer: "",
  jobTitle: "",
  monthlyIncome: "",
  otherIncome: "",
  creditScoreRange: "",
  currentAddress: "",
  currentResidenceMonths: "",
  landlordName: "",
  landlordPhone: "",
  moveReason: "",
  vehicleParking: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  additionalNotes: "",
};

export function PublicListingLeadPanel({
  orgSlug,
  listingSlug,
  orgName,
  tourSlots,
}: {
  orgSlug: string;
  listingSlug: string;
  orgName: string;
  tourSlots: { iso: string; label: string }[];
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<ApplicationValues>(initialValues);
  const [bookOpen, setBookOpen] = useState(false);
  const [slotIso, setSlotIso] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState<FieldError | null>(null);
  const [isPending, startTransition] = useTransition();

  const setField = <K extends keyof ApplicationValues>(key: K, value: ApplicationValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const canGoNext = useMemo(() => {
    if (stepIndex === 0) {
      return (
        values.firstName.trim().length > 0 &&
        values.lastName.trim().length > 0 &&
        values.email.trim().length > 0 &&
        values.phone.trim().length > 0
      );
    }
    if (stepIndex === 1) {
      return values.occupants.trim().length > 0;
    }
    return true;
  }, [stepIndex, values]);

  const submitApplication = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("listingSlug", listingSlug);
    Object.entries(values).forEach(([k, v]) => fd.set(k, v));
    fd.set(PUBLIC_INTAKE_HONEYPOT_FIELD, "");
    startTransition(async () => {
      const r = await submitPublicApplicationAction(null, fd);
      if (!r) return;
      if (r.ok) {
        setSuccess({ kind: "apply", message: r.message });
      } else {
        setError({ message: r.message, target: "apply" });
      }
    });
  };

  const submitBook = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!slotIso) {
      setError({ message: "Please choose a time slot.", target: "book" });
      return;
    }
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("listingSlug", listingSlug);
    fd.set("firstName", values.firstName.trim());
    fd.set("lastName", values.lastName.trim());
    fd.set("email", values.email.trim());
    fd.set("slotIso", slotIso);
    fd.set(PUBLIC_INTAKE_HONEYPOT_FIELD, "");
    startTransition(async () => {
      const r = await bookPublicTourSlotAction(null, fd);
      if (!r) return;
      if (r.ok) {
        setSuccess({ kind: "book", message: r.message });
      } else {
        setError({ message: r.message, target: "book" });
      }
    });
  };

  const successBlock = success && (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm dark:border-emerald-400/25 dark:bg-emerald-400/10">
      <div className="flex gap-2">
        <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">{success.message}</p>
          <p className="text-muted-foreground text-xs">
            {orgName} can now reach you by email/phone to coordinate tours and follow-up.
          </p>
        </div>
      </div>
    </div>
  );
  const applicationSubmitted = success?.kind === "apply";

  return (
    <Card id="get-in-touch" className="shadow-sm ring-1 ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-lg md:text-xl">Rental application</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Complete one section at a time. Your contact details and application answers go directly to {orgName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {applicationSubmitted ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-400/25 dark:bg-emerald-400/10">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Application submitted
            </p>
            {successBlock}
            <p className="text-muted-foreground text-sm">
              Next step: if you want, book a confirmed tour time below. The leasing team will
              follow up with you directly.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {stepIndex + 1} of {steps.length}
              </span>
              <span>{steps[stepIndex]}</span>
            </div>
            <div className="h-2 rounded bg-muted">
              <div
                className="h-2 rounded bg-primary transition-all"
                style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {!applicationSubmitted ? (
          <form onSubmit={submitApplication} className="space-y-4">
          {stepIndex === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apply-firstName">First name</Label>
                <Input id="apply-firstName" value={values.firstName} onChange={(e) => setField("firstName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-lastName">Last name</Label>
                <Input id="apply-lastName" value={values.lastName} onChange={(e) => setField("lastName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-email">Email</Label>
                <Input id="apply-email" type="email" value={values.email} onChange={(e) => setField("email", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-phone">Phone</Label>
                <Input id="apply-phone" type="tel" value={values.phone} onChange={(e) => setField("phone", e.target.value)} required />
              </div>
            </div>
          ) : null}

          {stepIndex === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apply-occupants">Occupants</Label>
                <Input id="apply-occupants" type="number" min={1} value={values.occupants} onChange={(e) => setField("occupants", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-pets">Do you have pets?</Label>
                <select id="apply-pets" className={fieldClass} value={values.hasPets} onChange={(e) => setField("hasPets", e.target.value as "" | "yes" | "no")}>
                  <option value="">Prefer not to say</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-petsDescription">Pet details</Label>
                <Input id="apply-petsDescription" value={values.petsDescription} onChange={(e) => setField("petsDescription", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-desiredLeaseStart">Desired move-in date</Label>
                <Input id="apply-desiredLeaseStart" type="date" value={values.desiredLeaseStart} onChange={(e) => setField("desiredLeaseStart", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-leaseTermMonths">Lease term (months)</Label>
                <Input id="apply-leaseTermMonths" type="number" min={1} value={values.leaseTermMonths} onChange={(e) => setField("leaseTermMonths", e.target.value)} />
              </div>
            </div>
          ) : null}

          {stepIndex === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apply-employer">Employer</Label>
                <Input id="apply-employer" value={values.employer} onChange={(e) => setField("employer", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-jobTitle">Job title</Label>
                <Input id="apply-jobTitle" value={values.jobTitle} onChange={(e) => setField("jobTitle", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-monthlyIncome">Monthly income</Label>
                <Input id="apply-monthlyIncome" type="number" min={0} value={values.monthlyIncome} onChange={(e) => setField("monthlyIncome", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-otherIncome">Other income</Label>
                <Input id="apply-otherIncome" type="number" min={0} value={values.otherIncome} onChange={(e) => setField("otherIncome", e.target.value)} />
              </div>
            </div>
          ) : null}

          {stepIndex === 3 ? (
            <div className="space-y-1.5">
              <Label htmlFor="apply-creditScoreRange">Credit score range</Label>
              <select id="apply-creditScoreRange" className={fieldClass} value={values.creditScoreRange} onChange={(e) => setField("creditScoreRange", e.target.value)}>
                <option value="">Select</option>
                <option value="Excellent (750+)">Excellent (750+)</option>
                <option value="Good (700-749)">Good (700-749)</option>
                <option value="Fair (650-699)">Fair (650-699)</option>
                <option value="Below 650">Below 650</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          ) : null}

          {stepIndex === 4 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-currentAddress">Current address</Label>
                <Input id="apply-currentAddress" value={values.currentAddress} onChange={(e) => setField("currentAddress", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-currentResidenceMonths">How long there? (months)</Label>
                <Input id="apply-currentResidenceMonths" type="number" min={0} value={values.currentResidenceMonths} onChange={(e) => setField("currentResidenceMonths", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-moveReason">Reason for moving</Label>
                <Input id="apply-moveReason" value={values.moveReason} onChange={(e) => setField("moveReason", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-landlordName">Landlord name</Label>
                <Input id="apply-landlordName" value={values.landlordName} onChange={(e) => setField("landlordName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-landlordPhone">Landlord phone</Label>
                <Input id="apply-landlordPhone" value={values.landlordPhone} onChange={(e) => setField("landlordPhone", e.target.value)} />
              </div>
            </div>
          ) : null}

          {stepIndex === 5 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-vehicleParking">Vehicle / parking needs</Label>
                <Input id="apply-vehicleParking" value={values.vehicleParking} onChange={(e) => setField("vehicleParking", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-emergencyContactName">Emergency contact name</Label>
                <Input id="apply-emergencyContactName" value={values.emergencyContactName} onChange={(e) => setField("emergencyContactName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-emergencyContactPhone">Emergency contact phone</Label>
                <Input id="apply-emergencyContactPhone" value={values.emergencyContactPhone} onChange={(e) => setField("emergencyContactPhone", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="apply-additionalNotes">Additional notes</Label>
                <textarea id="apply-additionalNotes" rows={4} className={fieldClass} value={values.additionalNotes} onChange={(e) => setField("additionalNotes", e.target.value)} />
              </div>
            </div>
          ) : null}

          {stepIndex === 6 ? (
            <div className="rounded-md border p-4 text-sm space-y-2">
              <p className="font-medium">Review before submitting</p>
              <p>
                {values.firstName} {values.lastName} · {values.email} · {values.phone}
              </p>
              <p>
                Occupants: {values.occupants || "—"} · Credit: {values.creditScoreRange || "—"}
              </p>
              <p>
                Income: {values.employer || "—"} {values.monthlyIncome ? `($${values.monthlyIncome}/mo)` : ""}
              </p>
              <p>Address: {values.currentAddress || "—"}</p>
              <p>Move-in: {values.desiredLeaseStart || "—"} · Lease term: {values.leaseTermMonths || "—"}</p>
            </div>
          ) : null}

            {error?.target === "apply" ? (
              <p className="text-destructive text-sm">{error.message}</p>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={stepIndex === 0 || isPending}
                onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
              {stepIndex < steps.length - 1 ? (
                <Button
                  type="button"
                  disabled={!canGoNext || isPending}
                  onClick={() => setStepIndex((s) => Math.min(steps.length - 1, s + 1))}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Submitting…" : "Submit application"}
                </Button>
              )}
            </div>
          </form>
        ) : null}

        <Separator />

        <div id="book-slot-panel" className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setBookOpen((o) => !o);
              setError((e) => (e?.target === "book" ? null : e));
            }}
            className="text-foreground hover:bg-muted/60 flex w-full items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 text-left text-sm font-medium transition-colors"
            aria-expanded={bookOpen}
          >
            <span>Book a confirmed tour time (optional)</span>
            <span className="text-muted-foreground text-xs font-normal">
              {bookOpen ? "Hide" : "Show"}
            </span>
          </button>

          {bookOpen ? (
            <div className="border-muted space-y-4 rounded-lg border bg-muted/10 p-4">
              {tourSlots.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No online tour slots are currently available.
                </p>
              ) : (
                <form onSubmit={submitBook} className="space-y-4">
                  <p className="text-muted-foreground text-xs">
                    Use the same first name, last name, and email from your application.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="book-firstName">First name</Label>
                      <Input
                        id="book-firstName"
                        value={values.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="book-lastName">Last name</Label>
                      <Input
                        id="book-lastName"
                        value={values.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="book-email">Email</Label>
                    <Input
                      id="book-email"
                      type="email"
                      value={values.email}
                      onChange={(e) => setField("email", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="book-slot">Pick a time</Label>
                    <select
                      id="book-slot"
                      required
                      className={fieldClass}
                      value={slotIso}
                      onChange={(e) => setSlotIso(e.target.value)}
                    >
                      <option value="">Select a slot…</option>
                      {tourSlots.map((s) => (
                        <option key={s.iso} value={s.iso}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {error?.target === "book" ? (
                    <p className="text-destructive text-sm">{error.message}</p>
                  ) : null}
                  {success?.kind === "book" ? successBlock : null}
                  <Button
                    type="submit"
                    disabled={isPending}
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    {isPending ? "Booking…" : "Confirm tour"}
                  </Button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground border-t bg-muted/20 text-xs leading-relaxed">
        Your information goes only to {orgName}. Havyn routes it securely to their leasing inbox.
      </CardFooter>
    </Card>
  );
}
