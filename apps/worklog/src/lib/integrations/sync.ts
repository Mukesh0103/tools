import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { DateRange } from "@/lib/dates";
import {
  insertImportedEntries,
  knownExternalIds,
  listIntegrations,
  markSynced,
} from "@/lib/db/queries/integrations";
import type { Integration } from "@/lib/db/schema";
import { clip, IntegrationError, type Activity } from "./activity";
import { decryptSecret } from "./crypto";
import { fetchGitHubActivity } from "./github";
import { fetchJiraActivity, listProjectKeys, type JiraCredentials } from "./jira";
import { stripIssueKey } from "./pr-line";
import { aiSummariesAvailable, summarizePullRequest } from "./summarize";
import type { ProviderSyncResult, SyncResult } from "./types";

/** Automatic syncs (opening Today, the hourly cron) skip a provider synced more recently than this. */
export const AUTO_SYNC_INTERVAL_MS = 10 * 60_000;
/** Caps Claude calls per sync. Pull requests past the cap keep their cleaned-up title. */
export const MAX_SUMMARIES_PER_SYNC = 20;
const SUMMARY_CONCURRENCY = 4;

export type SyncOptions = {
  range: DateRange;
  tz: string;
  /** Sync even if the provider was synced within AUTO_SYNC_INTERVAL_MS. */
  force?: boolean;
  /** The user's "Summarise pull requests with AI" setting. */
  aiSummaries?: boolean;
  now?: Date;
};

/**
 * Pulls the user's GitHub and Jira activity for a range of days and saves what's
 * new as entries. Providers sync independently: one failing never blocks the other.
 */
export async function syncUserActivity(userId: string, opts: SyncOptions): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const connected = await listIntegrations(userId);
  // GitHub lines carry a Jira key only when Jira is connected. Loaded once, on first use.
  const jira = connected.find((i) => i.provider === "jira");
  let projects: Promise<ReadonlySet<string> | null> | undefined;
  const jiraProjects = () => (projects ??= jira ? loadJiraProjects(jira) : Promise.resolve(null));

  const providers = await Promise.all(
    connected.map((i) => syncOne(userId, i, opts, now, jiraProjects)),
  );
  return { imported: providers.reduce((n, p) => n + p.imported, 0), providers };
}

async function syncOne(
  userId: string,
  integration: Integration,
  opts: SyncOptions,
  now: Date,
  jiraProjects: () => Promise<ReadonlySet<string> | null>,
): Promise<ProviderSyncResult> {
  const { provider } = integration;
  const last = integration.lastSyncedAt?.getTime();
  if (!opts.force && last && now.getTime() - last < AUTO_SYNC_INTERVAL_MS) {
    return { provider, status: "skipped", imported: 0 };
  }

  try {
    const activities = await fetchActivity(integration, opts, jiraProjects);
    const known = await knownExternalIds(
      userId,
      activities.map((a) => a.externalId),
    );
    const fresh = activities.filter((a) => !known.has(a.externalId));
    const useAi = Boolean(opts.aiSummaries) && aiSummariesAvailable();
    const prepared = useAi ? await withSummaries(fresh) : fresh;
    const inserted = await insertImportedEntries(
      userId,
      prepared.map((a) => ({
        entryDate: a.date,
        text: clip(a.text),
        isBlocker: false,
        source: a.source,
        externalId: a.externalId,
        url: a.url,
        // The entry's time is when the work happened, not when it was imported.
        createdAt: a.occurredAt,
      })),
    );
    await markSynced(userId, provider, now, null);
    return { provider, status: "ok", imported: inserted.length };
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.message
        : "Couldn't sync. Try again in a few minutes.";
    if (!(error instanceof IntegrationError)) {
      console.error(`[sync] ${provider} failed`, error);
      Sentry.captureException(error, { tags: { area: "sync", provider } });
    }
    // Recording the attempt time stops automatic syncs from retrying a broken token every visit.
    await markSynced(userId, provider, now, message);
    return { provider, status: "error", imported: 0, error: message };
  }
}

function readToken(integration: Integration): string {
  try {
    return decryptSecret(integration.secret);
  } catch {
    throw new IntegrationError("The saved token can't be read any more. Connect again.", "auth");
  }
}

function jiraCredentials(integration: Integration): JiraCredentials {
  if (!integration.siteUrl || !integration.email) {
    throw new IntegrationError("The Jira connection is incomplete. Connect again.", "auth");
  }
  return {
    siteUrl: integration.siteUrl,
    apiUrl: integration.apiUrl,
    email: integration.email,
    token: readToken(integration),
  };
}

/** Null when Jira can't be read: GitHub lines then go without a key rather than failing. */
async function loadJiraProjects(jira: Integration): Promise<ReadonlySet<string> | null> {
  try {
    return await listProjectKeys(jiraCredentials(jira));
  } catch (error) {
    console.warn(
      "[sync] couldn't load Jira projects; pull request lines go without ticket keys",
      error,
    );
    return null;
  }
}

async function fetchActivity(
  integration: Integration,
  opts: SyncOptions,
  jiraProjects: () => Promise<ReadonlySet<string> | null>,
): Promise<Activity[]> {
  if (integration.provider === "github") {
    return fetchGitHubActivity({
      token: readToken(integration),
      login: integration.accountId,
      range: opts.range,
      tz: opts.tz,
      jiraProjects: await jiraProjects(),
    });
  }
  return fetchJiraActivity({
    creds: jiraCredentials(integration),
    accountId: integration.accountId,
    range: opts.range,
    tz: opts.tz,
  });
}

/** Rewrites pull request lines with Claude's summary. Merged work goes first, so it wins the cap. */
async function withSummaries(activities: Activity[]): Promise<Activity[]> {
  const candidates = activities
    .filter((a) => a.summarize)
    .sort((a, b) => Number(b.summarize!.details.merged) - Number(a.summarize!.details.merged))
    .slice(0, MAX_SUMMARIES_PER_SYNC);
  const summaries = new Map<string, string>();
  await forEachLimited(candidates, SUMMARY_CONCURRENCY, async (a) => {
    const { prefix, suffix, issueKey, details } = a.summarize!;
    const summary = await summarizePullRequest(details);
    // The key already has its own column; drop it if the summary repeats it.
    if (summary)
      summaries.set(
        a.externalId,
        prefix + (issueKey ? stripIssueKey(summary, issueKey) : summary) + suffix,
      );
  });
  return activities.map((a) => {
    const text = summaries.get(a.externalId);
    return text ? { ...a, text } : a;
  });
}

async function forEachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}
