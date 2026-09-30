/**
 * Turns one typed line into an entry.
 *   "Waiting on DB creds !blocker"   → text "Waiting on DB creds", isBlocker true
 */
export type ParsedEntry = { text: string; isBlocker: boolean };

const BLOCKER = /^!(blocker|blocked)([.,;:)]*)$/i;

export function parseEntry(raw: string): ParsedEntry {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const rest: string[] = [];
  let isBlocker = false;

  for (const word of words) {
    if (BLOCKER.test(word)) {
      isBlocker = true;
      continue;
    }
    rest.push(word);
  }

  return { text: rest.join(" "), isBlocker };
}

export function serializeEntry(entry: { text: string; isBlocker: boolean }): string {
  return [entry.text, entry.isBlocker ? "!blocker" : ""].filter(Boolean).join(" ");
}
