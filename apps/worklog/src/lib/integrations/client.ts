"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { pluralize } from "@/lib/utils";
import type { SyncRequest } from "@/lib/validators";
import { PROVIDER_NAMES, type IntegrationProviderId, type SyncResult } from "./types";

export function joinProviders(providers: IntegrationProviderId[]): string {
  return providers.map((p) => PROVIDER_NAMES[p]).join(" and ");
}

export type SyncSummary = { tone: "success" | "info" | "error"; message: string };

/** The toast for a finished sync. Null when there's nothing to say (every provider was skipped). */
export function describeSync(result: SyncResult): SyncSummary | null {
  const ran = result.providers.filter((p) => p.status !== "skipped");
  const failed = ran.filter((p) => p.status === "error");
  if (result.imported > 0) {
    const from = joinProviders(ran.filter((p) => p.imported > 0).map((p) => p.provider));
    return {
      tone: "success",
      message: `Imported ${pluralize(result.imported, "entry", "entries")} from ${from}`,
    };
  }
  if (failed.length > 0) {
    const first = failed[0]!;
    return { tone: "error", message: `${PROVIDER_NAMES[first.provider]}: ${first.error}` };
  }
  if (ran.length === 0) return null;
  return { tone: "info", message: `Nothing new from ${joinProviders(ran.map((p) => p.provider))}` };
}

/** The first error a sync reported, for the warning dot on the sync button. */
export function firstSyncError(result: SyncResult): string | null {
  const failed = result.providers.find((p) => p.status === "error");
  return failed ? `${PROVIDER_NAMES[failed.provider]}: ${failed.error}` : null;
}

/**
 * Calls POST /api/sync, refreshes the page when entries arrive, and reports the
 * outcome in a toast. `quiet` (automatic syncs) only speaks up when something was imported.
 */
export function useSync() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (body: SyncRequest, { quiet = false } = {}): Promise<SyncResult | null> => {
      setSyncing(true);
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(err?.message ?? "Couldn't sync.");
        }
        const result = (await res.json()) as SyncResult;
        if (result.imported > 0) router.refresh();
        const summary = describeSync(result);
        if (summary && (!quiet || summary.tone === "success")) {
          if (summary.tone === "error") toast.error(summary.message);
          else if (summary.tone === "success") toast.success(summary.message);
          else toast(summary.message);
        }
        return result;
      } catch (error) {
        if (!quiet) toast.error(error instanceof Error ? error.message : "Couldn't sync.");
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [router],
  );

  return { sync, syncing };
}
