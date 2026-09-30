"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

export type ShellUser = { name: string; timezone: string; initial: string };

export function Avatar({ user, size = 28 }: { user: ShellUser; size?: number }) {
  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-avatar font-semibold text-avatar-foreground"
      style={{ width: size, height: size, fontSize: size * 0.43 }}
    >
      {user.initial}
    </div>
  );
}

export function Sidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col gap-7 border-r border-border px-3 py-5 md:flex"
    >
      <Link href="/today" className="flex h-8 items-center px-2.5" aria-label="Worklog, today">
        <Logo />
      </Link>
      <div className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-subtle-foreground hover:bg-hover hover:text-foreground",
                on &&
                  "bg-primary-soft font-medium text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              <span className="grow">{label}</span>
            </Link>
          );
        })}
      </div>
      <Link
        href="/settings"
        className="mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover"
      >
        <Avatar user={user} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.timezone}</span>
        </div>
      </Link>
    </nav>
  );
}
