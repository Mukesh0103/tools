import { and, eq, isNotNull } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { getDb } from "../client";
import { settings, users } from "../schema";
import { hasEntriesOn } from "./entries";

export type ReminderCandidate = {
  userId: string;
  email: string;
  name: string | null;
  timezone: string;
  localDate: string;
};

/**
 * Decides whether a reminder is due, as a pure function.
 * It is due once the local reminder time has passed, as long as none was sent
 * today. That way an hourly cron that runs late, or a daily one, still sends
 * the reminder exactly once.
 */
export function isReminderDue(opts: {
  now: Date;
  timezone: string;
  reminderTime: string; // "HH:MM" or "HH:MM:SS"
  lastRemindedOn: string | null;
}): boolean {
  const localDate = todayInZone(opts.timezone, opts.now);
  if (opts.lastRemindedOn === localDate) return false;
  const localTime = formatInTimeZone(opts.now, opts.timezone, "HH:mm");
  return localTime >= opts.reminderTime.slice(0, 5);
}

/** Users with reminders on, due now, who haven't logged anything today. */
export async function listDueReminders(now: Date = new Date()): Promise<ReminderCandidate[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      timezone: users.timezone,
      reminderTime: settings.reminderTime,
      lastRemindedOn: settings.lastRemindedOn,
    })
    .from(settings)
    .innerJoin(users, eq(users.id, settings.userId))
    .where(and(eq(settings.reminderEnabled, true), isNotNull(users.email)));

  const due: ReminderCandidate[] = [];
  for (const row of rows) {
    const timezone = resolveTimeZone(row.timezone);
    if (
      !isReminderDue({
        now,
        timezone,
        reminderTime: row.reminderTime,
        lastRemindedOn: row.lastRemindedOn,
      })
    ) {
      continue;
    }
    const localDate = todayInZone(timezone, now);
    if (await hasEntriesOn(row.userId, localDate)) continue;
    due.push({ userId: row.userId, email: row.email!, name: row.name, timezone, localDate });
  }
  return due;
}

export async function markReminded(userId: string, localDate: string): Promise<void> {
  await getDb()
    .update(settings)
    .set({ lastRemindedOn: localDate })
    .where(eq(settings.userId, userId));
}
