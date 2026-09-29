import { Skeleton } from "@/components/ui/skeleton";

const ROWS = [
  ["62%", "48px"],
  ["78%", null],
  ["54%", "40px"],
  ["70%", null],
  ["44%", "52px"],
] as const;

export function EntryListSkeleton({ groups = 1 }: { groups?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading entries"
      className="flex animate-pulse flex-col gap-3.5 p-3"
    >
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="flex flex-col gap-3.5">
          <Skeleton className="h-3 w-28 bg-border-strong" />
          {ROWS.map(([w, tag], i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-[34px]" />
              <Skeleton style={{ width: w }} />
              {tag ? <Skeleton style={{ width: tag }} /> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
