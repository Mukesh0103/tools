import { formatDayMonth, formatShortDate, type DateRange, type ISODate } from "@/lib/dates";
import type { Entry, GenerationType, StandupFormat } from "@/lib/db/schema";

export type OutputEntry = { date: ISODate; text: string; isBlocker: boolean };

export type OutputInput = { entries: OutputEntry[]; range: DateRange; format: StandupFormat };

export function toOutputEntry(entry: Entry): OutputEntry {
  return { date: entry.entryDate, text: entry.text, isBlocker: entry.isBlocker };
}

const bullet = (text: string) => `– ${text}`;

function section(heading: string, lines: string[], empty: string): string {
  return [`**${heading}**`, ...(lines.length ? lines : [bullet(empty)])].join("\n");
}

function standup({ entries, range, format }: OutputInput): string {
  const today = range.end;
  const blockers = entries.filter((e) => e.isBlocker);
  const earlier = entries.filter((e) => !e.isBlocker && e.date !== today);
  const now = entries.filter((e) => !e.isBlocker && e.date === today);

  if (format === "bullets") {
    const lines = [
      ...earlier.map((e) => bullet(`Yesterday: ${e.text}`)),
      ...now.map((e) => bullet(`Today: ${e.text}`)),
      ...(blockers.length
        ? blockers.map((e) => bullet(`Blocker: ${e.text}`))
        : [bullet("Blocker: none")]),
    ];
    return lines.join("\n");
  }

  if (format === "paragraph") {
    const join = (list: OutputEntry[]) => list.map((e) => e.text.replace(/[.\s]+$/, "")).join("; ");
    return [
      earlier.length ? `Yesterday: ${join(earlier)}.` : "",
      now.length ? `Today: ${join(now)}.` : "Nothing logged yet today.",
      blockers.length ? `Blocked on: ${join(blockers)}.` : "No blockers.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    section(
      "Yesterday",
      earlier.map((e) => bullet(e.text)),
      "Nothing logged",
    ),
    section(
      "Today",
      now.map((e) => bullet(e.text)),
      "Nothing logged yet today",
    ),
    section(
      "Blockers",
      blockers.map((e) => bullet(e.text)),
      "None",
    ),
  ].join("\n\n");
}

function weekly({ entries }: OutputInput): string {
  const days = new Map<string, OutputEntry[]>();
  for (const e of entries) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return [...days.entries()]
    .map(([date, list]) =>
      [
        `**${formatShortDate(date)}**`,
        ...list.map((e) => bullet(`${e.isBlocker ? "Blocked: " : ""}${e.text}`)),
      ].join("\n"),
    )
    .join("\n\n");
}

const COLLAB =
  /\b(pair(ed|ing)?|review(ed|ing)?|demo(ed)?|mentor(ed|ing)?|help(ed|ing)?|with|workshop|interview(ed)?|onboard(ed|ing)?)\b/i;

function appraisal({ entries }: OutputInput): string {
  const done = entries.filter((e) => !e.isBlocker);
  const collab = done.filter((e) => COLLAB.test(e.text));
  const dated = (e: OutputEntry) => bullet(`${e.text} (${formatDayMonth(e.date)})`);
  return [
    section(
      "Accomplishments",
      done.filter((e) => !collab.includes(e)).map(dated),
      "Nothing logged in this period",
    ),
    section("Impact", [], "[Add the outcome: tickets closed, time saved, customers unblocked]"),
    section("Skills", [], "[Add the skills this work shows]"),
    section("Collaboration", collab.map(dated), "[Add work you did with or for others]"),
  ].join("\n\n");
}

export function buildOutput(type: GenerationType, input: OutputInput): string {
  switch (type) {
    case "standup":
      return standup(input);
    case "weekly":
      return weekly(input);
    case "appraisal":
      return appraisal(input);
  }
}
