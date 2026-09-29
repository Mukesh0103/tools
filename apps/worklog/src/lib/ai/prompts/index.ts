import type { GenerationType } from "@/lib/db/schema";
import { buildAppraisalPrompt } from "./appraisal.v1";
import type { BuiltPrompt, PromptInput } from "./shared";
import { buildStandupPrompt } from "./standup.v1";
import { buildWeeklyPrompt } from "./weekly.v1";

export * from "./shared";
export * from "./standup.v1";
export * from "./weekly.v1";
export * from "./appraisal.v1";

/** Single-pass builders. Long appraisal ranges go through the month pass in pipeline.ts. */
export const PROMPT_BUILDERS: Record<GenerationType, (input: PromptInput) => BuiltPrompt> = {
  standup: buildStandupPrompt,
  weekly: buildWeeklyPrompt,
  appraisal: buildAppraisalPrompt,
};
