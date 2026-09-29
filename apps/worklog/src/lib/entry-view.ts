import { timeInZone } from "./dates";
import type { Entry } from "./db/schema";

/** What the client receives for an entry: serializable, with the local time pre-rendered. */
export type EntryView = {
  id: string;
  entryDate: string;
  text: string;
  tags: string[];
  isBlocker: boolean;
  createdAt: string;
  /** "HH:mm" in the user's zone */
  time: string;
};

export function toEntryView(entry: Entry, tz: string): EntryView {
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    text: entry.text,
    tags: entry.tags,
    isBlocker: entry.isBlocker,
    createdAt: entry.createdAt.toISOString(),
    time: timeInZone(entry.createdAt, tz),
  };
}

export type DayGroup = { date: string; entries: EntryView[] };

/** Groups entries (already sorted newest first) by calendar day, keeping order. */
export function groupByDay(entries: EntryView[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last && last.date === entry.entryDate) last.entries.push(entry);
    else groups.push({ date: entry.entryDate, entries: [entry] });
  }
  return groups;
}
