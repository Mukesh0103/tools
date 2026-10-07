import { isCronAuthorized } from "@/lib/cron";
import { addDays, resolveTimeZone, todayInZone } from "@/lib/dates";
import { listUsersWithIntegrations } from "@/lib/db/queries/integrations";
import { syncUserActivity } from "@/lib/integrations/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stop starting new users once this much of maxDuration is used, so the response still goes out. */
const TIME_BUDGET_MS = 45_000;
const CONCURRENCY = 3;

/**
 * GET /api/cron/sync imports yesterday's and today's GitHub and Jira activity for
 * everyone who has connected an integration. Call it hourly with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const users = await listUsersWithIntegrations();
  let next = 0;
  let synced = 0;
  let imported = 0;
  let failed = 0;

  const worker = async () => {
    while (next < users.length && Date.now() - started < TIME_BUDGET_MS) {
      const { userId, timezone, aiSummaries } = users[next++]!;
      const tz = resolveTimeZone(timezone);
      const today = todayInZone(tz);
      const result = await syncUserActivity(userId, {
        range: { start: addDays(today, -1), end: today },
        tz,
        aiSummaries,
      });
      synced++;
      imported += result.imported;
      failed += result.providers.filter((p) => p.status === "error").length;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, users.length) }, worker));

  return Response.json({ users: users.length, synced, imported, failed });
}
