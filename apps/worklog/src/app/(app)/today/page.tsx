import type { Metadata } from "next";
import { TodayView } from "@/components/entries/today-view";
import { requireUserId } from "@/lib/auth";
import { compareDates, isISODate, resolveTimeZone, todayInZone } from "@/lib/dates";
import { listEntriesForDay, listTopTags } from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { toEntryView } from "@/lib/entry-view";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const userId = await requireUserId();
  const [user, params] = await Promise.all([getUserWithSettings(userId), searchParams]);
  const tz = resolveTimeZone(user?.timezone);
  const today = todayInZone(tz);
  const date =
    isISODate(params.date) && compareDates(params.date, today) <= 0 ? params.date : today;

  const [rows, tags] = await Promise.all([listEntriesForDay(userId, date), listTopTags(userId)]);

  return (
    <TodayView
      key={date}
      date={date}
      today={today}
      entries={rows.map((r) => toEntryView(r, tz))}
      knownTags={tags}
    />
  );
}
