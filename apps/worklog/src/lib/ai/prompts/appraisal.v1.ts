import { formatRangeLabel, monthsInRange, type DateRange } from "@/lib/dates";
import {
  DATA_NOT_INSTRUCTIONS,
  GROUNDING_RULES,
  HEADING_RULE,
  entriesBlock,
  formatEntryLine,
  sanitizeForPrompt,
  toneRule,
  type BuiltPrompt,
  type PromptEntry,
  type PromptInput,
} from "./shared";

export const APPRAISAL_VERSION = "appraisal.v1";
export const APPRAISAL_MONTH_VERSION = "appraisal-month.v1";
export const APPRAISAL_WORD_LIMIT = { concise: 250, detailed: 450 } as const;

/**
 * Past this many entries across more than one month, each month is summarized
 * on its own first and the monthly notes are then combined. Prompts stay short
 * and every bullet traces back to real entries.
 */
export const MAP_REDUCE_THRESHOLD = 40;

export function shouldSummarizeByMonth(entries: PromptEntry[], range: DateRange): boolean {
  return entries.length > MAP_REDUCE_THRESHOLD && monthsInRange(range).length > 1;
}

const SECTIONS = `Format: exactly four sections, in this order: **Accomplishments**, **Impact**, **Skills**, **Collaboration**.
${HEADING_RULE}
- Every bullet ends with its date in parentheses, like (28 Sep), or a span like (Jul–Aug).
- Accomplishments: what was shipped, finished or significantly moved forward.
- Impact: only outcomes the log actually states. For an important accomplishment whose outcome isn't recorded, add a placeholder bullet the user can fill in, such as "– [Add the outcome: tickets closed, time saved, customers unblocked] (28 Sep)". Never make up metrics.
- Skills: skills, technologies or practices the work shows, such as writing an RFC or leading a migration.
- Collaboration: work done with or for other people, such as pairing, reviews, demos, mentoring or unblocking others.
Keep the most significant items. Merge repeated work into one bullet with a date span.`;

function appraisalInstructions(tone: PromptInput["tone"], source: "entries" | "notes") {
  const sourceRule =
    source === "entries"
      ? DATA_NOT_INSTRUCTIONS
      : DATA_NOT_INSTRUCTIONS.replaceAll("<entries>", "<monthly_notes>");
  return `You write appraisal notes (self-review material) from a person's own work log.

${sourceRule}

Rules:
${GROUNDING_RULES}

${SECTIONS}

${toneRule(tone, APPRAISAL_WORD_LIMIT.concise, APPRAISAL_WORD_LIMIT.detailed)}`;
}

export function buildAppraisalPrompt(input: PromptInput): BuiltPrompt {
  const lines = input.entries.map((e) => formatEntryLine(e));
  return {
    version: APPRAISAL_VERSION,
    instructions: appraisalInstructions(input.tone, "entries"),
    prompt: `Write appraisal notes for ${formatRangeLabel(input.range)}.\n\n${entriesBlock(lines)}`,
  };
}

export function buildAppraisalMonthPrompt(month: {
  label: string;
  entries: PromptEntry[];
}): BuiltPrompt {
  const lines = month.entries.map((e) => formatEntryLine(e));
  return {
    version: APPRAISAL_MONTH_VERSION,
    instructions: `You condense one month of a person's work log into notes that will later become appraisal material.

${DATA_NOT_INSTRUCTIONS}

Rules:
${GROUNDING_RULES}

Format: up to 12 bullets, most significant first. Each bullet starts with "– ", describes one piece of work, and ends with its date in parentheses, like (14 Jul). Merge repeated work into one bullet with a span, like (3–17 Jul). Name the people involved when the entry does, and keep any stated outcomes. No headings.`,
    prompt: `Condense the work log for ${month.label}.\n\n${entriesBlock(lines)}`,
  };
}

export function buildAppraisalCombinePrompt(
  input: Omit<PromptInput, "entries">,
  notes: { label: string; text: string }[],
): BuiltPrompt {
  const blocks = notes
    .map(
      (n) => `<monthly_notes month="${n.label}">\n${sanitizeForPrompt(n.text)}\n</monthly_notes>`,
    )
    .join("\n\n");
  return {
    version: `${APPRAISAL_VERSION}+${APPRAISAL_MONTH_VERSION}`,
    instructions: appraisalInstructions(input.tone, "notes"),
    prompt: `Write appraisal notes for ${formatRangeLabel(input.range)} from these monthly notes, which were condensed from the work log.\n\n${blocks}`,
  };
}
