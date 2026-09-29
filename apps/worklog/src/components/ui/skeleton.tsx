import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("h-2.5 rounded-[5px] bg-border", className)} {...props} />;
}
