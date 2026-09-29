import type { Metadata } from "next";
import { Suspense } from "react";
import { TimelineView } from "@/components/entries/timeline-view";
import { requireUserId } from "@/lib/auth";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { TIMELINE_PAGE_SIZE, listTimeline, listTopTags } from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { toEntryView } from "@/lib/entry-view";

export const metadata: Metadata = { title: "Timeline" };

type Params = { q?: string; tag?: string; blockers?: string; more?: string; focus?: string };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<Params> }) {
  const userId = await requireUserId();
  const [user, params] = await Promise.all([getUserWithSettings(userId), searchParams]);
  const tz = resolveTimeZone(user?.timezone);

  const q = (params.q ?? "").slice(0, 100);
  const tag = params.tag?.startsWith("#") ? params.tag.toLowerCase().slice(0, 64) : null;
  const blockers = params.blockers === "1";
  const more = Math.min(Math.max(Number(params.more) || 0, 0), 9);

  const [page, tags] = await Promise.all([
    listTimeline(userId, {
      q,
      tag: tag ?? undefined,
      blockersOnly: blockers,
      limit: TIMELINE_PAGE_SIZE * (more + 1),
    }),
    listTopTags(userId, 8),
  ]);

  return (
    <Suspense>
      <TimelineView
        entries={page.entries.map((e) => toEntryView(e, tz))}
        tags={tag && !tags.includes(tag) ? [tag, ...tags] : tags}
        today={todayInZone(tz)}
        filters={{ q, tag, blockers, more }}
        hasMore={page.hasMore}
        autoFocusSearch={params.focus === "search"}
      />
    </Suspense>
  );
}
