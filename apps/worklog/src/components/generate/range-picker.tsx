"use client";

import { Calendar, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRangeLabel, type DateRange } from "@/lib/dates";
import type { RangePreset } from "@/lib/range-presets";
import { cn } from "@/lib/utils";
import { dateRangeSchema } from "@/lib/validators";

export type { RangePreset } from "@/lib/range-presets";

/** "Mon 28 – Tue 29" when both ends share a month, for narrow screens. */
function compactLabel(range: DateRange): string {
  const full = formatRangeLabel(range);
  return range.start.slice(0, 7) === range.end.slice(0, 7)
    ? full.replace(/ [A-Z][a-z]{2}$/, "")
    : full;
}

export function RangePicker({
  value,
  presets,
  today,
  onChange,
  open,
  onOpenChange,
  className,
}: {
  value: DateRange;
  presets: RangePreset[];
  today: string;
  onChange: (range: DateRange) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const [start, setStart] = useState(value.start);
  const [end, setEnd] = useState(value.end);
  const [error, setError] = useState<string | null>(null);

  function openChange(next: boolean) {
    if (next) {
      setStart(value.start);
      setEnd(value.end);
      setError(null);
    }
    onOpenChange(next);
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    const parsed = dateRangeSchema.safeParse({ start, end });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid range");
      return;
    }
    onChange(parsed.data);
    onOpenChange(false);
  }

  const dateInput =
    "h-9 w-full rounded-lg border border-border bg-surface px-2 text-[13px] outline-none focus:border-primary focus:ring-3 focus:ring-primary-ring";

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button size="md" className={cn("h-9 justify-start text-[13px]", className)}>
          <Calendar className="size-[15px]" strokeWidth={1.75} aria-hidden />
          <span className="truncate md:hidden">{compactLabel(value)}</span>
          <span className="hidden truncate md:inline">{formatRangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[280px] flex-col gap-3">
        <div className="flex flex-col gap-0.5" role="group" aria-label="Presets">
          {presets.map((p) => {
            const on = p.range.start === value.start && p.range.end === value.end;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onChange(p.range);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex h-9 items-center justify-between rounded-md px-2 text-left text-[13px] hover:bg-hover",
                  on && "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft",
                )}
              >
                <span className="font-medium">{p.label}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {formatRangeLabel(p.range)}
                  {on ? (
                    <Check className="size-3.5 text-primary" strokeWidth={2.25} aria-hidden />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <form onSubmit={applyCustom} className="flex flex-col gap-2 border-t border-divider pt-3">
          <span className="text-xs font-medium text-subtle-foreground">Custom range</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={start}
                max={today}
                onChange={(e) => setStart(e.target.value)}
                className={dateInput}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={end}
                max={today}
                onChange={(e) => setEnd(e.target.value)}
                className={dateInput}
                required
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-blocker-soft-foreground">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" size="sm" className="self-end">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
