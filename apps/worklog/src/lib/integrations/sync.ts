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
import { fetchJiraActivity } from "./jira";
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
  const providers = await Promise.all(connected.map((i) => syncOne(userId, i, opts, now)));
  return { imported: providers.reduce((n, p) => n + p.imported, 0), providers };
}

async function syncOne(
  userId: string,
  integration: Integration,
  opts: SyncOptions,
  now: Date,
): Promise<ProviderSyncResult> {
  const { provider } = integration;
  const last = integration.lastSyncedAt?.getTime();
  if (!opts.force && last && now.getTime() - last < AUTO_SYNC_INTERVAL_MS) {
    return { provider, status: "skipped", imported: 0 };
  }

  try {
    const activities = await fetchActivity(integration, opts);
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

async function fetchActivity(integration: Integration, opts: SyncOptions): Promise<Activity[]> {
  let token: string;
  try {
    token = decryptSecret(integration.secret);
  } catch {
    throw new IntegrationError("The saved token can't be read any more. Connect again.", "auth");
  }
  if (integration.provider === "github") {
    return fetchGitHubActivity({
      token,
      login: integration.accountId,
      range: opts.range,
      tz: opts.tz,
    });
  }
  if (!integration.siteUrl || !integration.email) {
    throw new IntegrationError("The Jira connection is incomplete. Connect again.", "auth");
  }
  return fetchJiraActivity({
    creds: { siteUrl: integration.siteUrl, email: integration.email, token },
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
    const summary = await summarizePullRequest(a.summarize!.details);
    if (summary) summaries.set(a.externalId, a.summarize!.prefix + summary);
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
