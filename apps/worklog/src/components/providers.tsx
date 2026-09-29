"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key)
      void initAnalytics(key, process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com");
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
