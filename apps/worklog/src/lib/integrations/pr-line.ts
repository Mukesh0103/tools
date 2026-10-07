/**
 * The one-line format for GitHub pull request entries:
 *
 *   Merged - PAY-7 - Add Okta SSO #128
 *   Opened - Add Okta SSO #128            no Jira connected, or no ticket key on the PR
 *
 * Status, then the Jira issue key, then the PR title and number. The UI colours the
 * status (Opened green, Merged purple, Closed red). Pure, so client and server share it.
 */

export const PR_STATUSES = ["Opened", "Merged", "Closed"] as const;
export const REVIEW_STATUSES = ["Approved", "Changes requested", "Reviewed"] as const;

export type PullRequestStatus = (typeof PR_STATUSES)[number];
export type LineStatus = PullRequestStatus | (typeof REVIEW_STATUSES)[number];

const SEPARATOR = " - ";

/** Everything around the title, so an AI summary can take the title's place. */
export function pullRequestLineParts(
  status: LineStatus,
  issueKey: string | null,
  number: number,
): { prefix: string; suffix: string } {
  return {
    prefix: `${status}${SEPARATOR}${issueKey ? `${issueKey}${SEPARATOR}` : ""}`,
    suffix: ` #${number}`,
  };
}

const LEADING_STATUS = new RegExp(
  `^(${[...PR_STATUSES, ...REVIEW_STATUSES].join("|")})(?=${SEPARATOR})`,
);

/** Splits off the leading status word for colouring. Null when the line doesn't start with one. */
export function splitStatus(text: string): { status: LineStatus; rest: string } | null {
  const match = LEADING_STATUS.exec(text);
  if (!match) return null;
  return { status: match[1] as LineStatus, rest: text.slice(match[1]!.length) };
}

// Two or more letters/digits, a dash, a number: PAY-7, pay-7 in a branch name.
const KEY_CANDIDATE = /\b([A-Za-z][A-Za-z0-9_]+)-(\d+)\b/g;

/**
 * The first Jira issue key in the title, then the branch, then the description.
 * Only keys whose project exists in the user's Jira count, so "UTF-8" or
 * "SHA-256" in a description is never mistaken for a ticket.
 */
export function findIssueKey(
  sources: (string | null | undefined)[],
  projectKeys: ReadonlySet<string>,
): string | null {
  for (const source of sources) {
    if (!source) continue;
    for (const match of source.matchAll(KEY_CANDIDATE)) {
      const project = match[1]!.toUpperCase();
      if (projectKeys.has(project)) return `${project}-${match[2]}`;
    }
  }
  return null;
}

/** Removes the key from a title that already has it in its own column: "[PAY-7] Add SSO" → "Add SSO". */
export function stripIssueKey(title: string, key: string): string {
  const k = key.replace(/-/g, "\\-");
  const stripped = title
    .replace(new RegExp(`[\\[(]\\s*${k}\\s*[\\])]`, "gi"), "")
    .replace(new RegExp(`\\b${k}\\b\\s*[:|–-]?`, "gi"), " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:|–-]+|[\s:|–-]+$/g, "")
    .trim();
  return stripped || title;
}
