"use client";

import type { PostHog } from "posthog-js";

export type AnalyticsEvent =
  | "entry_created"
  | "entry_failed"
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "output_copied"
  | "plain_format_used";

let client: PostHog | null = null;

/** Loads PostHog only when a key is configured, so it never weighs down the bundle otherwise. */
export async function initAnalytics(key: string, host: string) {
  if (client) return;
  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: host,
    capture_pageview: "history_change",
    // Entries are private: never record text typed into inputs.
    autocapture: false,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
  });
  client = posthog;
}

/**
 * Product analytics. A no-op unless NEXT_PUBLIC_POSTHOG_KEY is set.
 * Never send entry or output text here: only counts, types and durations.
 */
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
) {
  client?.capture(event, properties);
}
