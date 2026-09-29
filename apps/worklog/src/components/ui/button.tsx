import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary font-medium text-primary-foreground hover:bg-primary-hover [&_kbd]:border-white/30 [&_kbd]:bg-white/15 [&_kbd]:text-white dark:[&_kbd]:border-black/20 dark:[&_kbd]:bg-black/10 dark:[&_kbd]:text-primary-foreground",
        ghost: "border border-border bg-surface text-foreground hover:bg-hover",
        soft: "border border-primary-soft-border bg-primary-soft text-primary-soft-foreground",
        icon: "text-muted-foreground hover:bg-hover hover:text-foreground",
        danger:
          "border border-blocker-border bg-surface font-medium text-blocker-soft-foreground hover:bg-blocker-soft",
        destructive: "bg-blocker font-medium text-white hover:opacity-90 dark:text-[#1c1917]",
        link: "h-auto px-0 font-medium text-primary hover:text-primary-hover",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-3.5 text-sm",
        lg: "h-11 px-4 text-sm font-medium",
        icon: "size-8 rounded-md p-0",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: { variant: "ghost", size: "sm" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
