"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { compareDates, resolveTimeZone, todayInZone } from "@/lib/dates";
import * as q from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { toEntryView, type EntryView } from "@/lib/entry-view";
import { parseEntry } from "@/lib/parse-entry";
import {
  createEntrySchema,
  deleteEntrySchema,
  restoreEntrySchema,
  updateEntrySchema,
} from "@/lib/validators";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function userZone(userId: string) {
  const user = await getUserWithSettings(userId);
  return resolveTimeZone(user?.timezone);
}

function revalidateEntries() {
  revalidatePath("/today");
  revalidatePath("/timeline");
}

export async function createEntry(input: unknown): Promise<ActionResult<EntryView>> {
  const userId = await requireUserId();
  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry" };

  const tz = await userZone(userId);
  if (compareDates(parsed.data.entryDate, todayInZone(tz)) > 0) {
    return { ok: false, error: "You can't log work for a future day." };
  }
  const entry = parseEntry(parsed.data.raw);
  if (!entry.text) return { ok: false, error: "Add a few words besides tags." };

  try {
    const row = await q.insertEntry({
      id: parsed.data.id,
      userId,
      entryDate: parsed.data.entryDate,
      text: entry.text,
      tags: entry.tags,
      isBlocker: entry.isBlocker,
    });
    revalidateEntries();
    return { ok: true, data: toEntryView(row, tz) };
  } catch (error) {
    console.error("[createEntry]", error);
    return { ok: false, error: "Couldn't save. Your text is still here." };
  }
}

export async function updateEntry(input: unknown): Promise<ActionResult<EntryView>> {
  const userId = await requireUserId();
  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry" };

  const entry = parseEntry(parsed.data.raw);
  if (!entry.text) return { ok: false, error: "Add a few words besides tags." };

  const row = await q.updateEntry(userId, parsed.data.id, entry);
  if (!row) return { ok: false, error: "That entry no longer exists." };
  revalidateEntries();
  return { ok: true, data: toEntryView(row, await userZone(userId)) };
}

export async function deleteEntry(input: unknown): Promise<ActionResult<EntryView>> {
  const userId = await requireUserId();
  const parsed = deleteEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entry" };

  const row = await q.deleteEntry(userId, parsed.data.id);
  if (!row) return { ok: false, error: "That entry no longer exists." };
  revalidateEntries();
  return { ok: true, data: toEntryView(row, await userZone(userId)) };
}

/** Undo for a delete: puts the row back with its original id and timestamp. */
export async function restoreEntry(input: unknown): Promise<ActionResult<EntryView>> {
  const userId = await requireUserId();
  const parsed = restoreEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't restore that entry." };
  try {
    const row = await q.insertEntry({ ...parsed.data, userId });
    revalidateEntries();
    return { ok: true, data: toEntryView(row, await userZone(userId)) };
  } catch (error) {
    console.error("[restoreEntry]", error);
    return { ok: false, error: "Couldn't restore that entry." };
  }
}
