import { Clock, List, PenLine, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: PenLine },
  { href: "/timeline", label: "Timeline", icon: List },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
