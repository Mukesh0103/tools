import { EntryListSkeleton } from "@/components/entries/entry-list-skeleton";

export default function Loading() {
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-5 px-5 pt-14 md:px-0">
      <div className="h-7 w-36 rounded-md bg-border" />
      <div className="h-10 rounded-lg border border-border bg-surface" />
      <EntryListSkeleton groups={2} />
    </div>
  );
}
