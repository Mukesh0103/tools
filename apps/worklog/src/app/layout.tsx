import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

const shareTitle = "Worklog — Standup, sorted.";
const description =
  "Log one line per task, or let GitHub and Jira do it. Worklog turns your day into a standup, weekly summary or appraisal notes, ready to paste into Slack.";
// Without APP_URL, Next falls back to the Vercel deployment URL (or localhost in dev).
const siteUrl = process.env.APP_URL || process.env.AUTH_URL;

export const metadata: Metadata = {
  // Origin only: Next resolves image URLs under metadataBase's path in production builds.
  metadataBase: siteUrl ? new URL("/", siteUrl) : undefined,
  title: { default: "Worklog", template: "%s · Worklog" },
  description,
  applicationName: "Worklog",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Worklog",
    locale: "en_US",
    title: shareTitle,
    description,
  },
  twitter: { card: "summary_large_image", title: shareTitle, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
