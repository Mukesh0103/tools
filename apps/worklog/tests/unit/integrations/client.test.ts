import { describe, expect, it } from "vitest";
import { describeSync, firstSyncError } from "@/lib/integrations/client";

describe("describeSync", () => {
  it("counts what was imported and from where", () => {
    expect(
      describeSync({
        imported: 3,
        providers: [
          { provider: "github", status: "ok", imported: 2 },
          { provider: "jira", status: "ok", imported: 1 },
        ],
      }),
    ).toEqual({ tone: "success", message: "Imported 3 entries from GitHub and Jira" });
  });

  it("reports the first failure when nothing came in", () => {
    const result = {
      imported: 0,
      providers: [
        { provider: "github" as const, status: "ok" as const, imported: 0 },
        { provider: "jira" as const, status: "error" as const, imported: 0, error: "Bad token." },
      ],
    };
    expect(describeSync(result)).toEqual({ tone: "error", message: "Jira: Bad token." });
    expect(firstSyncError(result)).toBe("Jira: Bad token.");
  });

  it("says when there's nothing new, and stays silent when every provider was skipped", () => {
    expect(
      describeSync({ imported: 0, providers: [{ provider: "github", status: "ok", imported: 0 }] }),
    ).toEqual({
      tone: "info",
      message: "Nothing new from GitHub",
    });
    expect(
      describeSync({
        imported: 0,
        providers: [{ provider: "github", status: "skipped", imported: 0 }],
      }),
    ).toBeNull();
  });
});
