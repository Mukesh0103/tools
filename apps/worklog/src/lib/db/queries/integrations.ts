import { and, eq, inArray } from "drizzle-orm";
import type { IntegrationStatus } from "@/lib/integrations/types";
import { getDb } from "../client";
import {
  entries,
  entryDismissals,
  integrations,
  settings,
  users,
  type Entry,
  type Integration,
  type IntegrationProvider,
  type NewEntry,
} from "../schema";

export async function listIntegrations(userId: string): Promise<Integration[]> {
  return getDb()
    .select()
    .from(integrations)
    .where(eq(integrations.userId, userId))
    .orderBy(integrations.provider);
}

/** The client-safe view: no token, no email. */
export function toIntegrationStatus(row: Integration): IntegrationStatus {
  return {
    provider: row.provider,
    displayName: row.displayName,
    siteUrl: row.siteUrl,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export async function listIntegrationStatuses(userId: string): Promise<IntegrationStatus[]> {
  return (await listIntegrations(userId)).map(toIntegrationStatus);
}

/** Connecting again replaces the token and clears the sync state. */
export async function upsertIntegration(
  values: Omit<Integration, "createdAt" | "lastSyncedAt" | "lastError">,
): Promise<void> {
  await getDb()
    .insert(integrations)
    .values(values)
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accountId: values.accountId,
        displayName: values.displayName,
        siteUrl: values.siteUrl,
        email: values.email,
        secret: values.secret,
        lastSyncedAt: null,
        lastError: null,
      },
    });
}

export async function deleteIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  await getDb()
    .delete(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
}

export async function markSynced(
  userId: string,
  provider: IntegrationProvider,
  at: Date,
  error: string | null,
): Promise<void> {
  await getDb()
    .update(integrations)
    .set({ lastSyncedAt: at, lastError: error })
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
}

/** Everyone with at least one connection, with their zone and AI setting, for the hourly sync. */
export async function listUsersWithIntegrations(): Promise<
  { userId: string; timezone: string | null; aiSummaries: boolean }[]
> {
  const rows = await getDb()
    .selectDistinct({
      userId: integrations.userId,
      timezone: users.timezone,
      aiSummaries: settings.aiSummaries,
    })
    .from(integrations)
    .innerJoin(users, eq(users.id, integrations.userId))
    .leftJoin(settings, eq(settings.userId, integrations.userId));
  // No settings row yet means the defaults, where AI summaries are on.
  return rows.map((r) => ({ ...r, aiSummaries: r.aiSummaries ?? true }));
}

/** External ids that already exist as entries, or that the user deleted. */
export async function knownExternalIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = getDb();
  const [existing, dismissed] = await Promise.all([
    db
      .select({ id: entries.externalId })
      .from(entries)
      .where(and(eq(entries.userId, userId), inArray(entries.externalId, ids))),
    db
      .select({ id: entryDismissals.externalId })
      .from(entryDismissals)
      .where(and(eq(entryDismissals.userId, userId), inArray(entryDismissals.externalId, ids))),
  ]);
  return new Set([...existing, ...dismissed].map((r) => r.id!).filter(Boolean));
}

/** Inserts imported entries. A row that another sync already added is skipped, never duplicated. */
export async function insertImportedEntries(
  userId: string,
  rows: Omit<NewEntry, "userId">[],
): Promise<Entry[]> {
  if (rows.length === 0) return [];
  return getDb()
    .insert(entries)
    .values(rows.map((r) => ({ ...r, userId })))
    .onConflictDoNothing({ target: [entries.userId, entries.externalId] })
    .returning();
}

export async function dismissExternalId(userId: string, externalId: string): Promise<void> {
  await getDb().insert(entryDismissals).values({ userId, externalId }).onConflictDoNothing();
}

export async function undismissExternalId(userId: string, externalId: string): Promise<void> {
  await getDb()
    .delete(entryDismissals)
    .where(and(eq(entryDismissals.userId, userId), eq(entryDismissals.externalId, externalId)));
}
