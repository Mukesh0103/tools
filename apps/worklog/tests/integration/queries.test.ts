import { describe, expect, it } from "vitest";
import * as entryQ from "@/lib/db/queries/entries";
import * as genQ from "@/lib/db/queries/generations";
import { listDueReminders, markReminded } from "@/lib/db/queries/reminders";
import { deleteUser, getUserWithSettings, upsertSettings } from "@/lib/db/queries/users";
import { createUser, seedEntries } from "./helpers";

describe("entries", () => {
  it("never returns or modifies another user's entries", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const [row] = await seedEntries(alice.id, [{ entryDate: "2026-09-29", text: "Alice's work" }]);

    expect(await entryQ.listEntriesForDay(bob.id, "2026-09-29")).toEqual([]);
    expect(await entryQ.listTimeline(bob.id)).toEqual({ entries: [], hasMore: false });
    expect(
      await entryQ.updateEntry(bob.id, row!.id, { text: "hijacked", isBlocker: false }),
    ).toBeUndefined();
    expect(await entryQ.deleteEntry(bob.id, row!.id)).toBeUndefined();
    expect((await entryQ.listEntriesForDay(alice.id, "2026-09-29"))[0]?.text).toBe("Alice's work");
  });

  it("reads inclusive date ranges, oldest first", async () => {
    const u = await createUser();
    await seedEntries(u.id, [
      { entryDate: "2026-09-27", text: "before" },
      { entryDate: "2026-09-28", text: "start", createdAt: new Date("2026-09-28T09:00:00Z") },
      { entryDate: "2026-09-29", text: "end-late", createdAt: new Date("2026-09-29T18:00:00Z") },
      { entryDate: "2026-09-29", text: "end-early", createdAt: new Date("2026-09-29T08:00:00Z") },
      { entryDate: "2026-09-30", text: "after" },
    ]);
    const rows = await entryQ.listEntriesInRange(u.id, { start: "2026-09-28", end: "2026-09-29" });
    expect(rows.map((r) => r.text)).toEqual(["start", "end-early", "end-late"]);
    expect(await entryQ.countEntriesInRange(u.id, { start: "2026-09-28", end: "2026-09-29" })).toBe(
      3,
    );
    expect(await entryQ.hasEntriesOn(u.id, "2026-09-30")).toBe(true);
    expect(await entryQ.hasEntriesOn(u.id, "2026-10-01")).toBe(false);
  });

  it("filters the timeline by search and blockers", async () => {
    const u = await createUser();
    await seedEntries(u.id, [
      { entryDate: "2026-09-29", text: "Fixed 100% CPU in the Invoices API" },
      { entryDate: "2026-09-29", text: "Waiting on DB creds", isBlocker: true },
      { entryDate: "2026-09-28", text: "Paired on flaky tests #infra" },
    ]);
    const texts = async (f: entryQ.TimelineFilter) =>
      (await entryQ.listTimeline(u.id, f)).entries.map((e) => e.text);

    expect(await texts({ q: "invoices" })).toEqual(["Fixed 100% CPU in the Invoices API"]);
    expect(await texts({ q: "100%" })).toEqual(["Fixed 100% CPU in the Invoices API"]);
    expect(await texts({ q: "%" })).toEqual(["Fixed 100% CPU in the Invoices API"]);
    expect(await texts({ q: "#infra" })).toEqual(["Paired on flaky tests #infra"]);
    expect(await texts({ blockersOnly: true })).toEqual(["Waiting on DB creds"]);
  });

  it("pages whole days so 'Show older' never splits one", async () => {
    const u = await createUser();
    await seedEntries(u.id, [
      { entryDate: "2026-09-29", text: "a" },
      { entryDate: "2026-09-29", text: "b" },
      { entryDate: "2026-09-28", text: "c" },
      { entryDate: "2026-09-28", text: "d" },
      { entryDate: "2026-09-27", text: "e" },
    ]);
    const page = await entryQ.listTimeline(u.id, { limit: 3 });
    expect(page.hasMore).toBe(true);
    expect(page.entries.map((e) => e.entryDate)).toEqual(["2026-09-29", "2026-09-29"]);
  });
});

describe("generations", () => {
  it("saves, lists by type, and edits only the owner's outputs", async () => {
    const u = await createUser();
    const other = await createUser();
    const base = {
      userId: u.id,
      rangeStart: "2026-09-28",
      rangeEnd: "2026-09-29",
    };
    const standup = await genQ.insertGeneration({
      ...base,
      id: crypto.randomUUID(),
      type: "standup",
      output: "**Today**\n– A",
    });
    await genQ.insertGeneration({
      ...base,
      id: crypto.randomUUID(),
      type: "weekly",
      output: "**Billing**\nB",
    });

    expect((await genQ.listGenerations(u.id)).length).toBe(2);
    expect((await genQ.listGenerations(u.id, "weekly")).map((g) => g.type)).toEqual(["weekly"]);
    expect(await genQ.getGeneration(other.id, standup.id)).toBeUndefined();
    expect(await genQ.updateGenerationOutput(other.id, standup.id, "nope")).toBe(false);
    expect(await genQ.updateGenerationOutput(u.id, standup.id, "**Today**\n– Edited")).toBe(true);
    expect((await genQ.getGeneration(u.id, standup.id))?.output).toBe("**Today**\n– Edited");
  });
});

describe("users and settings", () => {
  it("returns default settings until saved, then upserts", async () => {
    const u = await createUser();
    expect((await getUserWithSettings(u.id))?.settings).toMatchObject({
      reminderEnabled: false,
      standupFormat: "ytb",
    });
    await upsertSettings(u.id, { reminderEnabled: true, reminderTime: "17:30:00" });
    await upsertSettings(u.id, { standupFormat: "bullets" });
    expect((await getUserWithSettings(u.id))?.settings).toMatchObject({
      reminderEnabled: true,
      reminderTime: "17:30:00",
      standupFormat: "bullets",
    });
  });

  it("deletes everything with the account", async () => {
    const u = await createUser();
    await seedEntries(u.id, [{ entryDate: "2026-09-29", text: "gone soon" }]);
    await upsertSettings(u.id, { reminderEnabled: true });
    await deleteUser(u.id);
    expect(await getUserWithSettings(u.id)).toBeUndefined();
    expect(await entryQ.listAllEntries(u.id)).toEqual([]);
  });
});

describe("reminders", () => {
  it("picks users past their reminder time who haven't logged today, once", async () => {
    const now = new Date("2026-09-29T13:00:00Z"); // 18:30 in Kolkata
    const due = await createUser({ timezone: "Asia/Kolkata" });
    const logged = await createUser({ timezone: "Asia/Kolkata" });
    const early = await createUser({ timezone: "America/New_York" }); // 09:00 there
    const off = await createUser({ timezone: "Asia/Kolkata" });
    for (const u of [due, logged, early])
      await upsertSettings(u.id, { reminderEnabled: true, reminderTime: "18:00:00" });
    await upsertSettings(off.id, { reminderEnabled: false, reminderTime: "18:00:00" });
    await seedEntries(logged.id, [{ entryDate: "2026-09-29", text: "Already logged" }]);

    const ids = (await listDueReminders(now)).map((c) => c.userId);
    expect(ids).toContain(due.id);
    expect(ids).not.toContain(logged.id);
    expect(ids).not.toContain(early.id);
    expect(ids).not.toContain(off.id);

    await markReminded(due.id, "2026-09-29");
    expect((await listDueReminders(now)).map((c) => c.userId)).not.toContain(due.id);
  });
});
