"use client";

import { useEffect } from "react";
import { adoptBrowserTimezone } from "@/server/actions/settings";

/** Saves the browser's zone the first time an account has none. */
export function TimezoneSync({ hasTimezone }: { hasTimezone: boolean }) {
  useEffect(() => {
    if (hasTimezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void adoptBrowserTimezone(tz);
  }, [hasTimezone]);
  return null;
}
