import { currentUserId } from "@/lib/auth";
import { formatShortDate, resolveTimeZone, timeInZone } from "@/lib/dates";
import { listAllEntries } from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { serializeEntry } from "@/lib/parse-entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  // Quote everything, and defuse spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** GET /api/export?format=md|csv downloads every entry the user has logged. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "md";
  const [user, rows] = await Promise.all([getUserWithSettings(userId), listAllEntries(userId)]);
  const tz = resolveTimeZone(user?.timezone);
  const stamp = new Date().toISOString().slice(0, 10);

  let body: string;
  if (format === "csv") {
    const header = ["date", "time", "text", "tags", "blocker", "created_at"].map(csvCell).join(",");
    const lines = rows.map((e) =>
      [
        e.entryDate,
        timeInZone(e.createdAt, tz),
        e.text,
        e.tags.join(" "),
        e.isBlocker ? "yes" : "no",
        e.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
    body = [header, ...lines].join("\r\n");
  } else {
    const out: string[] = [
      "# Worklog export",
      "",
      `Exported ${stamp} · ${rows.length} entries · ${tz}`,
    ];
    let day = "";
    for (const e of rows) {
      if (e.entryDate !== day) {
        day = e.entryDate;
        out.push("", `## ${formatShortDate(day)} (${day})`, "");
      }
      out.push(`- ${timeInZone(e.createdAt, tz)} ${serializeEntry(e)}`);
    }
    body = `${out.join("\n")}\n`;
  }

  return new Response(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="worklog-${stamp}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
