import { currentUserId } from "@/lib/auth";
import { addDays, compareDates, resolveTimeZone, standupRange, todayInZone } from "@/lib/dates";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { syncUserActivity } from "@/lib/integrations/sync";
import type { SyncResult } from "@/lib/integrations/types";
import { syncRequestSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for a week's backfill with AI summaries.
export const maxDuration = 60;

/**
 * POST /api/sync imports the signed-in user's GitHub and Jira activity.
 *   {}                                   standup range, skipped if synced in the last 10 minutes
 *   { "force": true }                    the same, always
 *   { "range": { start, end }, ... }     specific days, e.g. the day open on Today
 *   { "days": 7, "force": true }         the last 7 days, used right after connecting
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ message: "Sign in to sync." }, { status: 401 });

  const parsed = syncRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const user = await getUserWithSettings(userId);
  if (!user) return Response.json({ message: "Sign in to sync." }, { status: 401 });
  const tz = resolveTimeZone(user.timezone);
  const today = todayInZone(tz);

  const { range: requested, days, force } = parsed.data;
  const range = requested
    ? {
        start: requested.start,
        end: compareDates(requested.end, today) > 0 ? today : requested.end,
      }
    : days
      ? { start: addDays(today, -(days - 1)), end: today }
      : standupRange(tz);
  if (compareDates(range.start, range.end) > 0) {
    return Response.json({ message: "Can't sync future days." }, { status: 400 });
  }

  const result: SyncResult = await syncUserActivity(userId, {
    range,
    tz,
    force,
    aiSummaries: user.settings.aiSummaries,
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
