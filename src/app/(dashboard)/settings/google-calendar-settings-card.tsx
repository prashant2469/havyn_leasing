"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { updateGoogleCalendarSelectionAction } from "@/server/actions/google-calendar";

const nativeSelectClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2";
const linkButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground";
const linkOutlineClass =
  "inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium";

export function GoogleCalendarSettingsCard({
  connected,
  connectUrl,
  selectedCalendarId,
  calendars,
  unavailableReason,
}: {
  connected: boolean;
  connectUrl: string;
  selectedCalendarId: string | null;
  calendars: Array<{ id: string; summary: string; primary?: boolean }>;
  unavailableReason?: string | null;
}) {
  const [state, action, pending] = useActionState(updateGoogleCalendarSelectionAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {unavailableReason ? (
          <p className="text-destructive text-sm">{unavailableReason}</p>
        ) : null}
        {!connected ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Connect Google Calendar to check real-time availability and sync tour events.
            </p>
            <a href={connectUrl} className={linkButtonClass}>
              Connect Google Calendar
            </a>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="calendarId">Selected calendar</Label>
              <select
                id="calendarId"
                name="calendarId"
                defaultValue={selectedCalendarId ?? "primary"}
                className={nativeSelectClass}
              >
                {calendars.length === 0 ? (
                  <option value={selectedCalendarId ?? "primary"}>
                    {selectedCalendarId ?? "primary"}
                  </option>
                ) : (
                  calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary ? " (Primary)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            {state && !state.ok ? <p className="text-destructive text-xs">{state.message}</p> : null}
            {state?.ok ? <p className="text-xs text-green-600">Saved.</p> : null}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                {pending ? "Saving..." : "Save calendar"}
              </Button>
              <a href={connectUrl} className={cn(linkOutlineClass)}>
                Reconnect
              </a>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
