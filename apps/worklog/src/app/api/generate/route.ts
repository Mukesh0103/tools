import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { AiUnavailableError, createGenerationJob, toPromptEntry } from "@/lib/ai/pipeline";
import { currentUserId } from "@/lib/auth";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { listEntriesInRange } from "@/lib/db/queries/entries";
import { insertGeneration } from "@/lib/db/queries/generations";
import { getUserWithSettings } from "@/lib/db/queries/users";
import { checkGenerationLimit } from "@/lib/rate-limit";
import { generateRequestSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leaves room for the per-month pass on long appraisal ranges.
export const maxDuration = 60;

export type GenerateErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "EMPTY_RANGE"
  | "AI_UNAVAILABLE"
  | "AI_FAILED";

function fail(status: number, code: GenerateErrorCode, message: string, headers?: HeadersInit) {
  return Response.json({ code, message }, { status, headers });
}

/**
 * POST /api/generate → streams plain text.
 * Response headers carry the saved generation id, the entry count, the prompt version and the model.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Sign in to generate.");

  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { type, range, tone, mode } = parsed.data;

  if (mode === "ai") {
    const limit = await checkGenerationLimit(userId);
    if (!limit.ok) {
      return fail(429, "RATE_LIMITED", "You've hit the generation limit. Try again a bit later.", {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }
  }

  const user = await getUserWithSettings(userId);
  if (!user) return fail(401, "UNAUTHORIZED", "Sign in to generate.");
  const tz = resolveTimeZone(user.timezone);

  const rows = await listEntriesInRange(userId, range);
  if (rows.length === 0) return fail(422, "EMPTY_RANGE", "No entries in this range.");

  const job = createGenerationJob({
    type,
    range,
    tone,
    mode,
    format: parsed.data.format ?? user.settings.standupFormat,
    today: todayInZone(tz),
    entries: rows.map((e) => toPromptEntry(e, tz)),
  });

  const iterator = job.stream(request.signal);

  // Wait for the first chunk before committing to a 200, so configuration and
  // provider errors become a clean JSON error the UI can offer a fallback for.
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return fail(
        503,
        "AI_UNAVAILABLE",
        "AI generation isn't set up. Use the plain format instead.",
      );
    }
    console.error("[generate] provider error", error);
    Sentry.captureException(error, { tags: { area: "generate", type } });
    return fail(502, "AI_FAILED", "Couldn't reach the writing model.");
  }

  const id = randomUUID();
  let output = first.done ? "" : first.value;
  let sentFirst = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!sentFirst) {
          sentFirst = true;
          if (!first.done) {
            controller.enqueue(encoder.encode(first.value));
            return;
          }
        } else {
          const next = await iterator.next();
          if (!next.done) {
            output += next.value;
            controller.enqueue(encoder.encode(next.value));
            return;
          }
        }
        // Finished: save the output unless the client walked away.
        if (!request.signal.aborted && output.trim()) {
          await insertGeneration({
            id,
            userId,
            type,
            rangeStart: range.start,
            rangeEnd: range.end,
            output: output.trim(),
            promptVersion: job.promptVersion,
            model: job.model,
          });
        }
        controller.close();
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[generate] stream error", error);
          Sentry.captureException(error, { tags: { area: "generate", type } });
        }
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Generation-Id": id,
      "X-Entry-Count": String(rows.length),
      "X-Prompt-Version": job.promptVersion,
      "X-Model": job.model,
    },
  });
}
