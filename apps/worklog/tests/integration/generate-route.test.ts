import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateResult } from "@/app/api/generate/route";
import { getGeneration, listGenerations } from "@/lib/db/queries/generations";
import { createUser, seedEntries } from "./helpers";

let currentUser: string | null = null;
vi.mock("@/lib/auth", () => ({ currentUserId: async () => currentUser }));

const { POST } = await import("@/app/api/generate/route");

beforeEach(async () => {
  const user = await createUser({ timezone: "UTC" });
  currentUser = user.id;
  const today = new Date().toISOString().slice(0, 10);
  await seedEntries(user.id, [
    { entryDate: today, text: "Fixed pagination bug in the invoices API" },
    {
      entryDate: today,
      text: "Waiting on staging DB credentials",
      isBlocker: true,
    },
  ]);
});

function post(body: unknown) {
  const today = new Date().toISOString().slice(0, 10);
  return POST(
    new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "standup",
        range: { start: today, end: today },
        ...(body as object),
      }),
    }),
  );
}

describe("POST /api/generate", () => {
  it("builds the plain standup from the entries and saves it", async () => {
    const res = await post({});

    expect(res.status).toBe(200);
    const result = (await res.json()) as GenerateResult;
    expect(result.entryCount).toBe(2);
    expect(result.output).toBe(
      "**Yesterday**\n– Nothing logged\n\n**Today**\n– Fixed pagination bug in the invoices API\n\n**Blockers**\n– Waiting on staging DB credentials",
    );

    const saved = await getGeneration(currentUser!, result.id);
    expect(saved).toMatchObject({ type: "standup", output: result.output });
  });

  it("uses the requested standup format", async () => {
    const res = await post({ format: "bullets" });
    const result = (await res.json()) as GenerateResult;
    expect(result.output).toBe(
      "– Today: Fixed pagination bug in the invoices API\n– Blocker: Waiting on staging DB credentials",
    );
  });

  it("returns 422 EMPTY_RANGE when there's nothing to summarize, and saves nothing", async () => {
    const res = await post({ range: { start: "2020-01-01", end: "2020-01-07" } });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "EMPTY_RANGE" });
    expect(await listGenerations(currentUser!)).toHaveLength(0);
  });

  it("validates input and requires a session", async () => {
    expect((await post({ type: "novel" })).status).toBe(400);
    expect((await post({ range: { start: "2026-09-29", end: "2026-09-01" } })).status).toBe(400);
    currentUser = null;
    expect((await post({})).status).toBe(401);
  });
});
