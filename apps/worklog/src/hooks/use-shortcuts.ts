"use client";

import { useEffect } from "react";

/** True when a keypress should go to the text field, not to app shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(type);
  }
  return false;
}

export const GENERATE_EVENT = "worklog:generate";
export type GenerateShortcutType = "standup" | "weekly" | "appraisal";

/** Listens for a keydown on window and cleans up on unmount. */
export function useWindowKeydown(handler: (event: KeyboardEvent) => void) {
  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

/** Only focus on load where there's a hardware keyboard. On phones, autofocus pops the keyboard up over the list. */
export function prefersAutofocus(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}
