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
