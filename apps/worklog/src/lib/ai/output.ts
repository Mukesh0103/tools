/**
 * Every generator, including the plain fallback, writes plain text in one shape:
 *   **Heading**          ← a heading on its own line
 *   – bullet             ← en dash bullets
 *   Free prose lines
 * Sections are separated by blank lines. This module renders and flattens that shape.
 */

const HEADING = /^\*\*(.+?)\*\*:?\s*$/;
const BULLET = /^[–-]\s+/;

export function isHeadingLine(line: string): boolean {
  return HEADING.test(line.trim());
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function outputToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const heading = HEADING.exec(line.trim());
      return heading ? `<strong>${escapeHtml(heading[1]!)}</strong>` : escapeHtml(line);
    })
    .join("\n");
}

export function outputToPlainText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const heading = HEADING.exec(line.trim());
      return heading ? heading[1]! : line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function outputPreview(text: string, max = 110): string {
  const parts: string[] = [];
  let current: { heading?: string; items: string[] } = { items: [] };
  const flush = () => {
    if (!current.items.length) return;
    parts.push(
      current.heading ? `${current.heading}: ${current.items.join(", ")}` : current.items.join(" "),
    );
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      current = { heading: heading[1], items: [] };
    } else {
      current.items.push(line.replace(BULLET, ""));
    }
  }
  flush();
  const flat = parts.join(". ").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function countWords(text: string): number {
  return outputToPlainText(text)
    .split(/\s+/)
    .filter((w) => w && !/^[–-]$/.test(w)).length;
}

export function sectionHeadings(text: string): string[] {
  return text
    .split("\n")
    .map((l) => HEADING.exec(l.trim())?.[1])
    .filter((h): h is string => Boolean(h));
}
