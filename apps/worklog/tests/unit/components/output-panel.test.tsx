import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { copyOutput } from "@/components/generate/output-format";
import { OutputPanel, type OutputPanelHandle } from "@/components/generate/output-panel";

const TEXT = "**Yesterday**\n– Shipped CSV export\n\n**Blockers**\n– None";

describe("OutputPanel", () => {
  it("renders headings in bold and shows a cursor while streaming, read-only", () => {
    render(<OutputPanel text={TEXT} streaming version={1} label="Generated standup, editable" />);
    const box = screen.getByRole("textbox", { name: "Generated standup, editable" });
    expect(box.querySelector("strong")?.textContent).toBe("Yesterday");
    expect(box).toHaveAttribute("contenteditable", "false");
    expect(box).toHaveAttribute("aria-busy", "true");
    expect(box.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("becomes editable when streaming ends and keeps the user's edits", () => {
    const ref = createRef<OutputPanelHandle>();
    const { rerender } = render(
      <OutputPanel ref={ref} text={TEXT} streaming={false} version={1} label="Output" />,
    );
    const box = screen.getByRole("textbox");
    expect(box).toHaveAttribute("contenteditable", "true");
    expect(ref.current?.getText()).toBe(TEXT);

    // Simulate an edit, then a parent re-render with the same generation.
    act(() => {
      box.innerHTML = "<strong>Yesterday</strong>\n– Shipped CSV export for invoices";
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    rerender(<OutputPanel ref={ref} text={TEXT} streaming={false} version={1} label="Output" />);
    expect(ref.current?.isEdited()).toBe(true);
    expect(ref.current?.getText()).toBe("**Yesterday**\n– Shipped CSV export for invoices");

    // A new generation replaces the edits.
    rerender(
      <OutputPanel
        ref={ref}
        text={"**Today**\n– New"}
        streaming={false}
        version={2}
        label="Output"
      />,
    );
    expect(ref.current?.isEdited()).toBe(false);
    expect(ref.current?.getText()).toBe("**Today**\n– New");
  });

  it("reads back lines the browser split into divs while editing", () => {
    const ref = createRef<OutputPanelHandle>();
    render(<OutputPanel ref={ref} text="" streaming={false} version={1} label="Output" />);
    const box = screen.getByRole("textbox");
    act(() => {
      box.innerHTML = "<strong>Today</strong><div>– One</div><div>– Two<br></div>";
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(ref.current?.getText()).toBe("**Today**\n– One\n– Two");
  });
});

describe("copyOutput", () => {
  it("falls back to plain text where rich clipboard writes aren't available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await copyOutput(TEXT);
    expect(writeText).toHaveBeenCalledWith("Yesterday\n– Shipped CSV export\n\nBlockers\n– None");
  });
});
