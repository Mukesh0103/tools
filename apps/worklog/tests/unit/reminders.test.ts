import { describe, expect, it } from "vitest";
import { isReminderDue } from "@/lib/db/queries/reminders";

// 18:00 in Kolkata (UTC+5:30) is 12:30Z.
const base = { timezone: "Asia/Kolkata", reminderTime: "18:00:00", lastRemindedOn: null };

describe("isReminderDue", () => {
  it("is due once the local reminder time has passed", () => {
    expect(isReminderDue({ ...base, now: new Date("2026-09-29T12:29:00Z") })).toBe(false);
    expect(isReminderDue({ ...base, now: new Date("2026-09-29T12:30:00Z") })).toBe(true);
  });

  it("still fires when the cron runs late, but only once per local day", () => {
    const late = new Date("2026-09-29T17:00:00Z"); // 22:30 local
    expect(isReminderDue({ ...base, now: late })).toBe(true);
    expect(isReminderDue({ ...base, now: late, lastRemindedOn: "2026-09-29" })).toBe(false);
    expect(isReminderDue({ ...base, now: late, lastRemindedOn: "2026-09-28" })).toBe(true);
  });

  it("uses the local date, not the UTC date", () => {
    // 19:00Z on the 29th is 00:30 on the 30th in Kolkata, before the reminder time.
    expect(
      isReminderDue({
        ...base,
        now: new Date("2026-09-29T19:00:00Z"),
        lastRemindedOn: "2026-09-29",
      }),
    ).toBe(false);
  });
});
