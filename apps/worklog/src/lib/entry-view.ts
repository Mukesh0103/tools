import { timeInZone } from "./dates";
import type { Entry, EntrySource } from "./db/schema";

export type EntryView = {
  id: string;
  entryDate: string;
  text: string;
  isBlocker: boolean;
  createdAt: string;
  time: string;
  /** "manual" for typed entries; "github" or "jira" for imported ones, which also carry a link. */
  source: EntrySource;
  externalId: string | null;
  url: string | null;
};

export function toEntryView(entry: Entry, tz: string): EntryView {
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    text: entry.text,
    isBlocker: entry.isBlocker,
    createdAt: entry.createdAt.toISOString(),
    time: timeInZone(entry.createdAt, tz),
    source: entry.source,
    externalId: entry.externalId,
    url: entry.url,
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
