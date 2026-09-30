import "server-only";
import { Resend } from "resend";
import { escapeHtml } from "./generate/output";

export function appUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendReminderEmail(to: { email: string; name: string | null }): Promise<void> {
  const link = `${appUrl()}/today`;
  const greeting = to.name ? `Hi ${to.name.split(" ")[0]},` : "Hi,";
  const text = `${greeting}\n\nYou haven't logged anything today. One line per task is enough:\n${link}\n\nTurn these reminders off in Settings.`;
  const html = `<div style="font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1C1917">
<p>${escapeHtml(greeting)}</p>
<p>You haven’t logged anything today. One line per task is enough.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:500">Log your day</a></p>
<p style="color:#78716C;font-size:13px">Turn these reminders off in <a href="${escapeHtml(`${appUrl()}/settings`)}" style="color:#4F46E5">Settings</a>.</p>
</div>`;

  if (!emailConfigured()) {
    console.info(`[worklog] Reminder for ${to.email} (email not configured):\n${text}`);
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: to.email,
    subject: "Log your day in Worklog",
    text,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
