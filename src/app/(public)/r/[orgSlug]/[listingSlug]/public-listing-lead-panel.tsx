"use client";

import { CheckCircle2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { submitPublicInquiryAction } from "@/server/actions/public-inquiry";
import { bookPublicTourSlotAction, submitPublicScheduleTourAction } from "@/server/actions/public-tour";
import { PublicContactFields, type PublicContactValues } from "./public-contact-fields";

const fieldClass =
  "border-input bg-background focus-visible:ring-ring flex min-h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2";

const emptyContact: PublicContactValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

type SuccessState = { kind: "inquiry" | "schedule" | "book"; message: string };
type FieldError = { message: string; target: "message" | "tour" | "book" };

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
  const [tab, setTab] = useState("message");
  const [bookOpen, setBookOpen] = useState(false);
  const [contact, setContact] = useState<PublicContactValues>({ ...emptyContact });
  const [message, setMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [hasPets, setHasPets] = useState<"" | "yes" | "no">("");
  const [petsDescription, setPetsDescription] = useState("");
  const [slotIso, setSlotIso] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState<FieldError | null>(null);
  const [isPending, startTransition] = useTransition();

  const patchContact = useCallback((patch: Partial<PublicContactValues>) => {
    setContact((c) => ({ ...c, ...patch }));
  }, []);

  const onTabChange = useCallback((value: string) => {
    setTab(value);
    setError(null);
  }, []);

  const submitInquiry = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      const fd = new FormData();
      fd.set("orgSlug", orgSlug);
      fd.set("listingSlug", listingSlug);
      fd.set("firstName", contact.firstName.trim());
      fd.set("lastName", contact.lastName.trim());
      fd.set("email", contact.email.trim());
      fd.set("phone", contact.phone.trim());
      fd.set("message", message);
      fd.set("hasPets", hasPets);
      fd.set("petsDescription", petsDescription.trim());
      fd.set("website", "");
      startTransition(async () => {
        const r = await submitPublicInquiryAction(null, fd);
        if (!r) return;
        if (r.ok) {
          setSuccess({ kind: "inquiry", message: r.message });
          setMessage("");
        } else {
          setError({ message: r.message, target: "message" });
        }
      });
    },
    [contact, message, orgSlug, listingSlug],
  );

  const submitScheduleTour = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      if (!contact.email.trim()) {
        setError({ message: "Please add your email so we can confirm your tour request.", target: "tour" });
        return;
      }
      const fd = new FormData();
      fd.set("orgSlug", orgSlug);
      fd.set("listingSlug", listingSlug);
      fd.set("firstName", contact.firstName.trim());
      fd.set("lastName", contact.lastName.trim());
      fd.set("email", contact.email.trim());
      fd.set("phone", contact.phone.trim());
      fd.set("preferredDate", preferredDate.trim());
      fd.set("timeWindow", timeWindow.trim());
      fd.set("notes", notes.trim());
      fd.set("hasPets", hasPets);
      fd.set("petsDescription", petsDescription.trim());
      fd.set("website", "");
      startTransition(async () => {
        const r = await submitPublicScheduleTourAction(null, fd);
        if (!r) return;
        if (r.ok) {
          setSuccess({ kind: "schedule", message: r.message });
          setPreferredDate("");
          setTimeWindow("");
          setNotes("");
        } else {
          setError({ message: r.message, target: "tour" });
        }
      });
    },
    [contact, preferredDate, timeWindow, notes, orgSlug, listingSlug],
  );

  const submitBook = useCallback(
    (e: React.FormEvent) => {
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
      fd.set("firstName", contact.firstName.trim());
      fd.set("lastName", contact.lastName.trim());
      fd.set("email", contact.email.trim());
      fd.set("slotIso", slotIso);
      fd.set("website", "");
      startTransition(async () => {
        const r = await bookPublicTourSlotAction(null, fd);
        if (!r) return;
        if (r.ok) {
          setSuccess({ kind: "book", message: r.message });
          setSlotIso("");
        } else {
          setError({ message: r.message, target: "book" });
        }
      });
    },
    [contact, slotIso, orgSlug, listingSlug],
  );

  const successBlock = success && (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm dark:border-emerald-400/25 dark:bg-emerald-400/10">
      <div className="flex gap-2">
        <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-2">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">{success.message}</p>
          <div className="text-muted-foreground space-y-1 text-xs leading-relaxed">
            <p className="font-medium text-foreground/80">What happens next</p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>Watch your inbox — {orgName} may reply with questions or a calendar invite.</li>
              <li>Most teams respond within one business day.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {success.kind === "inquiry" ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setTab("tour")}>
                Request a tour time
              </Button>
            ) : null}
            {tourSlots.length > 0 && success.kind !== "book" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBookOpen(true);
                  document.getElementById("book-slot-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
              >
                Book a specific slot
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card id="get-in-touch" className="shadow-sm ring-1 ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-lg md:text-xl">Get in touch</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          One quick form — message the team or ask for a showing. Same contact details for both.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs value={tab} onValueChange={onTabChange} className="gap-4">
          <TabsList variant="line" className="w-full min-w-0 flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="message" className="min-w-[6rem]">
              Message
            </TabsTrigger>
            <TabsTrigger value="tour" className="min-w-[6rem]">
              Request a tour
            </TabsTrigger>
          </TabsList>

          <TabsContent value="message" className="space-y-4 pt-1">
            <form onSubmit={submitInquiry} className="space-y-4">
              <PublicContactFields idPrefix="msg" values={contact} onChange={patchContact} />
              <div className="space-y-1.5">
                <Label htmlFor="pet-status">Do you have pets?</Label>
                <select
                  id="pet-status"
                  className={fieldClass}
                  value={hasPets}
                  onChange={(e) => setHasPets(e.target.value as "" | "yes" | "no")}
                >
                  <option value="">Prefer not to say</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {hasPets === "yes" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="pet-details">Pet details</Label>
                  <Input
                    id="pet-details"
                    placeholder="Type, count, and anything important"
                    value={petsDescription}
                    onChange={(e) => setPetsDescription(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="msg-body">Your message</Label>
                <textarea
                  id="msg-body"
                  required
                  rows={4}
                  className={fieldClass}
                  placeholder="I'd like to know more about availability, pets, parking…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              {error?.target === "message" ? <p className="text-destructive text-sm">{error.message}</p> : null}
              {success?.kind === "inquiry" ? successBlock : null}
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending ? "Sending…" : "Send message"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="tour" className="space-y-4 pt-1">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tell us when you&apos;re free — we&apos;ll confirm real times that match the property&apos;s calendar.
            </p>
            <form onSubmit={submitScheduleTour} className="space-y-4">
              <PublicContactFields
                idPrefix="tour"
                values={contact}
                onChange={patchContact}
                emailRequiredForFlow
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tour-pref">Preferred date</Label>
                  <Input
                    id="tour-pref"
                    required
                    placeholder="e.g. next Saturday or Apr 20"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tour-window">Time window</Label>
                  <Input
                    id="tour-window"
                    required
                    placeholder="e.g. 10am–2pm"
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pet-status">Do you have pets?</Label>
                <select
                  id="pet-status"
                  className={fieldClass}
                  value={hasPets}
                  onChange={(e) => setHasPets(e.target.value as "" | "yes" | "no")}
                >
                  <option value="">Prefer not to say</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {hasPets === "yes" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="pet-details">Pet details</Label>
                  <Input
                    id="pet-details"
                    placeholder="Type, count, and anything important"
                    value={petsDescription}
                    onChange={(e) => setPetsDescription(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="tour-notes">Notes (optional)</Label>
                <textarea
                  id="tour-notes"
                  rows={3}
                  className={fieldClass}
                  placeholder="Anything we should know before scheduling?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {error?.target === "tour" ? <p className="text-destructive text-sm">{error.message}</p> : null}
              {success?.kind === "schedule" ? successBlock : null}
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending ? "Sending…" : "Send tour request"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

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
            <span>Book a confirmed time (after inquiry)</span>
            <span className="text-muted-foreground text-xs font-normal">{bookOpen ? "Hide" : "Show"}</span>
          </button>

          {bookOpen ? (
            <div className="border-muted space-y-4 rounded-lg border bg-muted/10 p-4">
              {tourSlots.length === 0 ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Online booking isn&apos;t open for this property yet. Send a message or tour request above and the
                  team will send you times.
                </p>
              ) : (
                <form onSubmit={submitBook} className="space-y-4">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    You must send a message or tour request first. Then use the same first name, last name, and email here so we can match your lead record.
                  </p>
                  <PublicContactFields idPrefix="book" values={contact} onChange={patchContact} emailRequiredForFlow />
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
                  {error?.target === "book" && bookOpen ? (
                    <p className="text-destructive text-sm">{error.message}</p>
                  ) : null}
                  {success?.kind === "book" ? successBlock : null}
                  <Button type="submit" disabled={isPending} variant="secondary" className="w-full sm:w-auto">
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
