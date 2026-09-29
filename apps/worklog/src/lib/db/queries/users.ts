import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { accounts, settings, users, type Settings, type User } from "../schema";

export type UserWithSettings = User & { settings: Settings };

const defaults = (userId: string): Settings => ({
  userId,
  reminderTime: "18:00:00",
  reminderEnabled: false,
  lastRemindedOn: null,
  defaultTone: "concise",
  standupFormat: "ytb",
});

export async function getUserWithSettings(userId: string): Promise<UserWithSettings | undefined> {
  const [row] = await getDb()
    .select({ user: users, settings })
    .from(users)
    .leftJoin(settings, eq(settings.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) return undefined;
  return { ...row.user, settings: row.settings ?? defaults(userId) };
}

export async function updateUserTimezone(userId: string, timezone: string): Promise<void> {
  await getDb().update(users).set({ timezone }).where(eq(users.id, userId));
}

export async function upsertSettings(
  userId: string,
  values: Partial<Omit<Settings, "userId">>,
): Promise<Settings> {
  const [row] = await getDb()
    .insert(settings)
    .values({ ...defaults(userId), ...values, userId })
    .onConflictDoUpdate({ target: settings.userId, set: values })
    .returning();
  return row!;
}

/** Cascades to entries, generations, settings and auth rows. */
export async function deleteUser(userId: string): Promise<void> {
  await getDb().delete(users).where(eq(users.id, userId));
}

export async function findOrCreateUserByEmail(email: string, name?: string): Promise<User> {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ email, name: name ?? email.split("@")[0], emailVerified: new Date() })
    .returning();
  return created!;
}

export async function listLinkedProviders(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  return rows.map((r) => r.provider);
}
