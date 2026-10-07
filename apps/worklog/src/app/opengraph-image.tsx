import { ImageResponse } from "next/og";

export const alt =
  "Worklog — Standup, sorted. Log one line per task, or let GitHub and Jira do it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Light-theme tokens from globals.css.
const c = {
  background: "#fafaf9",
  surface: "#ffffff",
  foreground: "#1c1917",
  muted: "#78716c",
  subtle: "#57534e",
  border: "#e7e5e4",
  blockerSoft: "#fef2f2",
  blockerForeground: "#b91c1c",
  prMerged: "#8250df",
  logoBg: "#1c1917",
  logoLine: "#fafaf9",
  logoAccent: "#818cf8",
};

// The same copy and sample day as the login page.
const HEADLINE = "Standup, sorted.";
const SUBLINE = "Log one line per task, or let GitHub and Jira do it.";
const LOG: { time: string; text: string; status?: string; blocker?: boolean }[] = [
  { time: "10:20", text: "Sprint planning" },
  { time: "13:05", status: "Merged", text: "- PAYM-7 - Add Okta SSO #128" },
  { time: "14:40", text: "Moved PAYM-9 to Done: Retry payouts" },
  { time: "15:32", text: "Waiting on DB creds", blocker: true },
];
const STANDUP = [
  {
    heading: "Today",
    items: [
      "Sprint planning",
      "Merged - PAYM-7 - Add Okta SSO #128",
      "Moved PAYM-9 to Done: Retry payouts",
    ],
  },
  { heading: "Blockers", items: ["Waiting on DB creds"] },
];

// Satori needs TTF/OTF, so fetch a subset from Google Fonts. On failure the image falls back
// to next/og's bundled font instead of failing the build.
async function loadFont(family: string, weight: 400 | 600, text: string) {
  try {
    const params = new URLSearchParams({ family: `${family}:wght@${weight}`, text });
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${params}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    if (!res.ok) return null;
    return { name: family, data: await res.arrayBuffer(), weight, style: "normal" as const };
  } catch {
    return null;
  }
}

function LogoMark({ size }: { size: number }) {
  const line = { height: 3, borderRadius: 1.5 };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 5,
        width: size,
        height: size,
        padding: `0 ${size / 4}px`,
        borderRadius: size / 4,
        background: c.logoBg,
      }}
    >
      <div style={{ ...line, background: c.logoLine }} />
      <div style={{ ...line, width: size / 3, background: c.logoAccent }} />
      <div style={{ ...line, width: (size * 5) / 12, background: c.logoLine }} />
    </div>
  );
}

const card = {
  display: "flex",
  flexDirection: "column" as const,
  flex: 1,
  gap: 6,
  padding: "22px 26px",
  borderRadius: 14,
  border: `1px solid ${c.border}`,
  background: c.surface,
  fontSize: 21,
  lineHeight: 1.45,
};

export default async function OpengraphImage() {
  const sansText = [
    "Worklog",
    HEADLINE,
    SUBLINE,
    ...STANDUP.flatMap((s) => [s.heading, ...s.items]),
    " –→",
  ].join("");
  const monoText = [...LOG.flatMap((l) => [l.time, l.status ?? "", l.text]), " !blocker"].join("");
  const fonts = (
    await Promise.all([
      loadFont("Inter", 400, sansText),
      loadFont("Inter", 600, sansText),
      loadFont("JetBrains Mono", 400, monoText),
    ])
  ).filter((font) => font !== null);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "60px 72px 64px",
        background: c.background,
        color: c.foreground,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <LogoMark size={40} />
        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.3 }}>Worklog</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2.5 }}>
          {HEADLINE}
        </span>
        <span style={{ fontSize: 30, lineHeight: 1.3, color: c.subtle }}>{SUBLINE}</span>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 24 }}>
        <div
          style={{
            ...card,
            flex: 1.2,
            justifyContent: "center",
            fontFamily: "JetBrains Mono",
            fontSize: 18,
            whiteSpace: "nowrap",
            color: c.subtle,
          }}
        >
          {LOG.map((entry) => (
            <div key={entry.time} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: c.muted }}>{entry.time}</span>
              <span style={{ display: "flex", gap: 10 }}>
                {entry.status ? <span style={{ color: c.prMerged }}>{entry.status}</span> : null}
                <span>{entry.text}</span>
              </span>
              {entry.blocker ? (
                <span
                  style={{
                    padding: "0 8px",
                    borderRadius: 6,
                    background: c.blockerSoft,
                    color: c.blockerForeground,
                  }}
                >
                  !blocker
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", fontSize: 34, color: c.muted }}>→</div>

        <div style={{ ...card, gap: 2, fontSize: 18, color: c.subtle }}>
          {STANDUP.map((section) => (
            <div key={section.heading} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, color: c.foreground }}>{section.heading}</span>
              {section.items.map((item) => (
                <span key={item}>– {item}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
