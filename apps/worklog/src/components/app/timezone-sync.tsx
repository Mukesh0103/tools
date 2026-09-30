"use client";

import { useEffect } from "react";
import { adoptBrowserTimezone } from "@/server/actions/settings";

export function TimezoneSync({ hasTimezone }: { hasTimezone: boolean }) {
  useEffect(() => {
    if (hasTimezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void adoptBrowserTimezone(tz);
  }, [hasTimezone]);
  return null;
}
