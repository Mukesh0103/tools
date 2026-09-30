import { escapeHtml, outputToHtml, outputToPlainText } from "@/lib/generate/output";

export function domToOutput(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node, isFirstBlock: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.getAttribute("aria-hidden") === "true") return;
    const tag = node.tagName;
    if (tag === "BR") {
      out += "\n";
      return;
    }
    if (tag === "STRONG" || tag === "B") {
      const text = node.textContent ?? "";
      out += text.trim() ? `**${text.trim()}**` : text;
      return;
    }
    const block = tag === "DIV" || tag === "P";
    if (block && !isFirstBlock && !out.endsWith("\n")) out += "\n";
    node.childNodes.forEach((child, i) => walk(child, i === 0));
  };
  root.childNodes.forEach((child, i) => walk(child, i === 0));
  return out
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clipboardPayload(text: string): { html: string; plain: string } {
  const plain = outputToPlainText(text);
  const html = outputToHtml(text).split("\n").join("<br>");
  return { html: `<div>${html}</div>`, plain };
}

export async function copyOutput(text: string): Promise<void> {
  const { html, plain } = clipboardPayload(text);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return;
    }
  } catch {
    // Some browsers refuse rich writes, so fall back to plain text.
  }
  await navigator.clipboard.writeText(plain);
}

export { escapeHtml, outputToHtml };
