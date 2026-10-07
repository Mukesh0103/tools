/**
 * The common shape GitHub and Jira activity is mapped into before it becomes an
 * entry. Mappers are pure functions of the API responses, so they're unit-tested
 * without a network.
 *
 * External ids are stable and say what happened, so re-syncing never duplicates:
 *   github:pr:acme/web#12:merged      also :opened and :closed (closed without merging)
 *   github:review:acme/web#45:2026-10-05      one per pull request per day
 *   jira:acme.atlassian.net:PROJ-7:10001:2026-10-05   one per issue, status and day
 */
import { rangeBoundsUtc, todayInZone, type DateRange, type ISODate } from "@/lib/dates";
import { MAX_ENTRY_LENGTH } from "@/lib/validators";
import type { IntegrationProviderId } from "./types";

export type PullRequestDetails = {
  repo: string;
  number: number;
  title: string;
  body: string;
  merged: boolean;
  commits: string[];
  files: { path: string; additions: number; deletions: number }[];
  additions: number;
  deletions: number;
};

export type Activity = {
  source: IntegrationProviderId;
  externalId: string;
  occurredAt: Date;
  /** The calendar day it belongs to, in the user's zone. */
  date: ISODate;
  /** The entry text, built without AI. */
  text: string;
  url: string;
  /** The user's own pull requests: sync can put an AI summary between `prefix` and `suffix`. */
  summarize?: {
    prefix: string;
    suffix: string;
    /** The Jira key already in `prefix`, so it can be dropped if the summary repeats it. */
    issueKey: string | null;
    details: PullRequestDetails;
  };
};

/** Raised for problems the user can act on. The message is shown in Settings as is. */
export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "unavailable",
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

/** The instants a day range covers in `tz` ([start, end)), plus a helper that places an instant on a day. */
export function activityWindow(range: DateRange, tz: string) {
  const bounds = rangeBoundsUtc(range, tz);
  return {
    ...bounds,
    /** The local day of `instant`, or null when it falls outside the range. */
    dayOf(instant: string | number | Date | null | undefined): { at: Date; date: ISODate } | null {
      if (instant === null || instant === undefined) return null;
      const at = instant instanceof Date ? instant : new Date(instant);
      if (Number.isNaN(at.getTime())) return null;
      if (at < bounds.start || at >= bounds.end) return null;
      const date = todayInZone(tz, at);
      return date < range.start || date > range.end ? null : { at, date };
    },
  };
}

// "feat(api)!: add x" → type "feat", description "add x"
const CONVENTIONAL = /^([a-z]+)(\([^)]*\))?!?:\s+/i;
// Kept as a verb because dropping it changes the meaning: "fix: crash on login".
const KEEP_AS_VERB: Record<string, string> = { fix: "Fix", revert: "Revert" };

/**
 * Turns a pull request or commit title into an entry phrase, release-please style:
 * the conventional-commit prefix goes, and fixes and reverts keep their verb.
 *   "feat(auth): add Okta SSO"     → "Add Okta SSO"
 *   "fix: crash when cart is empty" → "Fix crash when cart is empty"
 */
export function cleanTitle(title: string): string {
  const raw = title.replace(/\s+/g, " ").trim();
  const match = CONVENTIONAL.exec(raw);
  let text = match ? raw.slice(match[0].length) : raw;
  const verb = match ? KEEP_AS_VERB[match[1]!.toLowerCase()] : undefined;
  if (verb && !text.toLowerCase().startsWith(verb.toLowerCase())) text = `${verb} ${text}`;
  text = text.replace(/[.\s]+$/, "");
  if (!text) return raw;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function clip(text: string, max = MAX_ENTRY_LENGTH): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
