"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { addDays, msUntilNextDay, todayInZone } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function dayHref(date: string, today: string) {
  return date === today ? "/today" : `/today?date=${date}`;
}

/**
 * Moves between days: [Today] [‹][›]. The page heading names the day you're on.
 * The arrows sit side by side, with no label between them, so nothing here reads
 * as the current day. You can't go past today, because future days can't hold entries.
 */
export function DayNav({ date, today }: { date: string; today: string }) {
  const isToday = date === today;
  const arrow = "max-md:size-11";
  const chevron = "size-[18px]";

  return (
    <nav aria-label="Change day" className="-mr-2.5 flex items-center gap-1 md:mr-0">
      {isToday ? (
        <Button disabled className="mr-1 max-md:hidden">
          Today
        </Button>
      ) : (
        <Button asChild className="mr-1">
          <Link href="/today">Today</Link>
        </Button>
      )}
      <Button asChild variant="icon" size="icon" className={arrow}>
        <Link href={dayHref(addDays(date, -1), today)} aria-label="Previous day">
          <ChevronLeft className={chevron} strokeWidth={1.75} />
        </Link>
      </Button>
      {isToday ? (
        <Button
          variant="icon"
          size="icon"
          aria-label="Next day"
          title="You're on today"
          disabled
          className={cn(arrow, "opacity-40")}
        >
          <ChevronRight className={chevron} strokeWidth={1.75} />
        </Button>
      ) : (
        <Button asChild variant="icon" size="icon" className={arrow}>
          <Link href={dayHref(addDays(date, 1), today)} aria-label="Next day">
            <ChevronRight className={chevron} strokeWidth={1.75} />
          </Link>
        </Button>
      )}
    </nav>
  );
}

/**
 * The server works out "today" once, when it renders the page. A tab left open
 * overnight would keep showing yesterday as Today. This hook re-renders the page
 * at local midnight, and whenever the tab comes back into view on a new day.
 */
export function useDayRollover(tz: string, today: string) {
  const router = useRouter();

  useEffect(() => {
    let timer: number | undefined;
    const check = () => {
      if (todayInZone(tz) !== today) router.refresh();
    };
    const schedule = () => {
      // One second past midnight, so the check never lands just before it.
      timer = window.setTimeout(
        () => {
          check();
          schedule();
        },
        Math.min(msUntilNextDay(tz) + 1000, 2 ** 31 - 1),
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", check);
    };
  }, [tz, today, router]);
}
