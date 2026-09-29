import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { listDueReminders, markReminded } from "@/lib/db/queries/reminders";
import { sendReminderEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  );
}

/**
 * GET /api/cron/reminders sends the daily "log your day" nudge.
 * Call it hourly with `Authorization: Bearer $CRON_SECRET`, from Vercel Cron or
 * the GitHub Actions workflow. Each user gets at most one email per local day.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const due = await listDueReminders(new Date());
  let sent = 0;
  const failed: string[] = [];

  for (const candidate of due) {
    try {
      await sendReminderEmail(candidate);
      await markReminded(candidate.userId, candidate.localDate);
      sent++;
    } catch (error) {
      failed.push(candidate.userId);
      Sentry.captureException(error, { tags: { area: "reminders" } });
      console.error("[reminders] send failed", candidate.userId, error);
    }
  }

  return Response.json({ due: due.length, sent, failed: failed.length });
}
