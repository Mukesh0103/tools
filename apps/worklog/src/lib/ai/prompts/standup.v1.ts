import { formatLongDate, formatShortDate } from "@/lib/dates";
import type { StandupFormat } from "@/lib/db/schema";
import {
  DATA_NOT_INSTRUCTIONS,
  GROUNDING_RULES,
  HEADING_RULE,
  entriesBlock,
  formatEntryLine,
  toneRule,
  type BuiltPrompt,
  type PromptInput,
} from "./shared";

export const STANDUP_VERSION = "standup.v1";
export const STANDUP_WORD_LIMIT = { concise: 120, detailed: 200 } as const;

const FORMATS: Record<StandupFormat, string> = {
  ytb: `Format: exactly three sections, in this order: **Yesterday**, **Today**, **Blockers**.
${HEADING_RULE}
- Yesterday: one bullet per piece of work from the entries labelled "earlier".
- Today: one bullet per piece of work from the entries labelled "today". If there are none, write "– Nothing logged yet today".
- Blockers: one bullet per entry marked BLOCKER, plus any entry that plainly says the user is stuck or waiting. If there are none, write "– None".
Put a blocker only under Blockers, not also under Yesterday or Today.`,
  bullets: `Format: a single list with no headings. Each bullet starts with "Yesterday:", "Today:" or "Blocker:". Put the earlier work first, then today's, then blockers. If there are no blockers, end with "– Blocker: none".
Bullets start with "– " (an en dash and a space).`,
  paragraph: `Format: one short paragraph of two to four sentences, in the order: earlier work, today's work, blockers. Say "No blockers." if there are none. No headings and no bullets.`,
};

export function buildStandupPrompt(input: PromptInput): BuiltPrompt {
  const today = input.range.end;
  const lines = input.entries.map((e) =>
    formatEntryLine(e, e.date === today ? "today" : "earlier"),
  );

  const instructions = `You write daily standup updates from a person's own work log.

${DATA_NOT_INSTRUCTIONS}

Rules:
${GROUNDING_RULES}

${FORMATS[input.format]}

${toneRule(input.tone, STANDUP_WORD_LIMIT.concise, STANDUP_WORD_LIMIT.detailed)}`;

  const prompt = `Write the standup for ${formatLongDate(today)}.
"Earlier" covers ${formatShortDate(input.range.start)}${
    input.range.start === today ? "" : ` up to the day before ${formatShortDate(today)}`
  }. "Today" is ${formatShortDate(today)}.

${entriesBlock(lines)}`;

  return { version: STANDUP_VERSION, instructions, prompt };
}
