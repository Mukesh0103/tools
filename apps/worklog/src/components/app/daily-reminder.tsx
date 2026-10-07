"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { playChime } from "@/lib/chime";
import { msUntilNextDay, todayInZone } from "@/lib/dates";
import { isReminderDue, msUntilReminder, onEntryLogged } from "@/lib/reminder";
import { dismissReminder } from "@/server/actions/settings";

/** The local date and reminder time that last chimed in this browser. */
const CHIMED_KEY = "worklog:reminder-chimed-on";

/**
 * The daily "log your day" reminder, pinned to the top right of every page.
 * It appears once the reminder time passes with nothing logged today, with a
 * short chime, and never times out: it stays until an entry for today is saved
 * or the user closes it. Closing it is saved, so it stays closed for the rest of
 * the day on every device.
 */
export function DailyReminder({
  tz,
  today,
  reminderTime,
  loggedToday,
  dismissedOn,
}: {
  tz: string;
  /** The day the server rendered, in `tz`. `loggedToday` describes this day. */
  today: string;
  /** "HH:mm" in `tz`. */
  reminderTime: string;
  loggedToday: boolean;
  dismissedOn: string | null;
}) {
  const router = useRouter();
  // Null until mounted, so the server render and hydration agree (nothing shown).
  const [now, setNow] = useState<Date | null>(null);
  const [loggedOn, setLoggedOn] = useState<string | null>(null);
  const [closedOn, setClosedOn] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      const current = new Date();
      setNow(current);
      // Wake at the reminder time, then just after midnight to start the next day.
      const wait = msUntilReminder(tz, reminderTime, current) || msUntilNextDay(tz, current) + 1000;
      timer = window.setTimeout(tick, Math.min(wait, 2 ** 31 - 1));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tz, reminderTime]);

  useEffect(
    () =>
      onEntryLogged((date) => {
        if (date === todayInZone(tz)) setLoggedOn(date);
      }),
    [tz],
  );

  const localDate = now ? todayInZone(tz, now) : today;

  // After midnight, `loggedToday` describes yesterday. Fetch today's instead.
  useEffect(() => {
    if (localDate !== today) router.refresh();
  }, [localDate, today, router]);

  const logged = (loggedToday && localDate === today) || loggedOn === localDate;
  const visible =
    now !== null &&
    !logged &&
    closedOn !== localDate &&
    isReminderDue({ now, timezone: tz, reminderTime, dismissedOn });

  // Chime as it appears, once per day and reminder time, across reloads and open tabs.
  useEffect(() => {
    if (!visible) return;
    const chime = `${localDate} ${reminderTime}`;
    try {
      if (window.localStorage.getItem(CHIMED_KEY) === chime) return;
      window.localStorage.setItem(CHIMED_KEY, chime);
    } catch {
      // Storage blocked: chime anyway.
    }
    void playChime();
  }, [visible, localDate, reminderTime]);

  if (!visible) return null;

  function close() {
    setClosedOn(localDate);
    // If saving fails, it still stays closed until the page reloads.
    void dismissReminder().catch(() => {});
  }

  function logNow(event: React.MouseEvent) {
    const input = document.getElementById("entry-input");
    const onToday =
      window.location.pathname === "/today" &&
      !new URLSearchParams(window.location.search).has("date");
    // Already on today's page: jump to the input rather than navigate.
    if (input && onToday) {
      event.preventDefault();
      input.focus();
    }
  }

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-40 flex animate-in items-center gap-2.5 rounded-lg bg-inverse py-1.5 pr-1.5 pl-3.5 text-[13px] text-inverse-foreground shadow-[0_8px_24px_rgb(28_25_23/0.18)] duration-200 fade-in-0 slide-in-from-top-2 motion-reduce:animate-none sm:inset-x-auto sm:top-4 sm:right-4 sm:max-w-sm"
    >
      <BellRing className="size-[15px] shrink-0 text-inverse-accent" strokeWidth={2} aria-hidden />
      <p className="grow leading-snug">You haven’t logged anything today.</p>
      <Link
        href="/today"
        onClick={logNow}
        className="shrink-0 rounded-md px-2 py-1 font-medium whitespace-nowrap text-inverse-accent hover:underline"
      >
        Log now
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Close reminder"
        className="grid size-8 shrink-0 place-items-center rounded-md text-inverse-foreground/70 hover:bg-inverse-foreground/10 hover:text-inverse-foreground max-md:size-10"
      >
        <X className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
