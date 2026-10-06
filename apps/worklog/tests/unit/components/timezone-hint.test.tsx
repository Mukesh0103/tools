import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimezoneHint } from "@/components/entries/timezone-hint";

const switchTimezone = vi.fn().mockResolvedValue({ ok: true, data: null });
vi.mock("@/server/actions/settings", () => ({
  switchTimezone: (...a: unknown[]) => switchTimezone(...a),
}));

function deviceZone(timeZone: string) {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...real.call(this), timeZone };
  });
}

beforeEach(() => {
  window.localStorage.clear();
  switchTimezone.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("TimezoneHint", () => {
  it("stays hidden when the device agrees with the saved zone", () => {
    deviceZone("Europe/Dublin");
    render(<TimezoneHint savedTz="Europe/London" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers to switch when the zones disagree", async () => {
    deviceZone("Asia/Kolkata");
    const user = userEvent.setup();
    render(<TimezoneHint savedTz="UTC" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your days follow UTC, but this device is set to Asia/Kolkata.",
    );
    await user.click(screen.getByRole("button", { name: "Use Kolkata" }));
    expect(switchTimezone).toHaveBeenCalledWith("Asia/Kolkata");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("remembers Keep for that pair of zones", async () => {
    deviceZone("Asia/Kolkata");
    const user = userEvent.setup();
    const { unmount } = render(<TimezoneHint savedTz="UTC" />);
    await user.click(await screen.findByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();

    render(<TimezoneHint savedTz="UTC" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(switchTimezone).not.toHaveBeenCalled();
  });
});
