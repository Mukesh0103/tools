import { cn } from "@/lib/utils";

export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  const pad = Math.round(size / 4);
  return (
    <div
      aria-hidden
      className={cn("flex flex-col justify-center gap-[3px] rounded-md bg-logo", className)}
      style={{ width: size, height: size, padding: `0 ${pad}px` }}
    >
      <div className="h-0.5 rounded-[1px] bg-logo-line" />
      <div className="h-0.5 rounded-[1px] bg-logo-accent" style={{ width: size / 3 }} />
      <div className="h-0.5 rounded-[1px] bg-logo-line" style={{ width: (size * 5) / 12 }} />
    </div>
  );
}

export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Worklog</span>
    </div>
  );
}
