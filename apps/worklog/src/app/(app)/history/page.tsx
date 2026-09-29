import type { Metadata } from "next";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { outputPreview } from "@/lib/ai/output";
import { requireUserId } from "@/lib/auth";
import { formatRangeLabel, resolveTimeZone } from "@/lib/dates";
import { listGenerations } from "@/lib/db/queries/generations";
import { getUserWithSettings } from "@/lib/db/queries/users";
import type { GenerationType } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "History" };

const FILTERS: { value: GenerationType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "standup", label: "Standup" },
  { value: "weekly", label: "Weekly" },
  { value: "appraisal", label: "Appraisal" },
];

const TYPE_STYLE: Record<GenerationType, string> = {
  standup: "bg-primary-soft text-primary-soft-foreground",
  weekly: "bg-hover text-subtle-foreground shadow-[inset_0_0_0_1px_var(--border)]",
  appraisal: "bg-foreground text-background",
};

const TYPE_LABEL: Record<GenerationType, string> = {
  standup: "Standup",
  weekly: "Weekly",
  appraisal: "Appraisal",
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const userId = await requireUserId();
  const [user, params] = await Promise.all([getUserWithSettings(userId), searchParams]);
  const tz = resolveTimeZone(user?.timezone);
  const filter = FILTERS.some((f) => f.value === params.type)
    ? (params.type as GenerationType | "all")
    : "all";
  const rows = await listGenerations(userId, filter === "all" ? undefined : filter);

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-5 px-5 pt-14 pb-10 md:px-0">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">History</h1>
      <nav
        aria-label="Filter by type"
        className="flex gap-0.5 self-start rounded-lg bg-hover p-[3px]"
      >
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/history" : `/history?type=${f.value}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-[30px] items-center rounded-md px-3 text-[13px] font-medium text-subtle-foreground hover:text-foreground",
                on &&
                  "bg-surface text-foreground shadow-[0_1px_2px_rgb(28_25_23/0.08),0_0_0_1px_var(--border)]",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-2 border-t border-border px-3 py-8 max-md:px-0">
          <span className="text-sm font-semibold">No saved outputs yet</span>
          <span className="text-[13px] text-subtle-foreground">
            Every standup, weekly summary and appraisal you generate is kept here.
          </span>
          <Link
            href="/generate"
            className="text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            Generate one →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col border-t border-border">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                href={`/generate?from=${g.id}`}
                className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-b border-border px-3 py-3.5 hover:bg-surface max-md:px-0 md:grid-cols-[104px_minmax(0,1fr)_88px]"
              >
                <span
                  className={cn(
                    "justify-self-start rounded-md px-2 text-xs leading-[22px] font-medium",
                    TYPE_STYLE[g.type],
                  )}
                >
                  {TYPE_LABEL[g.type]}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {formatRangeLabel({ start: g.rangeStart, end: g.rangeEnd })}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {outputPreview(g.output)}
                  </span>
                </div>
                <span className="col-start-2 font-mono text-xs text-muted-foreground md:col-start-auto md:text-right">
                  {formatInTimeZone(g.createdAt, tz, "dd MMM HH:mm")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
