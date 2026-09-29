import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntryInput } from "@/components/entries/entry-input";

function setup(onSubmit = vi.fn().mockResolvedValue({ ok: true }), knownTags: string[] = []) {
  const user = userEvent.setup();
  render(<EntryInput onSubmit={onSubmit} knownTags={knownTags} />);
  const input = screen.getByRole("combobox", { name: "New entry" }) as HTMLInputElement;
  return { user, input, onSubmit };
}

describe("EntryInput", () => {
  it("is focused on load", () => {
    const { input } = setup();
    expect(input).toHaveFocus();
  });

  it("saves on Enter, clears, and keeps focus", async () => {
    const { user, input, onSubmit } = setup();
    await user.type(input, "  Fixed pagination bug #billing  {Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Fixed pagination bug #billing");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("ignores Enter on an empty line", async () => {
    const { user, input, onSubmit } = setup();
    await user.type(input, "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks for words when the line is only tags", async () => {
    const { user, input, onSubmit } = setup();
    await user.type(input, "#billing !blocker{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Add a few words besides tags.");
    expect(input).toHaveValue("#billing !blocker");
  });

  it("brings the text back with a Retry when saving fails", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Couldn't save. Your text is still here." })
      .mockResolvedValueOnce({ ok: true });
    const { user, input } = setup(onSubmit);
    await user.type(input, "Fixed flaky checkout tests #infra{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save. Your text is still here.",
    );
    expect(input).toHaveValue("Fixed flaky checkout tests #infra");
    expect(input).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onSubmit).toHaveBeenLastCalledWith("Fixed flaky checkout tests #infra");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(input).toHaveValue("");
  });

  it("clears the draft on Escape, then blurs on a second Escape", async () => {
    const { user, input } = setup();
    await user.type(input, "Half a thought");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    await user.keyboard("{Escape}");
    expect(input).not.toHaveFocus();
  });

  it("suggests known tags and accepts one with Tab", async () => {
    const { user, input } = setup(undefined, ["#infra", "#invoices", "#billing"]);
    await user.type(input, "Fixed flaky tests #in");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["#infraTab", "#invoices", "Create “#in”"]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Tab}");
    expect(input).toHaveValue("Fixed flaky tests #invoices ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes suggestions on Escape without clearing the draft", async () => {
    const { user, input } = setup(undefined, ["#infra"]);
    await user.type(input, "Fixed #in");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Fixed #in");
  });
});
