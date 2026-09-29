"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-border-strong transition-colors disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-[18px] translate-x-[3px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform data-[state=checked]:translate-x-[19px]" />
    </SwitchPrimitive.Root>
  );
}
