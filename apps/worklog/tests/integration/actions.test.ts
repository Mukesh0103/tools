import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEntriesForDay } from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { todayInZone } from "@/lib/dates";
import { createUser } from "./helpers";

let currentUser = "";
vi.mock("@/lib/auth", () => ({
  requireUserId: async () => currentUser,
  currentUserId: async () => currentUser || null,
  signOut: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createEntry, deleteEntry, restoreEntry, updateEntry } =
  await import("@/server/actions/entries");
const { adoptBrowserTimezone, saveSettings } = await import("@/server/actions/settings");

beforeEach(async () => {
  currentUser = (await createUser({ timezone: "Asia/Kolkata" })).id;
});

describe("entry actions", () => {
  it("parses blockers on create, keeps hashtags as text, and returns the local time", async () => {
    const today = todayInZone("Asia/Kolkata");
    const res = await createEntry({
      raw: "Waiting on DB creds #billing !blocker",
      entryDate: today,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      text: "Waiting on DB creds #billing",
      isBlocker: true,
      entryDate: today,
    });
    expect(res.data.time).toMatch(/^\d{2}:\d{2}$/);
    expect(await listEntriesForDay(currentUser, today)).toHaveLength(1);
  });

  it("keeps the client-generated id so optimistic rows match", async () => {
    const id = crypto.randomUUID();
    const res = await createEntry({
      id,
      raw: "Sprint planning",
      entryDate: todayInZone("Asia/Kolkata"),
    });
    expect(res.ok && res.data.id).toBe(id);
  });

  it("lets you log yesterday's work but not tomorrow's", async () => {
    const today = todayInZone("Asia/Kolkata");
    const [y, m, d] = today.split("-").map(Number) as [number, number, number];
    const shift = (n: number) => new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    expect((await createEntry({ raw: "Yesterday's work", entryDate: shift(-1) })).ok).toBe(true);
    expect(await createEntry({ raw: "Future work", entryDate: shift(1) })).toEqual({
      ok: false,
      error: "You can't log work for a future day.",
    });
  });

  it("rejects empty, blocker-only and over-long lines", async () => {
    const date = todayInZone("Asia/Kolkata");
    expect((await createEntry({ raw: "   ", entryDate: date })).ok).toBe(false);
    expect(await createEntry({ raw: "!blocker", entryDate: date })).toEqual({
      ok: false,
      error: "Add a few words besides !blocker.",
    });
    expect((await createEntry({ raw: "x".repeat(501), entryDate: date })).ok).toBe(false);
    expect((await createEntry({ raw: "ok", entryDate: "not-a-date" })).ok).toBe(false);
  });

  it("updates, deletes and restores with the original id and timestamp", async () => {
    const date = todayInZone("Asia/Kolkata");
    const created = await createEntry({ raw: "Fixed bug", entryDate: date });
    if (!created.ok) throw new Error(created.error);

    const updated = await updateEntry({
      id: created.data.id,
      raw: "Fixed pagination bug !blocker",
    });
    expect(updated.ok && updated.data).toMatchObject({
      text: "Fixed pagination bug",
      isBlocker: true,
    });

    const deleted = await deleteEntry({ id: created.data.id });
    if (!deleted.ok) throw new Error(deleted.error);
    expect(await listEntriesForDay(currentUser, date)).toHaveLength(0);

    const restored = await restoreEntry(deleted.data);
    expect(restored.ok && restored.data).toMatchObject({
      id: created.data.id,
      createdAt: created.data.createdAt,
    });
    expect(await listEntriesForDay(currentUser, date)).toHaveLength(1);
  });

  it("can't touch another user's entry", async () => {
    const created = await createEntry({ raw: "Mine", entryDate: todayInZone("Asia/Kolkata") });
    if (!created.ok) throw new Error(created.error);
    currentUser = (await createUser()).id;
    expect(await updateEntry({ id: created.data.id, raw: "Yours now" })).toEqual({
      ok: false,
      error: "That entry no longer exists.",
    });
    expect(await deleteEntry({ id: created.data.id })).toEqual({
      ok: false,
      error: "That entry no longer exists.",
    });
  });
});

describe("settings actions", () => {
  it("validates and saves preferences", async () => {
    const bad = await saveSettings({
      timezone: "Mars/Olympus",
      reminderEnabled: true,
      reminderTime: "18:00",
      standupFormat: "ytb",
    });
    expect(bad).toEqual({ ok: false, error: "Unknown time zone" });

    const res = await saveSettings({
      timezone: "Europe/London",
      reminderEnabled: true,
      reminderTime: "17:45",
      standupFormat: "paragraph",
    });
    expect(res.ok).toBe(true);
    const user = await getUserWithSettings(currentUser);
    expect(user?.timezone).toBe("Europe/London");
    expect(user?.settings).toMatchObject({
      reminderEnabled: true,
      reminderTime: "17:45:00",
      standupFormat: "paragraph",
    });
  });

  it("adopts the browser zone only when none is set", async () => {
    await adoptBrowserTimezone("America/Chicago");
    expect((await getUserWithSettings(currentUser))?.timezone).toBe("Asia/Kolkata");

    currentUser = (await createUser({ timezone: null })).id;
    await adoptBrowserTimezone("America/Chicago");
    expect((await getUserWithSettings(currentUser))?.timezone).toBe("America/Chicago");
  });
});
