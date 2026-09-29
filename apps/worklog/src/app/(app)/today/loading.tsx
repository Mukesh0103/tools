import { EntryListSkeleton } from "@/components/entries/entry-list-skeleton";

export default function Loading() {
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-7 px-5 pt-14 md:px-0">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-32 rounded-md bg-border" />
        <div className="h-3.5 w-44 rounded-md bg-border" />
      </div>
      <div className="hidden h-[54px] rounded-lg border border-border bg-surface md:block" />
      <EntryListSkeleton />
    </div>
  );
}
