import {
  addDays,
  quarterRange,
  standupRange,
  todayInZone,
  weekday,
  weeklyRange,
  yearRange,
  type DateRange,
} from "./dates";
import type { GenerationType } from "./db/schema";

export type RangePreset = { id: string; label: string; range: DateRange };

/** The default range per generator, in the user's zone. */
export function defaultRanges(tz: string, now = new Date()): Record<GenerationType, DateRange> {
  return {
    standup: standupRange(tz, now),
    weekly: weeklyRange(tz, now),
    appraisal: quarterRange(tz, now),
  };
}

export function rangePresets(tz: string, now = new Date()): Record<GenerationType, RangePreset[]> {
  const today = todayInZone(tz, now);
  const mondayOffset = (weekday(today) + 6) % 7; // days since Monday
  const thisMonday = addDays(today, -mondayOffset);
  return {
    standup: [
      { id: "standup", label: "Yesterday + today", range: standupRange(tz, now) },
      { id: "today", label: "Today only", range: { start: today, end: today } },
    ],
    weekly: [
      { id: "last7", label: "Last 7 days", range: weeklyRange(tz, now) },
      { id: "thisWeek", label: "This week", range: { start: thisMonday, end: today } },
      {
        id: "lastWeek",
        label: "Last week",
        range: { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) },
      },
    ],
    appraisal: [
      { id: "thisQuarter", label: "This quarter", range: quarterRange(tz, now) },
      { id: "lastQuarter", label: "Last quarter", range: quarterRange(tz, now, -1) },
      { id: "last6", label: "Last 6 months", range: { start: addDays(today, -182), end: today } },
      { id: "thisYear", label: "This year", range: yearRange(tz, now) },
    ],
  };
}
