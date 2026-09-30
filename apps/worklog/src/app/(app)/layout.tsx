import { redirect } from "next/navigation";
import { BottomTabs } from "@/components/app/bottom-tabs";
import { ShortcutProvider } from "@/components/app/shortcut-provider";
import { Sidebar } from "@/components/app/sidebar";
import { TimezoneSync } from "@/components/app/timezone-sync";
import { auth } from "@/lib/auth";
import { resolveTimeZone } from "@/lib/dates";
import { getUserWithSettings } from "@/lib/db/queries/users";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await getUserWithSettings(session.user.id);
  if (!user) redirect("/login");

  const name = user.name || user.email?.split("@")[0] || "You";
  const shellUser = {
    name,
    timezone: resolveTimeZone(user.timezone),
    initial: name.charAt(0).toUpperCase(),
  };

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={shellUser} />
      <main className="flex min-w-0 grow justify-center pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <BottomTabs />
      <ShortcutProvider />
      <TimezoneSync hasTimezone={Boolean(user.timezone)} />
    </div>
  );
}
