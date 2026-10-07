"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // reset() alone only re-renders on the client, so an error thrown on the server
  // (a failed query, say) would come straight back. Fetch the page again first.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#fafaf9",
          color: "#1c1917",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#57534e", fontSize: 14 }}>
            Your entries are safe. Try again in a moment.
          </p>
          <button
            onClick={retry}
            style={{
              marginTop: 12,
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: 0,
              background: "#4f46e5",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
