import { describe, expect, it } from "vitest";
import {
  normalizeJiraSite,
  parseJiraTime,
  toJiraActivities,
  type JiraChangelog,
  type JiraIssue,
} from "@/lib/integrations/jira";

const ME = "acc-me";
const SITE = "https://acme.atlassian.net";

const issue: JiraIssue = {
  id: "10001",
  key: "PAY-7",
  fields: {
    summary: "Retry failed payouts",
    status: { id: "3", name: "In Review", statusCategory: { key: "indeterminate" } },
  },
};

function move(to: string, name: string, created: string | number, accountId = ME) {
  return {
    author: { accountId },
    created,
    items: [{ field: "status", fieldId: "status", to, toString: name }],
  };
}

function map(changeHistories: JiraChangelog["changeHistories"], over: Partial<JiraIssue> = {}) {
  return toJiraActivities({
    siteUrl: SITE,
    accountId: ME,
    issues: [{ ...issue, ...over }],
    changelogs: [{ issueId: "10001", changeHistories }],
    range: { start: "2026-10-05", end: "2026-10-05" },
    tz: "UTC",
  });
}

describe("normalizeJiraSite", () => {
  it("accepts a name, a host or a pasted URL", () => {
    expect(normalizeJiraSite("acme")).toBe(SITE);
    expect(normalizeJiraSite(" acme.atlassian.net ")).toBe(SITE);
    expect(
      normalizeJiraSite("https://ACME.atlassian.net/jira/software/projects/PAY/boards/1"),
    ).toBe(SITE);
  });
  it("only allows Atlassian Cloud hosts, since the token is sent there", () => {
    expect(normalizeJiraSite("jira.internal.example.com")).toBeNull();
    expect(normalizeJiraSite("http://169.254.169.254")).toBeNull();
    expect(normalizeJiraSite("acme.atlassian.net.evil.com")).toBeNull();
    expect(normalizeJiraSite("")).toBeNull();
  });
});

describe("parseJiraTime", () => {
  it("reads Jira's offsets without a colon", () => {
    expect(parseJiraTime("2026-10-05T10:15:30.123+0530")?.toISOString()).toBe(
      "2026-10-05T04:45:30.123Z",
    );
  });
  it("reads epoch seconds and milliseconds", () => {
    expect(parseJiraTime(1_791_200_000)?.toISOString()).toBe("2026-10-05T11:33:20.000Z");
    expect(parseJiraTime(1_791_200_000_000)?.toISOString()).toBe("2026-10-05T11:33:20.000Z");
  });
  it("returns null for garbage", () => {
    expect(parseJiraTime("not a date")).toBeNull();
  });
});

describe("toJiraActivities", () => {
  it("logs the last status you moved an issue to each day", () => {
    const activities = map([
      move("2", "In Progress", "2026-10-05T09:00:00.000+0000"),
      move("3", "In Review", "2026-10-05T16:00:00.000+0000"),
    ]);
    expect(activities).toEqual([
      {
        source: "jira",
        externalId: "jira:acme.atlassian.net:PAY-7:3:2026-10-05",
        occurredAt: new Date("2026-10-05T16:00:00Z"),
        date: "2026-10-05",
        text: "Moved PAY-7 to In Review: Retry failed payouts",
        url: "https://acme.atlassian.net/browse/PAY-7",
      },
    ]);
  });

  it("says Completed when the issue lands in a done status", () => {
    const done = map([move("5", "Shipped", "2026-10-05T16:00:00.000+0000")], {
      fields: {
        summary: "Retry failed payouts",
        status: { id: "5", name: "Shipped", statusCategory: { key: "done" } },
      },
    });
    expect(done[0]!.text).toBe("Completed PAY-7: Retry failed payouts");
    // Status since moved on: fall back to the name.
    expect(map([move("6", "Done", "2026-10-05T16:00:00.000+0000")])[0]!.text).toBe(
      "Completed PAY-7: Retry failed payouts",
    );
  });

  it("ignores other people's moves, other fields and other days", () => {
    expect(
      map([
        move("3", "In Review", "2026-10-05T09:00:00.000+0000", "someone-else"),
        move("3", "In Review", "2026-10-04T09:00:00.000+0000"),
        {
          author: { accountId: ME },
          created: "2026-10-05T09:00:00.000+0000",
          items: [{ field: "assignee", fieldId: "assignee", to: "x", toString: "Ada" }],
        },
      ]),
    ).toEqual([]);
  });

  it("names the status safely when Jira leaves it out", () => {
    const activities = map([
      {
        author: { accountId: ME },
        created: "2026-10-05T09:00:00.000+0000",
        items: [{ fieldId: "status", to: "2" }],
      },
    ]);
    expect(activities[0]!.text).toBe("Moved PAY-7 to a new status: Retry failed payouts");
  });
});
