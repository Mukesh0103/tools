import { describe, expect, it } from "vitest";
import { parseEntry, serializeEntry, tagQueryAt } from "@/lib/parse-entry";

describe("parseEntry", () => {
  it("pulls lowercase tags out of the text", () => {
    expect(parseEntry("Fixed pagination bug #Billing")).toEqual({
      text: "Fixed pagination bug",
      tags: ["#billing"],
      isBlocker: false,
    });
  });

  it("flags blockers with !blocker or !blocked, any case", () => {
    expect(parseEntry("Waiting on DB creds !blocker")).toMatchObject({
      text: "Waiting on DB creds",
      isBlocker: true,
    });
    expect(parseEntry("Stuck on review !BLOCKED")).toMatchObject({
      text: "Stuck on review",
      isBlocker: true,
    });
  });

  it("keeps purely numeric hashes as issue references", () => {
    expect(parseEntry("Fixed #1234 in checkout #billing")).toEqual({
      text: "Fixed #1234 in checkout",
      tags: ["#billing"],
      isBlocker: false,
    });
  });

  it("drops trailing punctuation from tags", () => {
    expect(parseEntry("Shipped export #billing.").tags).toEqual(["#billing"]);
    expect(parseEntry("Paired (#infra) today").tags).toEqual([]);
  });

  it("dedupes tags and keeps first-seen order", () => {
    expect(parseEntry("x #b #a #B #a").tags).toEqual(["#b", "#a"]);
  });

  it("supports unicode and dashes in tags", () => {
    expect(parseEntry("Réunion #équipe #q3-planning").tags).toEqual(["#équipe", "#q3-planning"]);
  });

  it("collapses whitespace and leaves empty text when only tags are given", () => {
    expect(parseEntry("   #billing   !blocker  ")).toEqual({
      text: "",
      tags: ["#billing"],
      isBlocker: true,
    });
    expect(parseEntry("a   b\t c").text).toBe("a b c");
  });

  it("does not treat a bare # or ! as syntax", () => {
    expect(parseEntry("C# and F# work ! done")).toEqual({
      text: "C# and F# work ! done",
      tags: [],
      isBlocker: false,
    });
  });
});

describe("serializeEntry", () => {
  it("round-trips through parseEntry", () => {
    const raw = "Waiting on staging DB credentials #billing !blocker";
    expect(serializeEntry(parseEntry(raw))).toBe(raw);
    expect(parseEntry(serializeEntry(parseEntry(raw)))).toEqual(parseEntry(raw));
  });
});

describe("tagQueryAt", () => {
  it("finds the partial tag under the caret", () => {
    const value = "Fixed flaky tests #in";
    expect(tagQueryAt(value, value.length)).toEqual({ query: "in", start: 18 });
  });

  it("matches a lone # so every tag can be suggested", () => {
    expect(tagQueryAt("Fixed #", 7)).toEqual({ query: "", start: 6 });
  });

  it("ignores hashes inside words and caret positions after a space", () => {
    expect(tagQueryAt("C#", 2)).toBeNull();
    expect(tagQueryAt("#infra ", 7)).toBeNull();
  });
});
