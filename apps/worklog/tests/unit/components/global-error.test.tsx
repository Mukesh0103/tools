import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("GlobalError", () => {
  it("fetches the page from the server again before retrying", async () => {
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={new Error("Failed query")} reset={reset} />, {
      container: document.documentElement,
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
