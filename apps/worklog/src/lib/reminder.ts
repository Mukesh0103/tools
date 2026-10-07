import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { todayInZone, type ISODate } from "./dates";

/**
 * Decides whether the in-app reminder is due, as a pure function. It is due once
 * the local reminder time has passed, unless the user already closed it today.
 * Whether anything is logged is checked separately, by the caller.
 */
export function isReminderDue(opts: {
  now: Date;
  timezone: string;
  reminderTime: string;
  dismissedOn: ISODate | null;
}): boolean {
  const localDate = todayInZone(opts.timezone, opts.now);
  if (opts.dismissedOn === localDate) return false;
  const localTime = formatInTimeZone(opts.now, opts.timezone, "HH:mm");
  return localTime >= opts.reminderTime.slice(0, 5);
}

/** Milliseconds until today's reminder time in `tz`, or 0 once it has passed. */
export function msUntilReminder(tz: string, reminderTime: string, now: Date = new Date()): number {
  const at = fromZonedTime(`${todayInZone(tz, now)}T${reminderTime.slice(0, 5)}:00`, tz);
  return Math.max(0, at.getTime() - now.getTime());
}

const ENTRY_LOGGED = "worklog:entry-logged";

/** Tells an open reminder that an entry was saved for `date`, so it can close straight away. */
export function announceEntryLogged(date: ISODate) {
  window.dispatchEvent(new CustomEvent(ENTRY_LOGGED, { detail: date }));
}

export function onEntryLogged(listener: (date: ISODate) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<ISODate>).detail);
  window.addEventListener(ENTRY_LOGGED, handler);
  return () => window.removeEventListener(ENTRY_LOGGED, handler);
}
