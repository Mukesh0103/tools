import { formatDayMonth, formatShortDate } from "@/lib/dates";
import type { GenerationType } from "@/lib/db/schema";
import type { PromptEntry, PromptInput } from "./prompts/shared";

export const FALLBACK_VERSION = "plain.v1";
export const FALLBACK_MODEL = "plain-template";

const bullet = (text: string) => `– ${text}`;

function section(heading: string, lines: string[], empty: string): string {
  return [`**${heading}**`, ...(lines.length ? lines : [bullet(empty)])].join("\n");
}

function standup({ entries, range, format }: PromptInput): string {
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
    const join = (list: PromptEntry[]) => list.map((e) => e.text.replace(/[.\s]+$/, "")).join("; ");
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

function titleFromTag(tag: string): string {
  const words = tag.replace(/^#/, "").split(/[-_]/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Other";
}

function weekly({ entries }: PromptInput): string {
  const groups = new Map<string, PromptEntry[]>();
  for (const e of entries) {
    const key = e.tags[0] ? titleFromTag(e.tags[0]) : "Other";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length || (a[0] === "Other" ? 1 : b[0] === "Other" ? -1 : 0),
  );
  return ordered
    .map(([heading, list]) =>
      [
        `**${heading}**`,
        ...list.map((e) =>
          bullet(`${e.isBlocker ? "Blocked: " : ""}${e.text} (${formatShortDate(e.date)})`),
        ),
      ].join("\n"),
    )
    .join("\n\n");
}

const COLLAB =
  /\b(pair(ed|ing)?|review(ed|ing)?|demo(ed)?|mentor(ed|ing)?|help(ed|ing)?|with|workshop|interview(ed)?|onboard(ed|ing)?)\b/i;

function appraisal({ entries }: PromptInput): string {
  const done = entries.filter((e) => !e.isBlocker);
  const collab = done.filter((e) => COLLAB.test(e.text));
  const dated = (e: PromptEntry) => bullet(`${e.text} (${formatDayMonth(e.date)})`);
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

export function buildFallback(type: GenerationType, input: PromptInput): string {
  switch (type) {
    case "standup":
      return standup(input);
    case "weekly":
      return weekly(input);
    case "appraisal":
      return appraisal(input);
  }
}
