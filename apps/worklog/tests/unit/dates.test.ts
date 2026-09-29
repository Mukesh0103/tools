import { describe, expect, it } from "vitest";
import {
  addDays,
  dayBoundsUtc,
  formatDayHeading,
  formatDayTitle,
  formatLongDate,
  formatRangeLabel,
  formatTimeZoneLabel,
  isISODate,
  monthsInRange,
  previousWorkday,
  quarterRange,
  standupRange,
  timeInZone,
  todayInZone,
  weeklyRange,
  yearRange,
} from "@/lib/dates";

const HOUR = 3_600_000;

describe("todayInZone", () => {
  const instant = new Date("2026-09-29T20:00:00Z");
  it("reads the calendar day in the user's zone", () => {
    expect(todayInZone("Asia/Kolkata", instant)).toBe("2026-09-30");
    expect(todayInZone("America/Los_Angeles", instant)).toBe("2026-09-29");
    expect(todayInZone("UTC", instant)).toBe("2026-09-29");
  });

  it("renders local wall-clock time", () => {
    expect(timeInZone(new Date("2026-09-29T11:35:00Z"), "Asia/Kolkata")).toBe("17:05");
  });
});

describe("day arithmetic", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by DST changes", () => {
    // US clocks spring forward on 8 Mar 2026. Calendar arithmetic mustn't care.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("validates ISO dates strictly", () => {
    expect(isISODate("2026-09-29")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("29/09/2026")).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });
});

describe("dayBoundsUtc", () => {
  it("is 23 hours on a spring-forward day and 25 on a fall-back day", () => {
    const spring = dayBoundsUtc("2026-03-08", "America/New_York");
    const fall = dayBoundsUtc("2026-11-01", "America/New_York");
    const london = dayBoundsUtc("2026-10-25", "Europe/London");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * HOUR);
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * HOUR);
    expect(london.end.getTime() - london.start.getTime()).toBe(25 * HOUR);
  });

  it("starts the day at local midnight", () => {
    expect(dayBoundsUtc("2026-09-29", "Asia/Kolkata").start.toISOString()).toBe(
      "2026-09-28T18:30:00.000Z",
    );
  });
});

describe("generator ranges", () => {
  const tuesday = new Date("2026-09-29T09:00:00Z");
  const monday = new Date("2026-09-28T09:00:00Z");

  it("uses the previous workday for standups, so Monday reports Friday", () => {
    expect(previousWorkday("2026-09-28")).toBe("2026-09-25");
    expect(previousWorkday("2026-09-29")).toBe("2026-09-28");
    expect(previousWorkday("2026-09-27")).toBe("2026-09-25");
    expect(standupRange("UTC", monday)).toEqual({ start: "2026-09-25", end: "2026-09-28" });
    expect(standupRange("UTC", tuesday)).toEqual({ start: "2026-09-28", end: "2026-09-29" });
  });

  it("takes the last 7 days, today included, for weekly summaries", () => {
    expect(weeklyRange("UTC", tuesday)).toEqual({ start: "2026-09-23", end: "2026-09-29" });
  });

  it("computes quarters, including the previous year's Q4", () => {
    expect(quarterRange("UTC", tuesday)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(quarterRange("UTC", tuesday, -1)).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(quarterRange("UTC", new Date("2026-02-10T00:00:00Z"), -1)).toEqual({
      start: "2025-10-01",
      end: "2025-12-31",
    });
    expect(quarterRange("UTC", new Date("2026-11-10T00:00:00Z"))).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
    expect(yearRange("UTC", tuesday)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("uses the user's zone to decide which day it is", () => {
    // 20:00Z on Tue 29 Sep is already Wed 30 Sep in Kolkata.
    const late = new Date("2026-09-29T20:00:00Z");
    expect(standupRange("Asia/Kolkata", late)).toEqual({ start: "2026-09-29", end: "2026-09-30" });
  });

  it("splits a range into clipped calendar months", () => {
    expect(monthsInRange({ start: "2026-07-15", end: "2026-09-10" })).toEqual([
      { start: "2026-07-15", end: "2026-07-31", label: "July 2026" },
      { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
      { start: "2026-09-01", end: "2026-09-10", label: "September 2026" },
    ]);
    expect(monthsInRange({ start: "2026-12-20", end: "2027-01-05" }).map((m) => m.label)).toEqual([
      "December 2026",
      "January 2027",
    ]);
  });
});

describe("labels", () => {
  it("formats ranges the way the design does", () => {
    expect(formatRangeLabel({ start: "2026-09-28", end: "2026-09-29" })).toBe(
      "Mon 28 – Tue 29 Sep",
    );
    expect(formatRangeLabel({ start: "2026-09-23", end: "2026-09-29" })).toBe(
      "Wed 23 – Tue 29 Sep",
    );
    expect(formatRangeLabel({ start: "2026-08-31", end: "2026-09-01" })).toBe(
      "Mon 31 Aug – Tue 1 Sep",
    );
    expect(formatRangeLabel({ start: "2026-07-01", end: "2026-09-30" })).toBe(
      "Jul – Sep 2026 (Q3)",
    );
    expect(formatRangeLabel({ start: "2026-04-01", end: "2026-06-30" })).toBe(
      "Apr – Jun 2026 (Q2)",
    );
    expect(formatRangeLabel({ start: "2026-01-01", end: "2026-12-31" })).toBe("2026");
    expect(formatRangeLabel({ start: "2026-09-29", end: "2026-09-29" })).toBe("Tue 29 Sep");
    expect(formatRangeLabel({ start: "2025-12-29", end: "2026-01-02" })).toBe(
      "29 Dec 2025 – 2 Jan 2026",
    );
  });

  it("names days relative to today", () => {
    expect(formatDayHeading("2026-09-29", "2026-09-29")).toBe("Today · Tue 29 Sep");
    expect(formatDayHeading("2026-09-28", "2026-09-29")).toBe("Yesterday · Mon 28 Sep");
    expect(formatDayHeading("2026-09-25", "2026-09-29")).toBe("Fri 25 Sep");
    expect(formatDayHeading("2025-12-31", "2026-09-29")).toBe("Wed 31 Dec 2025");
    expect(formatDayTitle("2026-09-25", "2026-09-29")).toBe("Friday");
    expect(formatLongDate("2026-09-29")).toBe("Tuesday, 29 September");
  });

  it("labels time zones with their current offset", () => {
    const sep = new Date("2026-09-29T12:00:00Z");
    expect(formatTimeZoneLabel("Asia/Kolkata", sep)).toBe("Asia/Kolkata (UTC+5:30)");
    expect(formatTimeZoneLabel("America/New_York", sep)).toBe("America/New_York (UTC−4)");
    expect(formatTimeZoneLabel("UTC", sep)).toBe("UTC (UTC)");
  });
});
