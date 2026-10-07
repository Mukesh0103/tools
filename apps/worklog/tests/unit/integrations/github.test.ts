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
    headRefName: "okta-sso",
    createdAt: "2026-10-05T09:00:00Z",
    mergedAt: null,
    closedAt: null,
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
    body: "",
    headRefName: "double-charge",
    author: { login: "ravi" },
    repository: { nameWithOwner: "acme/api" },
    reviews: { nodes: [] },
    ...over,
  };
}

const monday = { start: "2026-10-05", end: "2026-10-05" };
const JIRA = new Set(["PAY", "WEB"]);

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

const texts = (input: Partial<Parameters<typeof toGitHubActivities>[0]>) =>
  map(input).map((a) => a.text);

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

describe("toGitHubActivities: your pull requests", () => {
  it("writes Status - Title #number, and logs a same-day open and merge once, as merged", () => {
    const merged = "2026-10-05T15:00:00Z";
    const activities = map({ authored: [authored({ mergedAt: merged, closedAt: merged })] });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      source: "github",
      externalId: "github:pr:acme/web#12:merged",
      date: "2026-10-05",
      text: "Merged - Add Okta SSO #12",
      url: "https://github.com/acme/web/pull/12",
    });
    expect(activities[0]!.summarize).toMatchObject({
      prefix: "Merged - ",
      suffix: " #12",
      issueKey: null,
      details: { merged: true, body: "Adds SSO.", commits: ["Add Okta client"] },
    });
  });

  it("logs a pull request closed without merging as Closed", () => {
    const pr = authored({ createdAt: "2026-10-01T09:00:00Z", closedAt: "2026-10-05T12:00:00Z" });
    expect(map({ authored: [pr] })).toEqual([
      expect.objectContaining({
        externalId: "github:pr:acme/web#12:closed",
        text: "Closed - Add Okta SSO #12",
      }),
    ]);
  });

  it("logs a same-day open and close once, as closed", () => {
    expect(texts({ authored: [authored({ closedAt: "2026-10-05T17:00:00Z" })] })).toEqual([
      "Closed - Add Okta SSO #12",
    ]);
  });

  it("logs opened and merged separately when they fall on different days", () => {
    const at = "2026-10-05T11:00:00Z";
    const pr = authored({ createdAt: "2026-10-04T10:00:00Z", mergedAt: at, closedAt: at });
    const activities = map({
      authored: [pr, pr],
      range: { start: "2026-10-04", end: "2026-10-05" },
    });
    expect(activities.map((a) => [a.date, a.text])).toEqual([
      ["2026-10-04", "Opened - Add Okta SSO #12"],
      ["2026-10-05", "Merged - Add Okta SSO #12"],
    ]);
  });

  it("only logs what happened inside the range", () => {
    const at = "2026-10-05T11:00:00Z";
    const pr = authored({ createdAt: "2026-10-04T10:00:00Z", mergedAt: at, closedAt: at });
    expect(texts({ authored: [pr], range: { start: "2026-10-04", end: "2026-10-04" } })).toEqual([
      "Opened - Add Okta SSO #12",
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
    ).toEqual([expect.objectContaining({ date: "2026-10-06", text: "Opened - Add Okta SSO #12" })]);
  });
});

describe("toGitHubActivities: Jira keys", () => {
  it("puts the key in its own column and takes it out of the title", () => {
    const pr = authored({ title: "[PAY-7] feat: add Okta SSO" });
    expect(texts({ authored: [pr], jiraProjects: JIRA })).toEqual([
      "Opened - PAY-7 - Add Okta SSO #12",
    ]);
    expect(map({ authored: [pr], jiraProjects: JIRA })[0]!.summarize?.issueKey).toBe("PAY-7");
  });

  it("finds the key in the branch, then the description", () => {
    expect(
      texts({ authored: [authored({ headRefName: "feature/pay-7-okta" })], jiraProjects: JIRA }),
    ).toEqual(["Opened - PAY-7 - Add Okta SSO #12"]);
    expect(texts({ authored: [authored({ body: "Closes WEB-31." })], jiraProjects: JIRA })).toEqual(
      ["Opened - WEB-31 - Add Okta SSO #12"],
    );
  });

  it("ignores look-alikes that aren't projects in your Jira", () => {
    const pr = authored({ body: "Hash with SHA-256, encode as UTF-8" });
    expect(texts({ authored: [pr], jiraProjects: JIRA })).toEqual(["Opened - Add Okta SSO #12"]);
  });

  it("leaves the key out when Jira isn't connected", () => {
    const pr = authored({ title: "PAY-7: add Okta SSO" });
    expect(texts({ authored: [pr], jiraProjects: null })).toEqual([
      "Opened - PAY-7: add Okta SSO #12",
    ]);
  });
});

describe("toGitHubActivities: reviews", () => {
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
      text: "Approved - Fix double charge on retry #45",
      occurredAt: new Date("2026-10-05T17:00:00Z"),
    });
    expect(activity!.summarize).toBeUndefined();
  });

  it("words change requests and plain comments, with the Jira key when there is one", () => {
    const at = "2026-10-05T09:00:00Z";
    expect(
      texts({
        reviewed: [
          reviewed({
            headRefName: "PAY-9-double-charge",
            reviews: { nodes: [{ state: "CHANGES_REQUESTED", submittedAt: at }] },
          }),
        ],
        jiraProjects: JIRA,
      }),
    ).toEqual(["Changes requested - PAY-9 - Fix double charge on retry #45"]);
    expect(
      texts({
        reviewed: [reviewed({ reviews: { nodes: [{ state: "COMMENTED", submittedAt: at }] } })],
      }),
    ).toEqual(["Reviewed - Fix double charge on retry #45"]);
  });

  it("ignores reviews on your own pull requests", () => {
    const own = reviewed({
      author: { login: "Ada" },
      reviews: { nodes: [{ state: "COMMENTED", submittedAt: "2026-10-05T09:00:00Z" }] },
    });
    expect(map({ reviewed: [own] })).toEqual([]);
  });
});
