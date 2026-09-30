"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { groupByDay, type EntryView } from "@/lib/entry-view";
import { cn } from "@/lib/utils";
import { DayGroup } from "./day-group";
import { EntryListSkeleton } from "./entry-list-skeleton";
import { useEntryMutations } from "./use-entry-mutations";

export type TimelineFilters = { q: string; blockers: boolean; more: number };

export function TimelineView({
  entries,
  today,
  filters,
  hasMore,
  autoFocusSearch,
}: {
  entries: EntryView[];
  today: string;
  filters: TimelineFilters;
  hasMore: boolean;
  autoFocusSearch: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const searchRef = useRef<HTMLInputElement>(null);
  const { items, update, remove } = useEntryMutations(entries);
  const groups = groupByDay(items);
  const filtered = Boolean(filters.q || filters.blockers);

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);

  function navigate(next: Partial<Record<"q" | "blockers" | "more" | "focus", string | null>>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    if (!("more" in next)) sp.delete("more");
    sp.delete("focus");
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (query === filters.q) return;
    const t = window.setTimeout(() => navigate({ q: query.trim() || null }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const chip =
    "h-[30px] shrink-0 rounded-full border px-3 text-[13px] transition-colors border-border bg-surface text-subtle-foreground hover:border-border-strong hover:text-foreground";
  const chipOn =
    "border-foreground bg-foreground text-background hover:border-foreground hover:text-background";

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-5 px-5 pt-14 md:px-0">
      <header className="flex flex-col gap-3.5 md:gap-4">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">Timeline</h1>
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-ring">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          <label htmlFor="timeline-search" className="sr-only">
            Search entries
          </label>
          <input
            ref={searchRef}
            id="timeline-search"
            type="search"
            placeholder="Search entries"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (query) setQuery("");
                else e.currentTarget.blur();
              }
            }}
            className="h-[38px] min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          role="group"
          aria-label="Filter entries"
          className="-mr-5 flex gap-2 overflow-x-auto pr-5 md:mr-0 md:flex-wrap md:pr-0"
        >
          <button
            type="button"
            aria-pressed={!filters.blockers}
            className={cn(chip, !filters.blockers && chipOn)}
            onClick={() => navigate({ blockers: null })}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={filters.blockers}
            className={cn(chip, "text-blocker-soft-foreground", filters.blockers && chipOn)}
            onClick={() => navigate({ blockers: filters.blockers ? null : "1" })}
          >
            Blockers only
          </button>
        </div>
      </header>

      {pending ? (
        <EntryListSkeleton groups={2} />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-3 py-8 max-md:px-0">
          <span className="text-sm font-semibold">
            {filtered ? "No entries match" : "Nothing logged yet"}
          </span>
          <span className="text-[13px] text-subtle-foreground">
            {filtered
              ? "Try a different search or filter."
              : "Entries you log on Today show up here, grouped by day."}
          </span>
          {!filtered ? (
            <Link
              href="/today"
              className="text-[13px] font-medium text-primary hover:text-primary-hover"
            >
              Log an entry →
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-[18px] pb-10">
          {groups.map((g) => (
            <DayGroup
              key={g.date}
              date={g.date}
              today={today}
              entries={g.entries}
              onUpdate={update}
              onDelete={remove}
            />
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => navigate({ more: String(filters.more + 1) })}
              className="self-center rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] hover:bg-hover"
            >
              Show older entries
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
