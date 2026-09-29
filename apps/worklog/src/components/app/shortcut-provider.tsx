"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import {
  GENERATE_EVENT,
  isTypingTarget,
  useWindowKeydown,
  type GenerateShortcutType,
} from "@/hooks/use-shortcuts";

const SECOND_KEY: Record<string, GenerateShortcutType> = {
  s: "standup",
  w: "weekly",
  a: "appraisal",
};

/**
 * Global shortcuts:
 *   N          focus the entry input (on Today)
 *   /          search the timeline
 *   G then S   generate a standup; W weekly; A appraisal
 * Enter, Escape and ⌘C belong to the components that own them.
 */
export function ShortcutProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const pendingG = useRef<number | null>(null);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const type = SECOND_KEY[key];
        if (type) {
          event.preventDefault();
          if (pathname === "/generate") {
            window.dispatchEvent(
              new CustomEvent<GenerateShortcutType>(GENERATE_EVENT, { detail: type }),
            );
          } else {
            router.push(`/generate?type=${type}&auto=1`);
          }
          return;
        }
      }

      if (key === "g") {
        pendingG.current = window.setTimeout(() => {
          pendingG.current = null;
        }, 1500);
        return;
      }
      if (key === "n") {
        event.preventDefault();
        const input = document.getElementById("entry-input");
        if (input) input.focus();
        else router.push("/today");
        return;
      }
      if (key === "/") {
        event.preventDefault();
        const search = document.getElementById("timeline-search");
        if (search) search.focus();
        else router.push("/timeline?focus=search");
      }
    },
    [pathname, router],
  );

  useWindowKeydown(onKeydown);
  return null;
}
