import { randomUUID } from "node:crypto";
import { currentUserId } from "@/lib/auth";
import { listEntriesInRange } from "@/lib/db/queries/entries";
import { insertGeneration } from "@/lib/db/queries/generations";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { buildOutput, toOutputEntry } from "@/lib/generate/plain";
import { generateRequestSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type GenerateErrorCode = "UNAUTHORIZED" | "INVALID_REQUEST" | "EMPTY_RANGE";

export type GenerateResult = { id: string; output: string; entryCount: number };

function fail(status: number, code: GenerateErrorCode, message: string) {
  return Response.json({ code, message }, { status });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Sign in to generate.");

  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { type, range } = parsed.data;

  const user = await getUserWithSettings(userId);
  if (!user) return fail(401, "UNAUTHORIZED", "Sign in to generate.");

  const rows = await listEntriesInRange(userId, range);
  if (rows.length === 0) return fail(422, "EMPTY_RANGE", "No entries in this range.");

  const output = buildOutput(type, {
    entries: rows.map(toOutputEntry),
    range,
    format: parsed.data.format ?? user.settings.standupFormat,
  });
  const row = await insertGeneration({
    id: randomUUID(),
    userId,
    type,
    rangeStart: range.start,
    rangeEnd: range.end,
    output,
  });

  const result: GenerateResult = { id: row.id, output, entryCount: rows.length };
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
