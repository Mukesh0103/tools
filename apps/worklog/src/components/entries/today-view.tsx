"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDayTitle, formatLongDate, formatShortDate } from "@/lib/dates";
import type { EntryView } from "@/lib/entry-view";
import { firstSyncError, joinProviders, useSync } from "@/lib/integrations/client";
import { PROVIDER_NAMES, type IntegrationStatus } from "@/lib/integrations/types";
import { cn, pluralize } from "@/lib/utils";
import { DayNav, useDayRollover } from "./day-nav";
import { EntryInput } from "./entry-input";
import { EntryItem } from "./entry-item";
import { TimezoneHint } from "./timezone-hint";
import { useEntryMutations } from "./use-entry-mutations";

export function TodayView({
  date,
  today,
  tz,
  entries,
  integrations = [],
}: {
  date: string;
  today: string;
  tz: string;
  entries: EntryView[];
  integrations?: IntegrationStatus[];
}) {
  const { items, freshId, add, update, remove } = useEntryMutations(entries);
  const isToday = date === today;
  const countLabel = isToday
    ? `${pluralize(items.length, "entry", "entries")} today`
    : `${pluralize(items.length, "entry", "entries")} on ${formatShortDate(date)}`;

  useDayRollover(tz, today);

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-7 px-5 pt-14 md:px-0">
      <TimezoneHint savedTz={tz} />

      <header className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5 md:gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">
            {formatDayTitle(date, today)}
          </h1>
          <span className="text-[13px] text-muted-foreground md:text-sm">
            {formatLongDate(date)}
          </span>
        </div>
        <DayNav date={date} today={today} />
      </header>

      <div className="fixed inset-x-0 bottom-[calc(64px+max(env(safe-area-inset-bottom),8px))] z-20 flex flex-col gap-2 border-t border-border bg-background px-3 py-2.5 md:static md:gap-2.5 md:border-0 md:bg-transparent md:p-0">
        <BlockerChip />
        <EntryInput
          key={date}
          // On Today the server picks the day, so a tab left open past midnight logs to the new day.
          onSubmit={(raw) => add(raw, date, { pinDate: !isToday })}
          placeholder={
            isToday ? "What did you work on?" : `What did you work on ${formatShortDate(date)}?`
          }
        />
        <div className="hidden pl-0.5 text-xs text-muted-foreground md:flex">
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
          <div className="flex items-center gap-1.5">
            {integrations.length > 0 ? (
              <SyncButton date={date} isToday={isToday} integrations={integrations} />
            ) : null}
            <Link
              href="/generate?type=standup"
              className="text-[13px] font-medium text-primary hover:text-primary-hover max-md:py-3"
            >
              <span className="md:hidden">Standup →</span>
              <span className="hidden md:inline">Generate standup →</span>
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyDay isToday={isToday} connected={integrations.length > 0} />
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

/**
 * Imports GitHub and Jira activity. Opening Today syncs the standup range on its
 * own (at most every 10 minutes). The button forces a sync of the day on screen.
 */
function SyncButton({
  date,
  isToday,
  integrations,
}: {
  date: string;
  isToday: boolean;
  integrations: IntegrationStatus[];
}) {
  const { sync, syncing } = useSync();
  const [error, setError] = useState(
    () =>
      integrations
        .map((i) => i.lastError && `${PROVIDER_NAMES[i.provider]}: ${i.lastError}`)
        .find(Boolean) ?? null,
  );
  const started = useRef(false);
  const names = joinProviders(integrations.map((i) => i.provider));

  useEffect(() => {
    if (!isToday || started.current) return;
    started.current = true;
    void sync({}, { quiet: true }).then((result) => {
      if (result) setError(firstSyncError(result));
    });
  }, [isToday, sync]);

  async function run() {
    const result = await sync(
      isToday ? { force: true } : { range: { start: date, end: date }, force: true },
    );
    if (result) setError(firstSyncError(result));
  }

  return (
    <Button
      variant="icon"
      size="icon"
      onClick={() => void run()}
      disabled={syncing}
      aria-label={syncing ? `Syncing ${names}` : `Sync ${names}`}
      title={error ?? `Import your ${names} activity for this day`}
      className="relative max-md:size-11"
    >
      <RefreshCw className={cn("size-4", syncing && "animate-spin")} strokeWidth={1.75} />
      {error && !syncing ? (
        <span
          className="absolute top-1 right-1 size-1.5 rounded-full bg-blocker max-md:top-2.5 max-md:right-2.5"
          aria-hidden
        />
      ) : null}
    </Button>
  );
}

function BlockerChip() {
  function insert() {
    const input = document.getElementById("entry-input") as HTMLInputElement | null;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const next = `${input.value.replace(/\s*$/, "")}${input.value.trim() ? " " : ""}!blocker `;
    setter?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
  return (
    <div className="flex md:hidden">
      <button
        type="button"
        onClick={insert}
        className="rounded-full border border-border bg-surface px-2.5 font-mono text-xs leading-7 whitespace-nowrap text-blocker-soft-foreground"
      >
        !blocker
      </button>
    </div>
  );
}

function EmptyDay({ isToday, connected }: { isToday: boolean; connected: boolean }) {
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
        <span className="ml-auto text-[11px] text-muted-foreground">Example</span>
      </div>
      <span className="text-[13px] leading-normal text-subtle-foreground">
        {connected ? (
          "Pull requests and issue moves show up here on their own as you work."
        ) : (
          <>
            Or{" "}
            <Link href="/settings" className="font-medium text-primary hover:text-primary-hover">
              connect GitHub or Jira
            </Link>{" "}
            and let your pull requests and tickets fill this in.
          </>
        )}
      </span>
    </div>
  );
}
