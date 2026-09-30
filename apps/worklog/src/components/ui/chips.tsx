import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function BlockerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-blocker-soft px-[7px] text-xs leading-5 font-medium text-blocker-soft-foreground",
        className,
      )}
    >
      <CircleAlert className="size-3" strokeWidth={2.25} aria-hidden />
      Blocker
    </span>
  );
}
