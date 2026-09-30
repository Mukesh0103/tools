import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { entries, users, type NewEntry } from "@/lib/db/schema";

export async function createUser(opts: { timezone?: string | null; name?: string } = {}) {
  const [user] = await getDb()
    .insert(users)
    .values({
      email: `user-${randomUUID()}@worklog.test`,
      name: opts.name ?? "Test User",
      timezone: opts.timezone === undefined ? "UTC" : opts.timezone,
    })
    .returning();
  return user!;
}

export async function seedEntries(
  userId: string,
  rows: (Omit<NewEntry, "userId"> & { createdAt?: Date })[],
) {
  if (rows.length === 0) return [];
  return getDb()
    .insert(entries)
    .values(rows.map((r) => ({ ...r, userId })))
    .returning();
}
