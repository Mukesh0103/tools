import type { Metadata } from "next";
import { Suspense } from "react";
import { TimelineView } from "@/components/entries/timeline-view";
import { requireUserId } from "@/lib/auth";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { TIMELINE_PAGE_SIZE, listTimeline } from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { toEntryView } from "@/lib/entry-view";

export const metadata: Metadata = { title: "Timeline" };

type Params = { q?: string; blockers?: string; more?: string; focus?: string };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<Params> }) {
  const userId = await requireUserId();
  const [user, params] = await Promise.all([getUserWithSettings(userId), searchParams]);
  const tz = resolveTimeZone(user?.timezone);

  const q = (params.q ?? "").slice(0, 100);
  const blockers = params.blockers === "1";
  const more = Math.min(Math.max(Number(params.more) || 0, 0), 9);

  const page = await listTimeline(userId, {
    q,
    blockersOnly: blockers,
    limit: TIMELINE_PAGE_SIZE * (more + 1),
  });

  return (
    <Suspense>
      <TimelineView
        entries={page.entries.map((e) => toEntryView(e, tz))}
        today={todayInZone(tz)}
        filters={{ q, blockers, more }}
        hasMore={page.hasMore}
        autoFocusSearch={params.focus === "search"}
      />
    </Suspense>
  );
}
