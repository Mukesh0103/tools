import "server-only";
import { monthsInRange, timeInZone, type DateRange, type ISODate } from "@/lib/dates";
import type { Entry, GenerationType, StandupFormat, Tone } from "@/lib/db/schema";
import { aiProvider, generateModelText, modelId, streamMockText, streamModelText } from "./client";
import { FALLBACK_MODEL, FALLBACK_VERSION, buildFallback } from "./fallback";
import {
  PROMPT_BUILDERS,
  buildAppraisalCombinePrompt,
  buildAppraisalMonthPrompt,
  shouldSummarizeByMonth,
  type PromptEntry,
  type PromptInput,
} from "./prompts";

export function toPromptEntry(entry: Entry, tz: string): PromptEntry {
  return {
    date: entry.entryDate,
    time: timeInZone(entry.createdAt, tz),
    text: entry.text,
    tags: entry.tags,
    isBlocker: entry.isBlocker,
  };
}

export type GenerationJob = {
  promptVersion: string;
  model: string;
  stream: (signal?: AbortSignal) => AsyncGenerator<string>;
};

export type JobInput = {
  type: GenerationType;
  range: DateRange;
  today: ISODate;
  tone: Tone;
  format: StandupFormat;
  entries: PromptEntry[];
  mode: "ai" | "plain";
};

const MONTH_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export function createGenerationJob(input: JobInput): GenerationJob {
  const promptInput: PromptInput = {
    entries: input.entries,
    range: input.range,
    today: input.today,
    tone: input.tone,
    format: input.format,
  };
  const plain = buildFallback(input.type, promptInput);
  const provider = aiProvider();

  if (input.mode === "plain") {
    return {
      promptVersion: FALLBACK_VERSION,
      model: FALLBACK_MODEL,
      stream: async function* () {
        yield plain;
      },
    };
  }

  if (provider === "mock") {
    return {
      promptVersion: `${PROMPT_BUILDERS[input.type](promptInput).version}+mock`,
      model: "mock",
      stream: (signal) => streamMockText(plain, signal),
    };
  }

  if (provider === "unavailable") {
    return {
      promptVersion: "none",
      model: "none",
      stream: async function* () {
        throw new AiUnavailableError();
      },
    };
  }

  if (input.type === "appraisal" && shouldSummarizeByMonth(input.entries, input.range)) {
    const months = monthsInRange(input.range)
      .map((m) => ({
        ...m,
        entries: input.entries.filter((e) => e.date >= m.start && e.date <= m.end),
      }))
      .filter((m) => m.entries.length > 0);
    const combinedVersion = buildAppraisalCombinePrompt(promptInput, []).version;
    return {
      promptVersion: combinedVersion,
      model: `${modelId("main")}+${modelId("fast")}`,
      stream: async function* (signal) {
        const notes = await mapWithConcurrency(months, MONTH_CONCURRENCY, async (month) => {
          const p = buildAppraisalMonthPrompt(month);
          const text = await generateModelText({ ...p, kind: "fast", signal });
          return { label: month.label, text };
        });
        const combine = buildAppraisalCombinePrompt(promptInput, notes);
        yield* streamModelText({ ...combine, signal, maxOutputTokens: 1600 });
      },
    };
  }

  const built = PROMPT_BUILDERS[input.type](promptInput);
  return {
    promptVersion: built.version,
    model: modelId("main"),
    stream: (signal) =>
      streamModelText({
        ...built,
        signal,
        maxOutputTokens: input.type === "appraisal" ? 1600 : 900,
      }),
  };
}

export class AiUnavailableError extends Error {
  constructor() {
    super("AI generation is not configured (ANTHROPIC_API_KEY is missing).");
    this.name = "AiUnavailableError";
  }
}
