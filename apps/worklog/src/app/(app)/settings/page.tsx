import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireUserId } from "@/lib/auth";
import { formatTimeZoneLabel, resolveTimeZone } from "@/lib/dates";
import { getUserWithSettings, listLinkedProviders } from "@/lib/db/queries/users";

export const metadata: Metadata = { title: "Settings" };

const PROVIDER_NAMES: Record<string, string> = { github: "GitHub", google: "Google" };

function timeZoneOptions(current: string) {
  const zones = new Set<string>(Intl.supportedValuesOf("timeZone"));
  zones.add("UTC");
  zones.add(current);
  const now = new Date();
  return [...zones].sort().map((tz) => ({ value: tz, label: formatTimeZoneLabel(tz, now) }));
}

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [user, providers] = await Promise.all([
    getUserWithSettings(userId),
    listLinkedProviders(userId),
  ]);
  if (!user) return null;
  const tz = resolveTimeZone(user.timezone);
  const name = user.name || user.email?.split("@")[0] || "You";
  const method = providers.map((p) => PROVIDER_NAMES[p] ?? p).join(" and ") || "email link";

  return (
    <SettingsForm
      account={{ name, email: user.email ?? "", initial: name.charAt(0).toUpperCase(), method }}
      timeZones={timeZoneOptions(tz)}
      defaults={{
        timezone: tz,
        reminderEnabled: user.settings.reminderEnabled,
        reminderTime: user.settings.reminderTime.slice(0, 5),
        defaultTone: user.settings.defaultTone,
        standupFormat: user.settings.standupFormat,
      }}
    />
  );
}
