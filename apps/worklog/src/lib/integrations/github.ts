import "server-only";
import type { DateRange } from "@/lib/dates";
import {
  activityWindow,
  cleanTitle,
  IntegrationError,
  type Activity,
  type PullRequestDetails,
} from "./activity";
import {
  findIssueKey,
  pullRequestLineParts,
  stripIssueKey,
  type LineStatus,
  type PullRequestStatus,
} from "./pr-line";

/**
 * GitHub activity through the GraphQL API, with a personal access token.
 *   - Pull requests you opened, merged or closed in the range
 *   - Reviews you submitted on other people's pull requests
 * Lines follow lib/integrations/pr-line.ts: "Merged - PAY-7 - Add Okta SSO #128".
 * A fine-grained token needs read access to "Pull requests" on the repos you work in.
 * A classic token needs the `repo` scope (or `public_repo` for public work only).
 */

const ENDPOINT = "https://api.github.com/graphql";
const PAGE_SIZE = 50;
const MAX_PAGES = 3;

type Page<T> = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: (T | null)[];
};

export type AuthoredPullRequest = {
  number: number;
  title: string;
  url: string;
  body: string;
  headRefName: string;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  repository: { nameWithOwner: string };
  commits: { nodes: ({ commit: { messageHeadline: string } } | null)[] };
  files: { nodes: ({ path: string; additions: number; deletions: number } | null)[] } | null;
};

export type ReviewedPullRequest = {
  number: number;
  title: string;
  url: string;
  body: string;
  headRefName: string;
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  reviews: { nodes: ({ state: string; submittedAt: string | null } | null)[] } | null;
};

const AUTHORED_QUERY = `
query AuthoredPullRequests($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title url body headRefName createdAt mergedAt closedAt additions deletions
        repository { nameWithOwner }
        commits(first: 30) { nodes { commit { messageHeadline } } }
        files(first: 40) { nodes { path additions deletions } }
      }
    }
  }
}`;

const REVIEWED_QUERY = `
query ReviewedPullRequests($q: String!, $after: String, $login: String!) {
  search(query: $q, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title url body headRefName
        author { login }
        repository { nameWithOwner }
        reviews(first: 50, author: $login) { nodes { state submittedAt } }
      }
    }
  }
}`;

async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "worklog",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new IntegrationError("Couldn't reach GitHub. Try again in a few minutes.", "unavailable");
  }
  if (res.status === 401) {
    throw new IntegrationError("GitHub rejected the token. Connect again with a new one.", "auth");
  }
  if (!res.ok) {
    throw new IntegrationError(
      `GitHub returned an error (${res.status}). Try again later.`,
      "unavailable",
    );
  }
  const body = (await res.json()) as { data?: T | null; errors?: { message: string }[] };
  // Partial errors (an org that enforces SAML, a deleted repo) still return the rest of the data.
  if (!body.data) {
    throw new IntegrationError(
      body.errors?.[0]?.message ?? "GitHub returned no data.",
      "unavailable",
    );
  }
  return body.data;
}

async function searchAll<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: { search: Page<T> } = await graphql(token, query, { ...variables, after });
    out.push(...data.search.nodes.filter((n): n is T => Boolean(n && Object.keys(n).length)));
    if (!data.search.pageInfo.hasNextPage) break;
    after = data.search.pageInfo.endCursor;
  }
  return out;
}

export async function verifyGitHubToken(
  token: string,
): Promise<{ login: string; name: string | null }> {
  const data = await graphql<{ viewer: { login: string; name: string | null } }>(
    token,
    "query { viewer { login name } }",
    {},
  );
  return data.viewer;
}

/** GitHub search takes ISO timestamps with an explicit offset. */
function searchTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export async function fetchGitHubActivity(opts: {
  token: string;
  login: string;
  range: DateRange;
  tz: string;
  /** Project keys in the user's Jira, to pick out ticket keys. Null when Jira isn't connected. */
  jiraProjects: ReadonlySet<string> | null;
}): Promise<Activity[]> {
  const { start, end } = activityWindow(opts.range, opts.tz);
  const span = `${searchTime(start)}..${searchTime(new Date(end.getTime() - 1000))}`;
  const user = opts.login;
  const [created, closed, reviewed] = await Promise.all([
    searchAll<AuthoredPullRequest>(opts.token, AUTHORED_QUERY, {
      q: `is:pr author:${user} created:${span}`,
    }),
    // Merging closes a pull request, so this finds merged and closed-unmerged alike.
    searchAll<AuthoredPullRequest>(opts.token, AUTHORED_QUERY, {
      q: `is:pr author:${user} closed:${span}`,
    }),
    // `updated` has no upper bound: a later push or comment must not hide a review from the range.
    searchAll<ReviewedPullRequest>(opts.token, REVIEWED_QUERY, {
      q: `is:pr reviewed-by:${user} -author:${user} updated:>=${searchTime(start)}`,
      login: user,
    }),
  ]);
  return toGitHubActivities({
    authored: [...created, ...closed],
    reviewed,
    login: user,
    range: opts.range,
    tz: opts.tz,
    jiraProjects: opts.jiraProjects,
  });
}

