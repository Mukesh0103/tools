// The browser SDK loads only when a DSN is configured, so it adds nothing to the bundle otherwise.
import type * as SentryNs from "@sentry/nextjs";

type SentryModule = typeof SentryNs;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentry: SentryModule | undefined;

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      dataCollection: { userInfo: false, httpBodies: [], genAI: { inputs: false, outputs: false } },
    });
    sentry = Sentry;
  });
}

export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
) {
  sentry?.captureRouterTransitionStart(...args);
}
