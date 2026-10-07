import { describe, expect, it } from "vitest";
import { isReminderDue, msUntilReminder } from "@/lib/reminder";

// 18:00 in Kolkata (UTC+5:30) is 12:30Z.
const base = { timezone: "Asia/Kolkata", reminderTime: "18:00", dismissedOn: null };

describe("isReminderDue", () => {
  it("is due once the local reminder time has passed", () => {
    expect(isReminderDue({ ...base, now: new Date("2026-09-29T12:29:00Z") })).toBe(false);
    expect(isReminderDue({ ...base, now: new Date("2026-09-29T12:30:00Z") })).toBe(true);
  });

  it("stays due all evening, until it's closed for the day", () => {
    const late = new Date("2026-09-29T17:00:00Z"); // 22:30 local
    expect(isReminderDue({ ...base, now: late })).toBe(true);
    expect(isReminderDue({ ...base, now: late, dismissedOn: "2026-09-29" })).toBe(false);
    expect(isReminderDue({ ...base, now: late, dismissedOn: "2026-09-28" })).toBe(true);
  });

  it("uses the local date, not the UTC date", () => {
    // 19:00Z on the 29th is 00:30 on the 30th in Kolkata, before the reminder time.
    expect(
      isReminderDue({
        ...base,
        now: new Date("2026-09-29T19:00:00Z"),
        dismissedOn: "2026-09-29",
      }),
    ).toBe(false);
  });

  it("accepts the database's HH:mm:ss form", () => {
    const now = new Date("2026-09-29T12:30:00Z");
    expect(isReminderDue({ ...base, reminderTime: "18:00:00", now })).toBe(true);
  });
});

describe("msUntilReminder", () => {
  it("counts down to today's reminder time in the zone, then stays at 0", () => {
    expect(msUntilReminder("Asia/Kolkata", "18:00", new Date("2026-09-29T12:00:00Z"))).toBe(
      30 * 60_000,
    );
    expect(msUntilReminder("Asia/Kolkata", "18:00", new Date("2026-09-29T12:30:00Z"))).toBe(0);
    expect(msUntilReminder("Asia/Kolkata", "18:00", new Date("2026-09-29T15:00:00Z"))).toBe(0);
  });
});
