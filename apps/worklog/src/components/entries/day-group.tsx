import { formatDayHeading } from "@/lib/dates";
import type { EntryView } from "@/lib/entry-view";
import { pluralize } from "@/lib/utils";
import { EntryItem, type EntryItemProps } from "./entry-item";

export function DayGroup({
  date,
  today,
  entries,
  freshId,
  onUpdate,
  onDelete,
}: {
  date: string;
  today: string;
  entries: EntryView[];
  freshId?: string | null;
} & Pick<EntryItemProps, "onUpdate" | "onDelete">) {
  const headingId = `day-${date}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-0.5">
      <div className="sticky top-0 z-10 flex items-baseline gap-2.5 border-b border-border bg-background/95 px-3 pt-2.5 pb-2 backdrop-blur-sm max-md:px-0">
        <h2 id={headingId} className="text-sm font-semibold">
          {formatDayHeading(date, today)}
        </h2>
        <span className="text-xs text-muted-foreground">
          {pluralize(entries.length, "entry", "entries")}
        </span>
      </div>
      {entries.map((entry) => (
        <EntryItem
          key={entry.id}
          entry={entry}
          fresh={entry.id === freshId}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
