import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { copyOutput } from "@/components/generate/output-format";
import { OutputPanel, type OutputPanelHandle } from "@/components/generate/output-panel";

const TEXT = "**Yesterday**\n– Shipped CSV export\n\n**Blockers**\n– None";

describe("OutputPanel", () => {
  it("renders headings in bold, editable in place", () => {
    render(<OutputPanel text={TEXT} version={1} label="Generated standup, editable" />);
    const box = screen.getByRole("textbox", { name: "Generated standup, editable" });
    expect(box.querySelector("strong")?.textContent).toBe("Yesterday");
    expect(box).toHaveAttribute("contenteditable", "true");
  });

  it("keeps the user's edits until a new generation replaces them", () => {
    const ref = createRef<OutputPanelHandle>();
    const { rerender } = render(<OutputPanel ref={ref} text={TEXT} version={1} label="Output" />);
    const box = screen.getByRole("textbox");
    expect(box).toHaveAttribute("contenteditable", "true");
    expect(ref.current?.getText()).toBe(TEXT);

    act(() => {
      box.innerHTML = "<strong>Yesterday</strong>\n– Shipped CSV export for invoices";
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    rerender(<OutputPanel ref={ref} text={TEXT} version={1} label="Output" />);
    expect(ref.current?.isEdited()).toBe(true);
    expect(ref.current?.getText()).toBe("**Yesterday**\n– Shipped CSV export for invoices");

    rerender(<OutputPanel ref={ref} text={"**Today**\n– New"} version={2} label="Output" />);
    expect(ref.current?.isEdited()).toBe(false);
    expect(ref.current?.getText()).toBe("**Today**\n– New");
  });

  it("reads back lines the browser split into divs while editing", () => {
    const ref = createRef<OutputPanelHandle>();
    render(<OutputPanel ref={ref} text="" version={1} label="Output" />);
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
