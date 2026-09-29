"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode };

/** A row of toggle buttons where one is pressed. The design's "seg" control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  labelledBy?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn("flex gap-0.5 rounded-lg bg-hover p-[3px]", className)}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-subtle-foreground transition-colors hover:text-foreground",
              size === "md" ? "h-8 px-3.5" : "h-[30px]",
              on &&
                "bg-surface text-foreground shadow-[0_1px_2px_rgb(28_25_23/0.08),0_0_0_1px_var(--border)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
