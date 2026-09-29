import { formatRangeLabel } from "@/lib/dates";
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

export const WEEKLY_VERSION = "weekly.v1";
export const WEEKLY_WORD_LIMIT = { concise: 160, detailed: 320 } as const;

export function buildWeeklyPrompt(input: PromptInput): BuiltPrompt {
  const lines = input.entries.map((e) => formatEntryLine(e));

  const instructions = `You write short weekly work summaries from a person's own work log.

${DATA_NOT_INSTRUCTIONS}

Rules:
${GROUNDING_RULES}

Format: group the work into two to five projects or themes. Tags such as #billing are strong hints, so "#billing" becomes a section called **Billing**. Combine small themes and don't make a section for a single trivial entry.
${HEADING_RULE}
Under each heading write one to three sentences of narrative prose, not bullets. Say what was shipped or moved forward, and mention blockers in the section they belong to. Order sections by how much work they hold, largest first.

${toneRule(input.tone, WEEKLY_WORD_LIMIT.concise, WEEKLY_WORD_LIMIT.detailed)}`;

  const prompt = `Write the weekly summary for ${formatRangeLabel(input.range)}.

${entriesBlock(lines)}`;

  return { version: WEEKLY_VERSION, instructions, prompt };
}
