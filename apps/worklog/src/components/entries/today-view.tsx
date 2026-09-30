"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/chips";
import { Kbd } from "@/components/ui/kbd";
import { addDays, formatDayTitle, formatLongDate, formatShortDate } from "@/lib/dates";
import type { EntryView } from "@/lib/entry-view";
import { cn, pluralize } from "@/lib/utils";
import { EntryInput } from "./entry-input";
import { EntryItem } from "./entry-item";
import { useEntryMutations } from "./use-entry-mutations";

function dayHref(date: string, today: string) {
  return date === today ? "/today" : `/today?date=${date}`;
}

export function TodayView({
  date,
  today,
  entries,
  knownTags,
}: {
  date: string;
  today: string;
  entries: EntryView[];
  knownTags: string[];
}) {
  const { items, freshId, add, update, remove } = useEntryMutations(entries);
  const isToday = date === today;
  const yesterday = addDays(today, -1);
  const countLabel = isToday
    ? `${pluralize(items.length, "entry", "entries")} today`
    : `${pluralize(items.length, "entry", "entries")} on ${formatShortDate(date)}`;
  const quickTags = knownTags.slice(0, 4);

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-7 px-5 pt-14 md:px-0">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-0.5 md:gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">
            {formatDayTitle(date, today)}
          </h1>
          <span className="text-[13px] text-muted-foreground md:text-sm">
            {formatLongDate(date)}
          </span>
        </div>
        <div className="-mr-2.5 flex items-center gap-1 md:mr-0">
          <Button asChild variant="icon" size="icon" className="max-md:size-11">
            <Link href={dayHref(addDays(date, -1), today)} aria-label="Previous day">
              <ChevronLeft className="size-[18px]" strokeWidth={1.75} />
            </Link>
          </Button>
          <Button asChild className="hidden md:inline-flex">
            <Link href={isToday ? dayHref(yesterday, today) : "/today"}>
              {isToday ? "Yesterday" : "Today"}
            </Link>
          </Button>
          {isToday ? (
            <Button
              variant="icon"
              size="icon"
              aria-label="Next day"
              disabled
              className="opacity-40 max-md:size-11"
            >
              <ChevronRight className="size-[18px]" strokeWidth={1.75} />
            </Button>
          ) : (
            <Button asChild variant="icon" size="icon" className="max-md:size-11">
              <Link href={dayHref(addDays(date, 1), today)} aria-label="Next day">
                <ChevronRight className="size-[18px]" strokeWidth={1.75} />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="fixed inset-x-0 bottom-[calc(64px+max(env(safe-area-inset-bottom),8px))] z-20 flex flex-col gap-2 border-t border-border bg-background px-3 py-2.5 md:static md:gap-2.5 md:border-0 md:bg-transparent md:p-0">
        {quickTags.length > 0 ? <QuickChips tags={quickTags} /> : null}
        <EntryInput
          key={date}
          knownTags={knownTags}
          onSubmit={(raw) => add(raw, date)}
          placeholder={
            isToday ? "What did you work on?" : `What did you work on ${formatShortDate(date)}?`
          }
        />
        <div className="hidden gap-4 pl-0.5 text-xs text-muted-foreground md:flex">
          <span>
            <span className="font-mono text-primary-soft-foreground">#tag</span> adds a tag
          </span>
          <span>
            <span className="font-mono text-blocker-soft-foreground">!blocker</span> flags a blocker
          </span>
        </div>
      </div>

      <section aria-labelledby="entries-heading" className="flex flex-col gap-1.5 max-md:gap-0">
        <div className="flex items-center justify-between border-b border-border px-3 pb-1.5 max-md:border-0 max-md:px-0 max-md:pb-1">
          <h2 id="entries-heading" className="text-[13px] font-medium text-subtle-foreground">
            {countLabel}
          </h2>
          <Link
            href="/generate?type=standup"
            className="text-[13px] font-medium text-primary hover:text-primary-hover max-md:py-3"
          >
            <span className="md:hidden">Standup →</span>
            <span className="hidden md:inline">Generate standup →</span>
          </Link>
        </div>

        {items.length === 0 ? (
          <EmptyDay isToday={isToday} />
        ) : (
          <div className="flex flex-col gap-0 md:gap-0.5">
            {items.map((entry) => (
              <EntryItem
                key={entry.id}
                entry={entry}
                fresh={entry.id === freshId}
                onUpdate={update}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </section>

      <div className="h-36 md:hidden" aria-hidden />
    </div>
  );
}

function QuickChips({ tags }: { tags: string[] }) {
  function insert(token: string) {
    const input = document.getElementById("entry-input") as HTMLInputElement | null;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const next = `${input.value.replace(/\s*$/, "")}${input.value.trim() ? " " : ""}${token} `;
    setter?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
  const chip =
    "rounded-full border border-border bg-surface px-2.5 font-mono text-xs leading-7 whitespace-nowrap";
  return (
    <div className="flex gap-1.5 overflow-x-auto md:hidden" role="group" aria-label="Insert a tag">
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => insert(t)}
          className={cn(chip, "text-primary-soft-foreground")}
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        onClick={() => insert("!blocker")}
        className={cn(chip, "text-blocker-soft-foreground")}
      >
        !blocker
      </button>
    </div>
  );
}

function EmptyDay({ isToday }: { isToday: boolean }) {
  if (!isToday) {
    return (
      <p className="px-3 py-6 text-sm text-muted-foreground max-md:px-0">
        Nothing logged for this day.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 px-1 pt-2">
      <span className="text-sm font-semibold">Log your first line</span>
      <span className="text-[13px] leading-normal text-subtle-foreground">
        One line per task is enough. Here’s what an entry looks like:
      </span>
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border-strong px-2.5 py-2 text-sm text-subtle-foreground">
        <span className="w-[34px] shrink-0 font-mono text-[11px] text-muted-foreground">09:30</span>
        <span>Reviewed checkout PR</span>
        <TagChip tag="#reviews" className="text-[11px] leading-[18px]" />
        <span className="ml-auto text-[11px] text-muted-foreground">Example</span>
      </div>
      <span className="hidden text-xs text-muted-foreground md:block">
        Press <Kbd>N</Kbd> from anywhere to jump here.
      </span>
    </div>
  );
}
