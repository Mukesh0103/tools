import { readFileSync } from "node:fs";
import type { OutputEntry } from "@/lib/generate/plain";
import type { DateRange } from "@/lib/dates";

export type EntryFixture = { description: string; today: string; entries: OutputEntry[] };

export const FIXTURES = ["typical-week", "no-blockers", "monday-after-weekend"] as const;
export type FixtureName = (typeof FIXTURES)[number];

export function loadFixture(name: FixtureName): EntryFixture {
  return JSON.parse(
    readFileSync(new URL(`./entries/${name}.json`, import.meta.url), "utf8"),
  ) as EntryFixture;
}

export function inRange(entries: OutputEntry[], range: DateRange): OutputEntry[] {
  return entries.filter((e) => e.date >= range.start && e.date <= range.end);
}
