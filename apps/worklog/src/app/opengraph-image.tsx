import { ImageResponse } from "next/og";

export const alt = "Worklog — One line per task. Your standup writes itself.";
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
  logoBg: "#1c1917",
  logoLine: "#fafaf9",
  logoAccent: "#818cf8",
};

const HEADLINE = ["One line per task.", "Your standup writes itself."];
const LOG = [
  { time: "10:20", text: "Sprint planning" },
  { time: "13:05", text: "Fixed invoices pagination" },
  { time: "15:32", text: "Waiting on DB creds", blocker: true },
];
const STANDUP = [
  { heading: "Today", items: ["Sprint planning", "Fixed invoices pagination"] },
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
    ...HEADLINE,
    ...STANDUP.flatMap((s) => [s.heading, ...s.items]),
    " –→",
  ].join("");
  const monoText = [...LOG.flatMap((l) => [l.time, l.text]), " !blocker"].join("");
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 66,
          fontWeight: 600,
          lineHeight: 1.08,
          letterSpacing: -2.2,
        }}
      >
        <span>{HEADLINE[0]}</span>
        <span style={{ color: c.muted }}>{HEADLINE[1]}</span>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 24 }}>
        <div
          style={{
            ...card,
            flex: 1.2,
            justifyContent: "center",
            fontFamily: "JetBrains Mono",
            fontSize: 19,
            whiteSpace: "nowrap",
            color: c.subtle,
          }}
        >
          {LOG.map((entry) => (
            <div key={entry.time} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: c.muted }}>{entry.time}</span>
              <span>{entry.text}</span>
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

        <div style={{ ...card, gap: 2, color: c.subtle }}>
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
