import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeneratorPanel } from "@/components/generate/generator-panel";
import { defaultRanges, rangePresets } from "@/lib/range-presets";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
const saveGenerationEdit = vi.fn().mockResolvedValue({ ok: true, data: null });
vi.mock("@/server/actions/settings", () => ({
  saveGenerationEdit: (...a: unknown[]) => saveGenerationEdit(...a),
}));

const NOW = new Date("2026-09-29T09:00:00Z");

function streamResponse(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "X-Generation-Id": "3f0b8f5e-6a7c-4d5e-9f10-111213141516",
      "X-Entry-Count": "7",
      ...headers,
    },
  });
}

function renderPanel() {
  const user = userEvent.setup();
  render(
    <GeneratorPanel
      initialType="standup"
      defaultRanges={defaultRanges("UTC", NOW)}
      presets={rangePresets("UTC", NOW)}
      today="2026-09-29"
      defaultTone="concise"
      standupFormat="ytb"
      autoStart={false}
    />,
  );
  return { user };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GeneratorPanel", () => {
  it("posts the selected type, range and tone, then streams text into the editable panel", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        "**Yesterday**\n– Shipped",
        " CSV export\n\n**Today**\n– Fixed",
        " pagination",
      ]),
    );
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Generate/ }));

    const box = await screen.findByRole("textbox", { name: "Generated standup update, editable" });
    await waitFor(() => expect(box).toHaveAttribute("contenteditable", "true"));
    expect(box.textContent).toContain("Shipped CSV export");
    expect(box.querySelectorAll("strong")).toHaveLength(2);
    expect(screen.getByText("From 7 entries")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/generate");
    expect(JSON.parse(init.body)).toEqual({
      type: "standup",
      range: { start: "2026-09-28", end: "2026-09-29" },
      tone: "concise",
      format: "ytb",
      mode: "ai",
    });
  });

  it("switches type and tone before generating", async () => {
    fetchMock.mockResolvedValue(streamResponse(["**Billing**\nShipped export."]));
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Detailed" }));
    await user.click(screen.getByRole("button", { name: /Generate/ }));
    await screen.findByRole("textbox");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      type: "weekly",
      tone: "detailed",
      range: { start: "2026-09-23", end: "2026-09-29" },
    });
  });

  it("copies the output and shows Copied", async () => {
    fetchMock.mockResolvedValue(streamResponse(["**Today**\n– Fixed pagination"]));
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Generate/ }));
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "true"),
    );

    await user.click(screen.getAllByRole("button", { name: /^Copy/ })[0]!);
    // user-event installs its own clipboard stub, so read back through it.
    expect(await navigator.clipboard.readText()).toBe("Today\n– Fixed pagination");
    expect(screen.getAllByRole("button", { name: /Copied/ }).length).toBeGreaterThan(0);
    // Not edited, so no save.
    expect(saveGenerationEdit).not.toHaveBeenCalled();
  });

  it("shows the empty state when the range has no entries", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ code: "EMPTY_RANGE", message: "No entries" }, { status: 422 }),
    );
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Generate/ }));
    expect(await screen.findByText("No entries from Mon 28 – Tue 29 Sep")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log an entry" })).toHaveAttribute("href", "/today");
  });

  it("offers the plain format when generation fails, and requests it", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ code: "AI_FAILED", message: "down" }, { status: 502 }))
      .mockResolvedValueOnce(streamResponse(["**Yesterday**\n– Shipped CSV export"]));
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Generate/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t write your standup");
    await user.click(screen.getByRole("button", { name: "Use plain format" }));
    await screen.findByRole("textbox");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toMatchObject({ mode: "plain" });
  });

  it("sends you to sign in when the session has expired", async () => {
    fetchMock.mockResolvedValue(Response.json({ code: "UNAUTHORIZED" }, { status: 401 }));
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Generate/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
