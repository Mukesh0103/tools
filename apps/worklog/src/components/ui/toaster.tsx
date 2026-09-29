"use client";

import { Check } from "lucide-react";
import { Toaster as Sonner } from "sonner";

/** Bottom-center, dark, auto-dismisses. The design's "Copied" toast. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: 96 }}
      duration={2400}
      icons={{ success: <Check className="size-[15px] text-inverse-accent" strokeWidth={2.25} /> }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex min-h-10 items-center gap-2.5 rounded-lg bg-inverse px-3.5 py-2 text-[13px] text-inverse-foreground shadow-[0_8px_24px_rgb(28_25_23/0.18)]",
          actionButton:
            "ml-auto rounded-md px-2 py-1 text-[13px] font-medium text-inverse-accent hover:underline",
          error: "!bg-blocker-soft-foreground !text-white",
        },
      }}
    />
  );
}
