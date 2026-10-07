"use server";

import { revalidatePath } from "next/cache";
import { requireUserId, signOut } from "@/lib/auth";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { updateGenerationOutput } from "@/lib/db/queries/generations";
import {
  deleteUser,
  getUserWithSettings,
  updateUserTimezone,
  upsertSettings,
} from "@/lib/db/queries/users";
import { saveGenerationEditSchema, settingsSchema, timeZoneSchema } from "@/lib/validators";
import type { ActionResult } from "./entries";

export async function saveSettings(input: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };

  const { timezone, reminderTime, aiSummaries, ...rest } = parsed.data;
  const time = `${reminderTime}:00`;
  const before = (await getUserWithSettings(userId))?.settings;
  // A new reminder time, or switching it back on, brings back a reminder closed earlier today.
  const reminderChanged =
    before?.reminderTime !== time || (rest.reminderEnabled && !before.reminderEnabled);
  await updateUserTimezone(userId, timezone);
  await upsertSettings(userId, {
    ...rest,
    reminderTime: time,
    ...(aiSummaries === undefined ? {} : { aiSummaries }),
    ...(reminderChanged ? { lastRemindedOn: null } : {}),
  });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Called once from the browser when the account has no zone yet. It never
 * overwrites a zone the user picked.
 */
export async function adoptBrowserTimezone(timezone: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = timeZoneSchema.safeParse(timezone);
  if (!parsed.success) return { ok: false, error: "Unknown time zone" };
  const user = await getUserWithSettings(userId);
  if (user && !user.timezone) {
    await updateUserTimezone(userId, parsed.data);
    revalidatePath("/", "layout");
  }
  return { ok: true, data: null };
}

/** Closes the in-app reminder for the rest of the user's local day. */
export async function dismissReminder(): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const user = await getUserWithSettings(userId);
  await upsertSettings(userId, { lastRemindedOn: todayInZone(resolveTimeZone(user?.timezone)) });
  return { ok: true, data: null };
}

/** Switches the account to the device's zone, from the hint on Today. */
export async function switchTimezone(timezone: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = timeZoneSchema.safeParse(timezone);
  if (!parsed.success) return { ok: false, error: "Unknown time zone" };
  await updateUserTimezone(userId, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function saveGenerationEdit(input: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  const parsed = saveGenerationEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid output" };
  await updateGenerationOutput(userId, parsed.data.id, parsed.data.output);
  revalidatePath("/history");
  return { ok: true, data: null };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function deleteAccount(confirmation: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  if (confirmation !== "delete") return { ok: false, error: 'Type "delete" to confirm.' };
  await deleteUser(userId);
  await signOut({ redirectTo: "/login?deleted=1" });
  return { ok: true, data: null };
}