function cleanBody(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function details(pr: AuthoredPullRequest, merged: boolean): PullRequestDetails {
  return {
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    title: pr.title,
    body: cleanBody(pr.body ?? ""),
    merged,
    commits: pr.commits.nodes
      .map((n) => n?.commit.messageHeadline ?? "")
      .filter((m) => m && !/^Merge (branch|pull request|remote-tracking)/.test(m)),
    files: (pr.files?.nodes ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f)),
    additions: pr.additions,
    deletions: pr.deletions,
  };
}

const REVIEW_RANK: Record<string, number> = { APPROVED: 3, CHANGES_REQUESTED: 2 };
const REVIEW_STATUS: Record<string, LineStatus> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

/** The Jira key the PR names (title, then branch, then description), and the title without it. */
function keyAndTitle(
  pr: { title: string; headRefName: string; body: string },
  jiraProjects: ReadonlySet<string> | null | undefined,
): { key: string | null; title: string } {
  const key = jiraProjects ? findIssueKey([pr.title, pr.headRefName, pr.body], jiraProjects) : null;
  return { key, title: cleanTitle(key ? stripIssueKey(pr.title, key) : pr.title) };
}

/** Maps search results to activities. Pure: no network, no clock. */
export function toGitHubActivities(input: {
  authored: AuthoredPullRequest[];
  reviewed: ReviewedPullRequest[];
  login: string;
  range: DateRange;
  tz: string;
  jiraProjects?: ReadonlySet<string> | null;
}): Activity[] {
  const window = activityWindow(input.range, input.tz);
  const activities: Activity[] = [];

  const authored = new Map(input.authored.map((pr) => [pr.url, pr]));
  for (const pr of authored.values()) {
    const id = `github:pr:${pr.repository.nameWithOwner}#${pr.number}`;
    const { key, title } = keyAndTitle(pr, input.jiraProjects);
    const merged = window.dayOf(pr.mergedAt);
    const closed = pr.mergedAt ? null : window.dayOf(pr.closedAt);
    const opened = window.dayOf(pr.createdAt);
    const add = (status: PullRequestStatus, when: { at: Date; date: string }) => {
      const { prefix, suffix } = pullRequestLineParts(status, key, pr.number);
      activities.push({
        source: "github",
        externalId: `${id}:${status.toLowerCase()}`,
        occurredAt: when.at,
        date: when.date,
        text: prefix + title + suffix,
        url: pr.url,
        summarize: { prefix, suffix, issueKey: key, details: details(pr, status === "Merged") },
      });
    };
    if (merged) add("Merged", merged);
    if (closed) add("Closed", closed);
    // Opened and finished on the same day is one piece of work, so only the outcome is logged.
    const finished = merged ?? closed;
    if (opened && opened.date !== finished?.date) add("Opened", opened);
  }

  const login = input.login.toLowerCase();
  const reviewed = new Map(input.reviewed.map((pr) => [pr.url, pr]));
  for (const pr of reviewed.values()) {
    if (pr.author?.login.toLowerCase() === login) continue;
    const byDay = new Map<string, { at: Date; state: string }>();
    for (const review of pr.reviews?.nodes ?? []) {
      const when = window.dayOf(review?.submittedAt);
      if (!review || !when) continue;
      const seen = byDay.get(when.date);
      const rank = REVIEW_RANK[review.state] ?? 1;
      byDay.set(when.date, {
        at: !seen || when.at > seen.at ? when.at : seen.at,
        state: !seen || rank > (REVIEW_RANK[seen.state] ?? 1) ? review.state : seen.state,
      });
    }
    const { key, title } = keyAndTitle(pr, input.jiraProjects);
    for (const [date, { at, state }] of byDay) {
      const { prefix, suffix } = pullRequestLineParts(
        REVIEW_STATUS[state] ?? "Reviewed",
        key,
        pr.number,
      );
      activities.push({
        source: "github",
        externalId: `github:review:${pr.repository.nameWithOwner}#${pr.number}:${date}`,
        occurredAt: at,
        date,
        text: prefix + title + suffix,
        url: pr.url,
      });
    }
  }

  return activities.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
