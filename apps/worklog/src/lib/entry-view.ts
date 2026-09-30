import { timeInZone } from "./dates";
import type { Entry } from "./db/schema";

export type EntryView = {
  id: string;
  entryDate: string;
  text: string;
  tags: string[];
  isBlocker: boolean;
  createdAt: string;
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

export function groupByDay(entries: EntryView[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last && last.date === entry.entryDate) last.entries.push(entry);
    else groups.push({ date: entry.entryDate, entries: [entry] });
  }
  return groups;
}
