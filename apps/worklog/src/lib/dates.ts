/**
 * Time-zone-aware date helpers.
 *
 * Calendar days travel through the app as ISO strings ("2026-09-29") with no
 * zone attached. "Now" only becomes a calendar day once it has been read in
 * the user's zone, via `todayInZone`. Day arithmetic is done in UTC, so DST
 * shifts can never skip or repeat a day.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type ISODate = string;
export type DateRange = { start: ISODate; end: ISODate };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

export function todayInZone(tz: string, now: Date = new Date()): ISODate {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

export function timeInZone(instant: Date, tz: string): string {
  return formatInTimeZone(instant, tz, "HH:mm");
}

function toUtcDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtcDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(start: ISODate, end: ISODate): number {
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / 86_400_000);
}

export function weekday(date: ISODate): number {
  return toUtcDate(date).getUTCDay();
}

export function previousWorkday(date: ISODate): ISODate {
  let d = addDays(date, -1);
  while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, -1);
  return d;
}

export function dayBoundsUtc(date: ISODate, tz: string): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${date}T00:00:00`, tz),
    end: fromZonedTime(`${addDays(date, 1)}T00:00:00`, tz),
  };
}

/** The instants a range of calendar days covers in `tz`: [start of first day, start of the day after the last). */
export function rangeBoundsUtc(range: DateRange, tz: string): { start: Date; end: Date } {
  return { start: dayBoundsUtc(range.start, tz).start, end: dayBoundsUtc(range.end, tz).end };
}

/** Milliseconds until the next local midnight in `tz`. */
export function msUntilNextDay(tz: string, now: Date = new Date()): number {
  const next = dayBoundsUtc(todayInZone(tz, now), tz).end;
  return Math.max(0, next.getTime() - now.getTime());
}

/** True when both zones are at the same UTC offset right now, so they agree on what "today" is. */
export function sameUtcOffset(a: string, b: string, now: Date = new Date()): boolean {
  return formatInTimeZone(now, a, "xxx") === formatInTimeZone(now, b, "xxx");
}

export function standupRange(tz: string, now: Date = new Date()): DateRange {
  const today = todayInZone(tz, now);
  return { start: previousWorkday(today), end: today };
}

export function weeklyRange(tz: string, now: Date = new Date()): DateRange {
  const today = todayInZone(tz, now);
  return { start: addDays(today, -6), end: today };
}

export function quarterRange(tz: string, now: Date = new Date(), offset = 0): DateRange {
  const today = todayInZone(tz, now);
  const [y, m] = today.split("-").map(Number) as [number, number];
  const q = Math.floor((m - 1) / 3) + offset;
  const year = y + Math.floor(q / 4);
  const qi = ((q % 4) + 4) % 4;
  const startMonth = qi * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const nextQuarter =
    qi === 3 ? `${year + 1}-01-01` : `${year}-${String(startMonth + 3).padStart(2, "0")}-01`;
  return { start, end: addDays(nextQuarter, -1) };
}

export function yearRange(tz: string, now: Date = new Date()): DateRange {
  const year = todayInZone(tz, now).slice(0, 4);
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function monthsInRange(range: DateRange): (DateRange & { label: string })[] {
  const months: (DateRange & { label: string })[] = [];
  let cursor = `${range.start.slice(0, 7)}-01`;
  while (compareDates(cursor, range.end) <= 0) {
    const [y, m] = cursor.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const start = compareDates(cursor, range.start) < 0 ? range.start : cursor;
    const lastDay = addDays(next, -1);
    const end = compareDates(lastDay, range.end) > 0 ? range.end : lastDay;
    months.push({ start, end, label: formatInTimeZone(toUtcDate(cursor), "UTC", "MMMM yyyy") });
    cursor = next;
  }
  return months;
}

function fmt(date: ISODate, pattern: string): string {
  return formatInTimeZone(toUtcDate(date), "UTC", pattern);
}

export function formatLongDate(date: ISODate): string {
  return fmt(date, "EEEE, d MMMM");
}

export function formatShortDate(date: ISODate): string {
  return fmt(date, "EEE d MMM");
}

export function formatDayMonth(date: ISODate): string {
  return fmt(date, "d MMM");
}

export function formatDayHeading(date: ISODate, today: ISODate): string {
  if (date === today) return `Today · ${formatShortDate(date)}`;
  if (date === addDays(today, -1)) return `Yesterday · ${formatShortDate(date)}`;
  return date.slice(0, 4) === today.slice(0, 4)
    ? formatShortDate(date)
    : fmt(date, "EEE d MMM yyyy");
}

export function formatDayTitle(date: ISODate, today: ISODate): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return fmt(date, "EEEE");
}

export function formatRangeLabel({ start, end }: DateRange): string {
  const [sy, sm, sd] = start.split("-").map(Number) as [number, number, number];
  const endIsMonthEnd = addDays(end, 1).endsWith("-01");
  const spansQuarter =
    sd === 1 &&
    endIsMonthEnd &&
    (sm - 1) % 3 === 0 &&
    start.slice(0, 4) === end.slice(0, 4) &&
    Number(end.slice(5, 7)) === sm + 2;
  if (spansQuarter) return `${fmt(start, "MMM")} – ${fmt(end, "MMM yyyy")} (Q${(sm - 1) / 3 + 1})`;
  if (start === `${sy}-01-01` && end === `${sy}-12-31`) return `${sy}`;
  if (start === end) return formatShortDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (sameMonth) return `${fmt(start, "EEE d")} – ${formatShortDate(end)}`;
  if (sameYear) return `${formatShortDate(start)} – ${formatShortDate(end)}`;
  return `${fmt(start, "d MMM yyyy")} – ${fmt(end, "d MMM yyyy")}`;
}

export function formatTimeZoneLabel(tz: string, now: Date = new Date()): string {
  const offset = formatInTimeZone(now, tz, "xxx");
  const sign = offset.startsWith("-") ? "−" : "+";
  const [h, m] = offset.slice(1).split(":") as [string, string];
  const pretty = offset === "+00:00" ? "UTC" : `UTC${sign}${Number(h)}${m === "00" ? "" : `:${m}`}`;
  return `${tz} (${pretty})`;
}
