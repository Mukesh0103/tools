import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntryItem } from "@/components/entries/entry-item";
import type { EntryView } from "@/lib/entry-view";

function entry(over: Partial<EntryView>): EntryView {
  return {
    id: "3f0b8f5e-6a7c-4d5e-9f10-111213141516",
    entryDate: "2026-10-05",
    text: "Fixed pagination bug",
    isBlocker: false,
    createdAt: "2026-10-05T09:30:00.000Z",
    time: "09:30",
    source: "manual",
    externalId: null,
    url: null,
    ...over,
  };
}

const renderItem = (e: EntryView) =>
  render(<EntryItem entry={e} onUpdate={vi.fn()} onDelete={vi.fn()} />);

describe("EntryItem", () => {
  it.each([
    ["Opened", "text-pr-open"],
    ["Merged", "text-pr-merged"],
    ["Closed", "text-pr-closed"],
  ])("colours %s on an imported pull request and links to it", (status, colour) => {
    renderItem(
      entry({
        source: "github",
        text: `${status} - PAY-7 - Add Okta SSO #128`,
        url: "https://github.com/acme/web/pull/128",
      }),
    );
    expect(screen.getByText(status)).toHaveClass(colour);
    expect(screen.getByText(/- PAY-7 - Add Okta SSO #128/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/acme/web/pull/128",
    );
  });

  it("leaves review lines uncoloured", () => {
    renderItem(
      entry({
        source: "github",
        text: "Approved - Fix retry #45",
        url: "https://github.com/a/b/pull/45",
      }),
    );
    expect(screen.getByText("Approved")).not.toHaveClass(
      "text-pr-open",
      "text-pr-merged",
      "text-pr-closed",
    );
  });

  it("never colours a typed entry, even one that starts with a status word", () => {
    renderItem(entry({ text: "Merged - the hotfix by hand" }));
    expect(screen.getByText("Merged - the hotfix by hand")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
