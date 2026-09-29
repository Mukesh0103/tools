import { Clock, List, PenLine, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; shortcut?: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: PenLine, shortcut: "N" },
  { href: "/timeline", label: "Timeline", icon: List, shortcut: "/" },
  { href: "/generate", label: "Generate", icon: Sparkles, shortcut: "G" },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
