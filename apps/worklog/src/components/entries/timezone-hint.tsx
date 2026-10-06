"use client";

import { Globe } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isValidTimeZone, sameUtcOffset } from "@/lib/dates";
import { switchTimezone } from "@/server/actions/settings";

const storageKey = (saved: string, device: string) => `worklog:tz-hint:${saved}>${device}`;

/**
 * Worklog decides where "today" starts in the zone saved in Settings. When that
 * zone and the device's zone disagree, days roll over at an hour the user doesn't
 * expect. This hint names the mismatch and offers a one-click switch.
 */
export function TimezoneHint({ savedTz }: { savedTz: string }) {
  const [deviceTz, setDeviceTz] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || !isValidTimeZone(tz) || sameUtcOffset(tz, savedTz)) return;
    try {
      if (window.localStorage.getItem(storageKey(savedTz, tz))) return;
    } catch {
      // Storage blocked: show the hint anyway.
    }
    setDeviceTz(tz);
  }, [savedTz]);

  if (!deviceTz) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey(savedTz, deviceTz!), "1");
    } catch {
      // Storage blocked: hide it for this visit only.
    }
    setDeviceTz(null);
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-3 text-[13px] sm:flex-row sm:items-center"
    >
      <Globe className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <p className="grow leading-normal text-subtle-foreground">
        Your days follow <span className="font-medium text-foreground">{savedTz}</span>, but this
        device is set to <span className="font-medium text-foreground">{deviceTz}</span>.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await switchTimezone(deviceTz);
              if (res.ok) setDeviceTz(null);
              else toast.error(res.error);
            })
          }
        >
          Use {deviceTz.split("/").at(-1)?.replace(/_/g, " ")}
        </Button>
        <Button size="sm" onClick={dismiss}>
          Keep
        </Button>
      </div>
    </div>
  );
}
