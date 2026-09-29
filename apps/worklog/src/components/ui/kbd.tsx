import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-sm border border-b-2 border-kbd-border bg-kbd px-1.5 py-px font-mono text-[11px] leading-4 text-kbd-foreground",
        className,
      )}
      {...props}
    />
  );
}
