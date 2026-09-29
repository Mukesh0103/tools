/**
 * Turns one typed line into an entry.
 *   "Fixed pagination bug #billing"  → text "Fixed pagination bug", tags ["#billing"]
 *   "Waiting on DB creds !blocker"   → isBlocker true
 * Purely numeric hashes ("fixed #1234") are issue references and stay in the text.
 */
export type ParsedEntry = { text: string; tags: string[]; isBlocker: boolean };

const TAG = /^#([\p{L}\p{N}][\p{L}\p{N}_-]*)([.,;:!?)]*)$/u;
const BLOCKER = /^!(blocker|blocked)([.,;:)]*)$/i;
const NUMERIC = /^\p{N}+$/u;

export const MAX_TAGS = 10;

export function parseEntry(raw: string): ParsedEntry {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const tags: string[] = [];
  const rest: string[] = [];
  let isBlocker = false;

  for (const word of words) {
    const tag = TAG.exec(word);
    if (tag && !NUMERIC.test(tag[1]!)) {
      const t = `#${tag[1]!.toLowerCase()}`;
      if (!tags.includes(t) && tags.length < MAX_TAGS) tags.push(t);
      continue;
    }
    if (BLOCKER.test(word)) {
      isBlocker = true;
      continue;
    }
    rest.push(word);
  }

  return { text: rest.join(" "), tags, isBlocker };
}

/** The inverse, for inline editing: puts tags and the blocker flag back into the line. */
export function serializeEntry(entry: {
  text: string;
  tags: string[];
  isBlocker: boolean;
}): string {
  return [entry.text, ...entry.tags, entry.isBlocker ? "!blocker" : ""].filter(Boolean).join(" ");
}

/**
 * The partial `#tag` under the caret, for autocomplete.
 * Returns the query without "#" and where the token starts, or null.
 */
export function tagQueryAt(value: string, caret: number): { query: string; start: number } | null {
  const before = value.slice(0, caret);
  const match = /(^|\s)#([\p{L}\p{N}_-]*)$/u.exec(before);
  if (!match) return null;
  const start = before.length - match[2]!.length - 1;
  return { query: match[2]!.toLowerCase(), start };
}
