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
  entryDate: isoDate,
  /** Client-generated id so optimistic rows and saved rows match. */
  id: z.uuid().optional(),
});

export const updateEntrySchema = z.object({
  id: z.uuid(),
  raw: entryText,
});

export const deleteEntrySchema = z.object({ id: z.uuid() });

export const restoreEntrySchema = z.object({
  id: z.uuid(),
  entryDate: isoDate,
  text: z.string().min(1).max(MAX_ENTRY_LENGTH),
  isBlocker: z.boolean(),
  createdAt: z.coerce.date(),
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
});

export const saveGenerationEditSchema = z.object({
  id: z.uuid(),
  output: z.string().min(1).max(20_000),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
