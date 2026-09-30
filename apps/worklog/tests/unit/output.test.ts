import { describe, expect, it } from "vitest";
import {
  countWords,
  outputPreview,
  outputToHtml,
  outputToPlainText,
  sectionHeadings,
} from "@/lib/generate/output";
import { clipboardPayload } from "@/components/generate/output-format";

const sample =
  "**Yesterday**\n– Shipped CSV export\n– Paired with Ravi\n\n**Today**\n– Fixed <b>pagination</b>\n\n**Blockers**\n– None";

describe("output shape", () => {
  it("renders headings as <strong> and escapes everything else", () => {
    const html = outputToHtml(sample);
    expect(html).toContain("<strong>Yesterday</strong>");
    expect(html).toContain("– Fixed &lt;b&gt;pagination&lt;/b&gt;");
    expect(outputToHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("drops heading markers for plain text", () => {
    expect(outputToPlainText(sample).split("\n")[0]).toBe("Yesterday");
    expect(outputToPlainText(sample)).not.toContain("**");
  });

  it("builds a one-line preview for History", () => {
    expect(outputPreview(sample, 200)).toBe(
      "Yesterday: Shipped CSV export, Paired with Ravi. Today: Fixed <b>pagination</b>. Blockers: None",
    );
    expect(outputPreview(sample, 30)).toHaveLength(30);
    expect(outputPreview(sample, 30).endsWith("…")).toBe(true);
  });

  it("counts words without bullets and lists headings", () => {
    expect(countWords("**Today**\n– Fixed the bug")).toBe(4);
    expect(sectionHeadings(sample)).toEqual(["Yesterday", "Today", "Blockers"]);
  });

  it("puts rich and plain versions on the clipboard", () => {
    const { html, plain } = clipboardPayload("**Today**\n– Shipped");
    expect(html).toBe("<div><strong>Today</strong><br>– Shipped</div>");
    expect(plain).toBe("Today\n– Shipped");
  });
});
