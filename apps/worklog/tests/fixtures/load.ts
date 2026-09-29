import { readFileSync } from "node:fs";
import type { PromptEntry } from "@/lib/ai/prompts";
import type { DateRange } from "@/lib/dates";

export type EntryFixture = { description: string; today: string; entries: PromptEntry[] };

export const FIXTURES = [
  "typical-week",
  "no-blockers",
  "prompt-injection",
  "monday-after-weekend",
] as const;
export type FixtureName = (typeof FIXTURES)[number];

export function loadFixture(name: FixtureName): EntryFixture {
  return JSON.parse(
    readFileSync(new URL(`./entries/${name}.json`, import.meta.url), "utf8"),
  ) as EntryFixture;
}

export function inRange(entries: PromptEntry[], range: DateRange): PromptEntry[] {
  return entries.filter((e) => e.date >= range.start && e.date <= range.end);
}
