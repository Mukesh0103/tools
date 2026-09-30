import { describe, expect, it } from "vitest";
import { parseEntry, serializeEntry } from "@/lib/parse-entry";

describe("parseEntry", () => {
  it("flags blockers with !blocker or !blocked, any case", () => {
    expect(parseEntry("Waiting on DB creds !blocker")).toEqual({
      text: "Waiting on DB creds",
      isBlocker: true,
    });
    expect(parseEntry("Stuck on review !BLOCKED")).toEqual({
      text: "Stuck on review",
      isBlocker: true,
    });
  });

  it("keeps hashtags as plain text", () => {
    expect(parseEntry("Fixed #1234 in checkout #billing")).toEqual({
      text: "Fixed #1234 in checkout #billing",
      isBlocker: false,
    });
  });

  it("collapses whitespace and leaves empty text when only !blocker is given", () => {
    expect(parseEntry("   !blocker  ")).toEqual({ text: "", isBlocker: true });
    expect(parseEntry("a   b\t c").text).toBe("a b c");
  });

  it("does not treat a bare ! as syntax", () => {
    expect(parseEntry("C# and F# work ! done")).toEqual({
      text: "C# and F# work ! done",
      isBlocker: false,
    });
  });
});

describe("serializeEntry", () => {
  it("round-trips through parseEntry", () => {
    const raw = "Waiting on staging DB credentials !blocker";
    expect(serializeEntry(parseEntry(raw))).toBe(raw);
    expect(parseEntry(serializeEntry(parseEntry(raw)))).toEqual(parseEntry(raw));
  });
});
