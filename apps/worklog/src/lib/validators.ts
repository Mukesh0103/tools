import { z } from "zod";
import { daysBetween, isISODate, isValidTimeZone } from "./dates";

export const MAX_ENTRY_LENGTH = 500;
export const MAX_RANGE_DAYS = 370;

export const isoDate = z.string().refine(isISODate, "Expected a date like 2026-09-29");

export const entryText = z
  .string()
  .trim()
  .min(1, "Write what you worked on")
  .max(MAX_ENTRY_LENGTH, `Keep it under ${MAX_ENTRY_LENGTH} characters`);

export const createEntrySchema = z.object({
  raw: entryText,
  /** Omitted when logging from Today: the server then files it under the current day in the user's zone. */
  entryDate: isoDate.optional(),
  /** Client-generated id so optimistic rows and saved rows match. */
  id: z.uuid().optional(),
});

export const updateEntrySchema = z.object({
  id: z.uuid(),
  raw: entryText,
});

export const deleteEntrySchema = z.object({ id: z.uuid() });

const httpsUrl = z
  .string()
  .max(2000)
  .refine((v) => v.startsWith("https://"), "Expected an https link");

export const restoreEntrySchema = z.object({
  id: z.uuid(),
  entryDate: isoDate,
  text: z.string().min(1).max(MAX_ENTRY_LENGTH),
  isBlocker: z.boolean(),
  createdAt: z.coerce.date(),
  /** Imported entries keep their source, so undoing a delete also lifts the dismissal. */
  source: z.enum(["manual", "github", "jira"]).optional(),
  externalId: z.string().min(1).max(300).nullish(),
  url: httpsUrl.nullish(),
});

export const generationTypeSchema = z.enum(["standup", "weekly", "appraisal"]);
export const standupFormatSchema = z.enum(["ytb", "bullets", "paragraph"]);

export const dateRangeSchema = z
  .object({ start: isoDate, end: isoDate })
  .refine((r) => r.start <= r.end, "Start date must be on or before the end date")
  .refine((r) => daysBetween(r.start, r.end) <= MAX_RANGE_DAYS, "Pick a range of a year or less");

export const generateRequestSchema = z.object({
  type: generationTypeSchema,
  range: dateRangeSchema,
  format: standupFormatSchema.optional(),
});

export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, "Unknown time zone");

export const settingsSchema = z.object({
  timezone: timeZoneSchema,
  reminderEnabled: z.boolean(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  standupFormat: standupFormatSchema,
  /** Optional so a tab opened before this setting existed can still save the rest. */
  aiSummaries: z.boolean().optional(),
});

export const MAX_SYNC_DAYS = 31;

/** POST /api/sync. Without `range` or `days` it syncs the standup range (last workday and today). */
export const syncRequestSchema = z.object({
  range: dateRangeSchema
    .refine((r) => daysBetween(r.start, r.end) < MAX_SYNC_DAYS, "Sync a month or less at a time")
    .optional(),
  /** The last N days, ending today. Used for the backfill after connecting. */
  days: z.number().int().min(1).max(MAX_SYNC_DAYS).optional(),
  force: z.boolean().optional(),
});

export const githubConnectSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "That doesn't look like a GitHub token")
    .max(400, "That doesn't look like a GitHub token"),
});

export const jiraConnectSchema = z.object({
  site: z.string().trim().min(1, "Add your Jira site").max(200),
  email: z.email("Use the email you sign in to Jira with"),
  token: z.string().trim().min(10, "Paste your Atlassian API token").max(500),
});

export const saveGenerationEditSchema = z.object({
  id: z.uuid(),
  output: z.string().min(1).max(20_000),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type JiraConnectInput = z.infer<typeof jiraConnectSchema>;
