import { describe, expect, it } from "vitest";
import { cleanTitle, clip } from "@/lib/integrations/activity";
import {
  toGitHubActivities,
  type AuthoredPullRequest,
  type ReviewedPullRequest,
} from "@/lib/integrations/github";

function authored(over: Partial<AuthoredPullRequest> = {}): AuthoredPullRequest {
  return {
    number: 12,
    title: "feat(auth): add Okta SSO",
    url: "https://github.com/acme/web/pull/12",
    body: "<!-- template -->\nAdds SSO.",
    createdAt: "2026-10-05T09:00:00Z",
    mergedAt: null,
    additions: 120,
    deletions: 8,
    repository: { nameWithOwner: "acme/web" },
    commits: {
      nodes: [
        { commit: { messageHeadline: "Add Okta client" } },
        { commit: { messageHeadline: "Merge branch 'main' into sso" } },
      ],
    },
    files: { nodes: [{ path: "src/auth/okta.ts", additions: 100, deletions: 0 }] },
    ...over,
  };
}

function reviewed(over: Partial<ReviewedPullRequest> = {}): ReviewedPullRequest {
  return {
    number: 45,
    title: "fix: double charge on retry",
    url: "https://github.com/acme/api/pull/45",
    author: { login: "ravi" },
    repository: { nameWithOwner: "acme/api" },
    reviews: { nodes: [] },
    ...over,
  };
}

const monday = { start: "2026-10-05", end: "2026-10-05" };

function map(input: Partial<Parameters<typeof toGitHubActivities>[0]>) {
  return toGitHubActivities({
    authored: [],
    reviewed: [],
    login: "ada",
    range: monday,
    tz: "UTC",
    ...input,
  });
}

describe("cleanTitle", () => {
  it("drops conventional-commit prefixes, release-please style", () => {
    expect(cleanTitle("feat(auth): add Okta SSO")).toBe("Add Okta SSO");
    expect(cleanTitle("chore!: drop Node 20.")).toBe("Drop Node 20");
  });
  it("keeps the verb where dropping it changes the meaning", () => {
    expect(cleanTitle("fix: crash when the cart is empty")).toBe(
      "Fix crash when the cart is empty",
    );
    expect(cleanTitle("fix(api): fix timeout")).toBe("Fix timeout");
    expect(cleanTitle("revert: add Okta SSO")).toBe("Revert add Okta SSO");
  });
  it("leaves ordinary titles alone", () => {
    expect(cleanTitle("Improve   search ranking")).toBe("Improve search ranking");
    expect(cleanTitle("PROJ-12: tidy up")).toBe("PROJ-12: tidy up");
  });
  it("clips to the entry length limit", () => {
    expect(clip("x".repeat(600))).toHaveLength(500);
    expect(clip("short")).toBe("short");
  });
});

describe("toGitHubActivities", () => {
  it("logs a pull request opened and merged on the same day once, as merged", () => {
    const activities = map({ authored: [authored({ mergedAt: "2026-10-05T15:00:00Z" })] });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      source: "github",
      externalId: "github:pr:acme/web#12:merged",
      date: "2026-10-05",
      text: "Merged web#12: Add Okta SSO",
      url: "https://github.com/acme/web/pull/12",
    });
    expect(activities[0]!.summarize?.prefix).toBe("Merged web#12: ");
    expect(activities[0]!.summarize?.details).toMatchObject({
      merged: true,
      body: "Adds SSO.",
      commits: ["Add Okta client"],
    });
  });

  it("logs opened and merged separately when they fall on different days", () => {
    const pr = authored({ createdAt: "2026-10-04T10:00:00Z", mergedAt: "2026-10-05T11:00:00Z" });
    const activities = map({
      authored: [pr, pr],
      range: { start: "2026-10-04", end: "2026-10-05" },
    });
    expect(activities.map((a) => [a.date, a.externalId])).toEqual([
      ["2026-10-04", "github:pr:acme/web#12:opened"],
      ["2026-10-05", "github:pr:acme/web#12:merged"],
    ]);
  });

  it("only logs what happened inside the range", () => {
    const pr = authored({ createdAt: "2026-10-04T10:00:00Z", mergedAt: "2026-10-05T11:00:00Z" });
    expect(map({ authored: [pr], range: { start: "2026-10-04", end: "2026-10-04" } })).toEqual([
      expect.objectContaining({ externalId: "github:pr:acme/web#12:opened" }),
    ]);
  });

  it("files work under the day it happened in the user's zone", () => {
    // 20:00 UTC on Monday is 01:30 on Tuesday in Kolkata.
    const pr = authored({ createdAt: "2026-10-05T20:00:00Z" });
    expect(map({ authored: [pr], tz: "Asia/Kolkata" })).toEqual([]);
    expect(
      map({
        authored: [pr],
        tz: "Asia/Kolkata",
        range: { start: "2026-10-06", end: "2026-10-06" },
      }),
    ).toEqual([
      expect.objectContaining({ date: "2026-10-06", text: "Opened web#12: Add Okta SSO" }),
    ]);
  });

  it("collapses a day's reviews on one pull request into its strongest outcome", () => {
    const pr = reviewed({
      reviews: {
        nodes: [
          { state: "COMMENTED", submittedAt: "2026-10-05T09:00:00Z" },
          { state: "APPROVED", submittedAt: "2026-10-05T16:00:00Z" },
          { state: "COMMENTED", submittedAt: "2026-10-05T17:00:00Z" },
          { state: "PENDING", submittedAt: null },
          { state: "CHANGES_REQUESTED", submittedAt: "2026-10-03T09:00:00Z" },
        ],
      },
    });
    const [activity, ...rest] = map({ reviewed: [pr] });
    expect(rest).toEqual([]);
    expect(activity).toMatchObject({
      externalId: "github:review:acme/api#45:2026-10-05",
      text: "Approved api#45: Fix double charge on retry",
      occurredAt: new Date("2026-10-05T17:00:00Z"),
    });
    expect(activity!.summarize).toBeUndefined();
  });

  it("words change requests and plain comments", () => {
    const at = "2026-10-05T09:00:00Z";
    const requested = map({
      reviewed: [
        reviewed({ reviews: { nodes: [{ state: "CHANGES_REQUESTED", submittedAt: at }] } }),
      ],
    });
    const commented = map({
      reviewed: [reviewed({ reviews: { nodes: [{ state: "COMMENTED", submittedAt: at }] } })],
    });
    expect(requested[0]!.text).toBe("Requested changes on api#45: Fix double charge on retry");
    expect(commented[0]!.text).toBe("Reviewed api#45: Fix double charge on retry");
  });

  it("ignores reviews on your own pull requests", () => {
    const own = reviewed({
      author: { login: "Ada" },
      reviews: { nodes: [{ state: "COMMENTED", submittedAt: "2026-10-05T09:00:00Z" }] },
    });
    expect(map({ reviewed: [own] })).toEqual([]);
  });
});
