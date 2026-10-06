import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayNav, useDayRollover } from "@/components/entries/day-nav";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("DayNav", () => {
  it("on today: nothing reads as a destination, and forward is off", () => {
    render(<DayNav date="2026-10-06" today="2026-10-06" />);
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Previous day" })).toHaveAttribute(
      "href",
      "/today?date=2026-10-05",
    );
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
  });

  it("on yesterday: forward goes to today, and Today jumps back", () => {
    render(<DayNav date="2026-10-05" today="2026-10-06" />);
    expect(screen.getByRole("link", { name: "Next day" })).toHaveAttribute("href", "/today");
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("href", "/today");
    expect(screen.getByRole("link", { name: "Previous day" })).toHaveAttribute(
      "href",
      "/today?date=2026-10-04",
    );
  });

  it("further back: forward steps one day at a time", () => {
    render(<DayNav date="2026-10-01" today="2026-10-06" />);
    expect(screen.getByRole("link", { name: "Next day" })).toHaveAttribute(
      "href",
      "/today?date=2026-10-02",
    );
  });
});

function Rollover({ today }: { today: string }) {
  useDayRollover("Asia/Kolkata", today);
  return null;
}

describe("useDayRollover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("leaves a current page alone", () => {
    vi.setSystemTime(new Date("2026-10-06T06:00:00Z")); // 11:30 in Kolkata
    render(<Rollover today="2026-10-06" />);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes a page rendered on an earlier day", () => {
    vi.setSystemTime(new Date("2026-10-06T06:00:00Z"));
    render(<Rollover today="2026-10-05" />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes at local midnight", () => {
    vi.setSystemTime(new Date("2026-10-06T18:00:00Z")); // 23:30 in Kolkata
    render(<Rollover today="2026-10-06" />);
    act(() => vi.advanceTimersByTime(29 * 60_000));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when a tab left open overnight comes back into view", () => {
    vi.setSystemTime(new Date("2026-10-06T06:00:00Z"));
    render(<Rollover today="2026-10-06" />);
    // The tab was in the background, so the timer never fired.
    vi.setSystemTime(new Date("2026-10-07T03:00:00Z"));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
