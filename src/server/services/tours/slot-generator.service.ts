import { addDays, addMinutes, setHours, setMinutes, startOfDay } from "date-fns";

export type WeekdayWindow = {
  weekdays: number[]; // 0=Sun … 6=Sat (date-fns)
  start: string; // "HH:mm"
  end: string; // "HH:mm"
};

export type ShowingScheduleJson = {
  weekdayWindows?: WeekdayWindow[];
  tourDurationMinutes?: number;
  blackouts?: { start: string; end: string }[];
};

export type BusyRange = {
  start: Date;
  end: Date;
};

function parseHm(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return { h: h || 9, m: m || 0 };
}

function isBlackout(d: Date, blackouts: ShowingScheduleJson["blackouts"]): boolean {
  if (!blackouts?.length) return false;
  const t = d.getTime();
  for (const b of blackouts) {
    const start = new Date(b.start).getTime();
    const end = new Date(b.end).getTime();
    if (t >= start && t <= end) return true;
  }
  return false;
}

function overlapsBusyRange(slotStart: Date, slotDurationMinutes: number, busyRanges: BusyRange[]): boolean {
  if (busyRanges.length === 0) return false;
  const slotStartMs = slotStart.getTime();
  const slotEndMs = addMinutes(slotStart, slotDurationMinutes).getTime();
  return busyRanges.some((r) => {
    const busyStart = r.start.getTime();
    const busyEnd = r.end.getTime();
    return slotStartMs < busyEnd && slotEndMs > busyStart;
  });
}

/**
 * Generates up to `count` upcoming tour start times from property.showingSchedule JSON.
 */
export function generateTourSlots(
  schedule: unknown,
  from: Date,
  count: number,
): Date[] {
  const s = (schedule && typeof schedule === "object" ? schedule : {}) as ShowingScheduleJson;
  const windows = s.weekdayWindows?.length
    ? s.weekdayWindows
    : [{ weekdays: [1, 2, 3, 4, 5], start: "10:00", end: "16:00" }];
  const duration = s.tourDurationMinutes ?? 30;
  const blackouts = s.blackouts;
  const slots: Date[] = [];

  const start = startOfDay(from);
  const maxDays = 21;
  for (let d = 0; d < maxDays && slots.length < count; d++) {
    const candidate = addDays(start, d);
    const wd = candidate.getDay();

    for (const w of windows) {
      if (!w.weekdays.includes(wd)) continue;
      const { h: sh, m: sm } = parseHm(w.start);
      const { h: eh, m: em } = parseHm(w.end);
      let slot = setMinutes(setHours(candidate, sh), sm);
      const endLimit = setMinutes(setHours(candidate, eh), em);

      while (slot < endLimit && slots.length < count) {
        if (slot >= from && !isBlackout(slot, blackouts)) {
          slots.push(new Date(slot));
        }
        slot = addMinutes(slot, duration);
      }
    }
  }

  return slots.slice(0, count);
}

/**
 * Same as `generateTourSlots`, but removes any slot that overlaps a busy range.
 * Busy ranges can come from Havyn Tour rows and/or external calendar freebusy data.
 */
export function generateAvailableTourSlots(
  schedule: unknown,
  from: Date,
  count: number,
  busyRanges: BusyRange[],
): Date[] {
  const s = (schedule && typeof schedule === "object" ? schedule : {}) as ShowingScheduleJson;
  const duration = s.tourDurationMinutes ?? 30;
  const candidates = generateTourSlots(schedule, from, Math.max(count * 4, count));
  const available = candidates.filter((slot) => !overlapsBusyRange(slot, duration, busyRanges));
  return available.slice(0, count);
}
