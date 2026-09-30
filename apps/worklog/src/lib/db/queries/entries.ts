import { and, arrayContains, asc, count, desc, eq, gte, ilike, lt, lte, sql } from "drizzle-orm";
import type { DateRange, ISODate } from "@/lib/dates";
import { getDb } from "../client";
import { entries, type Entry, type NewEntry } from "../schema";

const newestFirst = [desc(entries.entryDate), desc(entries.createdAt)] as const;

export async function listEntriesForDay(userId: string, date: ISODate): Promise<Entry[]> {
  return getDb()
    .select()
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.entryDate, date)))
    .orderBy(desc(entries.createdAt));
}

/** Oldest first, which is the order prompts read best in. */
export async function listEntriesInRange(userId: string, range: DateRange): Promise<Entry[]> {
  return getDb()
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.entryDate, range.start),
        lte(entries.entryDate, range.end),
      ),
    )
    .orderBy(asc(entries.entryDate), asc(entries.createdAt));
}

export async function countEntriesInRange(userId: string, range: DateRange): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.entryDate, range.start),
        lte(entries.entryDate, range.end),
      ),
    );
  return row?.n ?? 0;
}

export async function hasEntriesOn(userId: string, date: ISODate): Promise<boolean> {
  return (await countEntriesInRange(userId, { start: date, end: date })) > 0;
}

export type TimelineFilter = {
  q?: string;
  tag?: string;
  blockersOnly?: boolean;
  before?: ISODate;
  limit?: number;
};

export const TIMELINE_PAGE_SIZE = 100;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listTimeline(
  userId: string,
  filter: TimelineFilter = {},
): Promise<{ entries: Entry[]; hasMore: boolean }> {
  const limit = filter.limit ?? TIMELINE_PAGE_SIZE;
  const conditions = [eq(entries.userId, userId)];
  if (filter.q?.trim()) conditions.push(ilike(entries.text, `%${escapeLike(filter.q.trim())}%`));
  if (filter.tag) conditions.push(arrayContains(entries.tags, [filter.tag]));
  if (filter.blockersOnly) conditions.push(eq(entries.isBlocker, true));
  if (filter.before) conditions.push(lt(entries.entryDate, filter.before));

  const rows = await getDb()
    .select()
    .from(entries)
    .where(and(...conditions))
    .orderBy(...newestFirst)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  let page = hasMore ? rows.slice(0, limit) : rows;
  // Never cut a day in half: if there's more, drop the last partial day so "Show older" starts cleanly.
  if (hasMore && page.length > 0) {
    const lastDay = page.at(-1)!.entryDate;
    const trimmed = page.filter((e) => e.entryDate !== lastDay);
    if (trimmed.length > 0) page = trimmed;
  }
  return { entries: page, hasMore };
}

export async function listTopTags(userId: string, limit = 12): Promise<string[]> {
  const tag = sql<string>`unnest(${entries.tags})`;
  const rows = await getDb()
    .select({ tag, uses: count() })
    .from(entries)
    .where(eq(entries.userId, userId))
    .groupBy(tag)
    .orderBy(desc(count()), asc(tag))
    .limit(limit);
  return rows.map((r) => r.tag);
}

export async function insertEntry(values: NewEntry & { userId: string }): Promise<Entry> {
  const [row] = await getDb().insert(entries).values(values).returning();
  return row!;
}

export async function updateEntry(
  userId: string,
  id: string,
  values: Pick<Entry, "text" | "tags" | "isBlocker">,
): Promise<Entry | undefined> {
  const [row] = await getDb()
    .update(entries)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .returning();
  return row;
}

export async function deleteEntry(userId: string, id: string): Promise<Entry | undefined> {
  const [row] = await getDb()
    .delete(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .returning();
  return row;
}

export async function listAllEntries(userId: string): Promise<Entry[]> {
  return getDb()
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(asc(entries.entryDate), asc(entries.createdAt));
}
