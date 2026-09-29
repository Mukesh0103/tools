import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      // Entries and outputs are private, so keep request bodies, AI prompts/outputs,
      // query data and local variables out of Sentry.
      dataCollection: {
        userInfo: false,
        httpBodies: [],
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        stackFrameVariables: false,
      },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
