import { describe, expect, it } from "vitest";
import { buildFallback } from "@/lib/ai/fallback";
import { sectionHeadings } from "@/lib/ai/output";
import type { PromptInput } from "@/lib/ai/prompts";
import { inRange, loadFixture } from "@tests/fixtures/load";

function input(
  name: Parameters<typeof loadFixture>[0],
  range: { start: string; end: string },
  overrides: Partial<PromptInput> = {},
): PromptInput {
  const f = loadFixture(name);
  return {
    entries: inRange(f.entries, range),
    range,
    today: f.today,
    tone: "concise",
    format: "ytb",
    ...overrides,
  };
}

describe("plain standup", () => {
  const range = { start: "2026-09-28", end: "2026-09-29" };

  it("lists entries as written under Yesterday, Today and Blockers", () => {
    const text = buildFallback("standup", input("typical-week", range));
    expect(sectionHeadings(text)).toEqual(["Yesterday", "Today", "Blockers"]);
    expect(text).toBe(
      [
        "**Yesterday**",
        "– Wrote RFC draft for usage-based pricing",
        "– Paired with Ravi on flaky checkout tests",
        "– Shipped CSV export for invoice reports",
        "",
        "**Today**",
        "– Sprint planning, picked up three tickets",
        "– Fixed pagination bug in the invoices API",
        "– Reviewed Anu’s PR for the export queue",
        "",
        "**Blockers**",
        "– Waiting on staging DB credentials from infra",
      ].join("\n"),
    );
  });

  it("says None rather than inventing a blocker", () => {
    expect(buildFallback("standup", input("no-blockers", range))).toMatch(
      /\*\*Blockers\*\*\n– None$/,
    );
  });

  it("handles a Monday with nothing logged yet", () => {
    const text = buildFallback(
      "standup",
      input("monday-after-weekend", { start: "2026-09-25", end: "2026-09-28" }),
    );
    expect(text).toContain("**Today**\n– Nothing logged yet today");
    expect(text).toContain("**Blockers**\n– Waiting on legal review of the new refund policy copy");
  });

  it("supports the bullets and paragraph formats", () => {
    const bullets = buildFallback("standup", input("no-blockers", range, { format: "bullets" }));
    expect(bullets.split("\n").every((l) => l.startsWith("– "))).toBe(true);
    expect(bullets).toContain("– Blocker: none");
    const paragraph = buildFallback(
      "standup",
      input("typical-week", range, { format: "paragraph" }),
    );
    expect(paragraph).not.toContain("\n");
    expect(paragraph).toMatch(
      /^Yesterday: .+ Today: .+ Blocked on: Waiting on staging DB credentials from infra\.$/,
    );
  });
});

describe("plain weekly and appraisal", () => {
  const week = { start: "2026-09-23", end: "2026-09-29" };

  it("groups the week by first tag, largest group first", () => {
    const text = buildFallback("weekly", input("typical-week", week));
    expect(sectionHeadings(text)).toEqual(["Billing", "Infra", "Planning", "Reviews"]);
    expect(text).toContain(
      "– Blocked: CI runners out of disk, builds queued for 2 hours (Fri 25 Sep)",
    );
  });

  it("fills the four appraisal sections and leaves placeholders instead of inventing impact", () => {
    const text = buildFallback(
      "appraisal",
      input("typical-week", { start: "2026-07-01", end: "2026-09-30" }),
    );
    expect(sectionHeadings(text)).toEqual(["Accomplishments", "Impact", "Skills", "Collaboration"]);
    expect(text).toContain("– [Add the outcome: tickets closed, time saved, customers unblocked]");
    expect(text).toContain("– Paired with Ravi on flaky checkout tests (28 Sep)");
    expect(text).toContain("– Shipped CSV export for invoice reports (28 Sep)");
    expect(text).not.toContain("Waiting on staging DB credentials");
  });
});
