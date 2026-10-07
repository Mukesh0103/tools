import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyReminder } from "@/components/app/daily-reminder";
import { announceEntryLogged } from "@/lib/reminder";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const dismissReminder = vi.fn().mockResolvedValue({ ok: true, data: null });
vi.mock("@/server/actions/settings", () => ({
  dismissReminder: (...a: unknown[]) => dismissReminder(...a),
}));

const playChime = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/chime", () => ({ playChime: () => playChime() }));

// 18:00 in Kolkata is 12:30Z.
const props = {
  tz: "Asia/Kolkata",
  today: "2026-10-06",
  reminderTime: "18:00",
  loggedToday: false,
  dismissedOn: null,
};
const EVENING = new Date("2026-10-06T13:00:00Z"); // 18:30 in Kolkata

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
  dismissReminder.mockClear();
  playChime.mockClear();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("DailyReminder", () => {
  it("appears at the reminder time and doesn't time out", () => {
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z")); // 17:30
    render(<DailyReminder {...props} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30 * 60_000));
    expect(screen.getByRole("status")).toHaveTextContent("You haven’t logged anything today.");
    expect(screen.getByRole("link", { name: "Log now" })).toHaveAttribute("href", "/today");

    act(() => vi.advanceTimersByTime(4 * 60 * 60_000));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("chimes as it appears, once a day", () => {
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z")); // 17:30
    const { unmount } = render(<DailyReminder {...props} />);
    expect(playChime).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(30 * 60_000));
    expect(playChime).toHaveBeenCalledTimes(1);
    unmount();

    // A reload, or a second tab, later that evening stays quiet.
    const { unmount: unmountAgain } = render(<DailyReminder {...props} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(playChime).toHaveBeenCalledTimes(1);
    unmountAgain();

    // A new reminder time chimes again.
    render(<DailyReminder {...props} reminderTime="17:45" />);
    expect(playChime).toHaveBeenCalledTimes(2);
  });

  it("stays hidden once something is logged, or after it was closed today", () => {
    vi.setSystemTime(EVENING);
    const { unmount } = render(<DailyReminder {...props} loggedToday />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();

    render(<DailyReminder {...props} dismissedOn="2026-10-06" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(playChime).not.toHaveBeenCalled();
  });

  it("closes from the close button and saves that", () => {
    vi.setSystemTime(EVENING);
    render(<DailyReminder {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Close reminder" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(dismissReminder).toHaveBeenCalledTimes(1);
  });

  it("closes on its own when an entry for today is saved", () => {
    vi.setSystemTime(EVENING);
    render(<DailyReminder {...props} />);

    act(() => announceEntryLogged("2026-10-05"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => announceEntryLogged("2026-10-06"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(dismissReminder).not.toHaveBeenCalled();
  });

  it("comes back the next day after being closed", () => {
    vi.setSystemTime(EVENING);
    render(<DailyReminder {...props} dismissedOn="2026-10-06" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(24 * 60 * 60_000));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
