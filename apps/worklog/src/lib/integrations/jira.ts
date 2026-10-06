import "server-only";
import { addDays, type DateRange } from "@/lib/dates";
import { activityWindow, IntegrationError, type Activity } from "./activity";

/**
 * Jira Cloud activity through the REST API v3, with an Atlassian API token:
 * every issue you moved to another status in the range. One entry per issue,
 * status and day, so "In Progress" in the morning and "Done" in the afternoon
 * are both logged.
 */

const SEARCH_PAGES = 3;
const CHANGELOG_PAGES = 5;
const DONE_NAME = /\b(done|closed|resolved|complete[d]?|released|shipped)\b/i;

export type JiraCredentials = { siteUrl: string; email: string; token: string };

export type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    status?: { id: string; name: string; statusCategory?: { key: string } };
  };
};

export type JiraChangelog = {
  issueId: string;
  changeHistories: {
    author?: { accountId?: string };
    /** Documented as a date-time string; some responses send epoch seconds or milliseconds. */
    created: string | number;
    /** `toString` is the new status name. Typed unknown: a JSON object without it inherits Object.prototype.toString. */
    items: { field?: string; fieldId?: string; to?: string | null; toString?: unknown }[];
  }[];
};

/**
 * Accepts "acme", "acme.atlassian.net" or a pasted Jira URL. Only Atlassian Cloud
 * hosts are allowed: the server sends the token to this address.
 */
export function normalizeJiraSite(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw))
    raw = raw.includes(".") ? `https://${raw}` : `https://${raw}.atlassian.net`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.(atlassian\.net|jira\.com)$/.test(host)) return null;
  return `https://${host}`;
}

async function jira<T>(creds: JiraCredentials, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${creds.siteUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.email}:${creds.token}`).toString("base64")}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new IntegrationError("Couldn't reach Jira. Check the site address.", "unavailable");
  }
  if (res.status === 401 || res.status === 403) {
    throw new IntegrationError(
      "Jira rejected the email and API token. Connect again with a new token.",
      "auth",
    );
  }
  if (res.status === 404) {
    throw new IntegrationError("That Jira site wasn't found. Check the address.", "unavailable");
  }
  if (!res.ok) {
    throw new IntegrationError(
      `Jira returned an error (${res.status}). Try again later.`,
      "unavailable",
    );
  }
  return (await res.json()) as T;
}

export async function verifyJira(
  creds: JiraCredentials,
): Promise<{ accountId: string; displayName: string }> {
  const me = await jira<{ accountId: string; displayName?: string }>(creds, "/rest/api/3/myself");
  return { accountId: me.accountId, displayName: me.displayName || creds.email };
}

function jqlDate(date: string): string {
  return date.replace(/-/g, "/");
}

export async function fetchJiraActivity(opts: {
  creds: JiraCredentials;
  accountId: string;
  range: DateRange;
  tz: string;
}): Promise<Activity[]> {
  // JQL dates use the Jira profile's zone, so ask for a day either side and
  // filter on exact changelog timestamps below.
  const from = jqlDate(addDays(opts.range.start, -1));
  const to = jqlDate(addDays(opts.range.end, 2));
  const jql = `status CHANGED BY currentUser() DURING ("${from}", "${to}") ORDER BY updated DESC`;

  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < SEARCH_PAGES; page++) {
    const res = await jira<{ issues?: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>(
      opts.creds,
      "/rest/api/3/search/jql",
      {
        jql,
        fields: ["summary", "status"],
        maxResults: 100,
        ...(nextPageToken ? { nextPageToken } : {}),
      },
    );
    issues.push(...(res.issues ?? []));
    nextPageToken = res.nextPageToken;
    if (!nextPageToken || res.isLast) break;
  }
  if (issues.length === 0) return [];

  const changelogs: JiraChangelog[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < CHANGELOG_PAGES; page++) {
    const res = await jira<{ issueChangeLogs?: JiraChangelog[]; nextPageToken?: string }>(
      opts.creds,
      "/rest/api/3/changelog/bulkfetch",
      {
        issueIdsOrKeys: issues.map((i) => i.id),
        fieldIds: ["status"],
        maxResults: 1000,
        ...(cursor ? { nextPageToken: cursor } : {}),
      },
    );
    changelogs.push(...(res.issueChangeLogs ?? []));
    cursor = res.nextPageToken;
    if (!cursor) break;
  }

  return toJiraActivities({
    siteUrl: opts.creds.siteUrl,
    accountId: opts.accountId,
    issues,
    changelogs,
    range: opts.range,
    tz: opts.tz,
  });
}

/** Jira writes offsets as "+0530"; Date only parses "+05:30". */
export function parseJiraTime(value: string | number): Date | null {
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value);
  const d = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Maps search results and changelogs to activities. Pure: no network, no clock. */
export function toJiraActivities(input: {
  siteUrl: string;
  accountId: string;
  issues: JiraIssue[];
  changelogs: JiraChangelog[];
  range: DateRange;
  tz: string;
}): Activity[] {
  const window = activityWindow(input.range, input.tz);
  const host = new URL(input.siteUrl).host;
  const issuesById = new Map(input.issues.map((i) => [i.id, i]));
  const activities: Activity[] = [];

  for (const log of input.changelogs) {
    const issue = issuesById.get(log.issueId);
    if (!issue) continue;
    // The last move you made on each day: To Do → In Progress → In Review in one day logs "In Review".
    const lastByDay = new Map<string, { at: Date; to: string; name: string }>();
    for (const history of log.changeHistories) {
      if (history.author?.accountId !== input.accountId) continue;
      const parsed = parseJiraTime(history.created);
      const when = window.dayOf(parsed);
      if (!when) continue;
      for (const item of history.items) {
        if ((item.fieldId ?? item.field) !== "status" || !item.to) continue;
        // A JSON object without its own "toString" would hand back Object.prototype.toString.
        const name = typeof item.toString === "string" ? item.toString : "a new status";
        const seen = lastByDay.get(when.date);
        if (!seen || when.at >= seen.at)
          lastByDay.set(when.date, { at: when.at, to: item.to, name });
      }
    }

    const summary = issue.fields.summary?.trim() || "Untitled issue";
    for (const [date, move] of lastByDay) {
      const current = issue.fields.status;
      const done =
        current?.id === move.to
          ? current.statusCategory?.key === "done"
          : DONE_NAME.test(move.name);
      activities.push({
        source: "jira",
        externalId: `jira:${host}:${issue.key}:${move.to}:${date}`,
        occurredAt: move.at,
        date,
        text: done
          ? `Completed ${issue.key}: ${summary}`
          : `Moved ${issue.key} to ${move.name}: ${summary}`,
        url: `${input.siteUrl}/browse/${encodeURIComponent(issue.key)}`,
      });
    }
  }

  return activities.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
