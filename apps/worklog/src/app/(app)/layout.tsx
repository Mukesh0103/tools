import { redirect } from "next/navigation";
import { BottomTabs } from "@/components/app/bottom-tabs";
import { DailyReminder } from "@/components/app/daily-reminder";
import { ShortcutProvider } from "@/components/app/shortcut-provider";
import { Sidebar } from "@/components/app/sidebar";
import { TimezoneSync } from "@/components/app/timezone-sync";
import { auth } from "@/lib/auth";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { hasEntriesOn } from "@/lib/db/queries/entries";
import { getUserWithSettings } from "@/lib/db/queries/users";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await getUserWithSettings(session.user.id);
  if (!user) redirect("/login");

  const name = user.name || user.email?.split("@")[0] || "You";
  const timezone = resolveTimeZone(user.timezone);
  const shellUser = {
    name,
    timezone,
    initial: name.charAt(0).toUpperCase(),
  };
  const { reminderEnabled, reminderTime, lastRemindedOn } = user.settings;
  const today = todayInZone(timezone);
  const loggedToday = reminderEnabled && (await hasEntriesOn(user.id, today));

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={shellUser} />
      <main className="flex min-w-0 grow justify-center pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <BottomTabs />
      <ShortcutProvider />
      <TimezoneSync hasTimezone={Boolean(user.timezone)} />
      {reminderEnabled ? (
        <DailyReminder
          // A new time starts fresh, even if the reminder was closed earlier today.
          key={reminderTime}
          tz={timezone}
          today={today}
          reminderTime={reminderTime.slice(0, 5)}
          loggedToday={loggedToday}
          dismissedOn={lastRemindedOn}
        />
      ) : null}
    </div>
  );
}
