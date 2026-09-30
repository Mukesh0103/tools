import type { Metadata } from "next";
import { GeneratorPanel, type SavedGeneration } from "@/components/generate/generator-panel";
import { requireUserId } from "@/lib/auth";
import { resolveTimeZone, todayInZone } from "@/lib/dates";
import { getGeneration } from "@/lib/db/queries/generations";
import { getUserWithSettings } from "@/lib/db/queries/users";
import type { GenerationType } from "@/lib/db/schema";
import { defaultRanges, rangePresets } from "@/lib/range-presets";
import { formatInTimeZone } from "date-fns-tz";

export const metadata: Metadata = { title: "Generate" };

const TYPES: GenerationType[] = ["standup", "weekly", "appraisal"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { type?: string; auto?: string; from?: string };

export default async function GeneratePage({ searchParams }: { searchParams: Promise<Params> }) {
  const userId = await requireUserId();
  const [user, params] = await Promise.all([getUserWithSettings(userId), searchParams]);
  const tz = resolveTimeZone(user?.timezone);
  const now = new Date();
  const type = TYPES.includes(params.type as GenerationType)
    ? (params.type as GenerationType)
    : "standup";

  let saved: SavedGeneration | undefined;
  if (params.from && UUID.test(params.from)) {
    const row = await getGeneration(userId, params.from);
    if (row) {
      saved = {
        id: row.id,
        type: row.type,
        range: { start: row.rangeStart, end: row.rangeEnd },
        output: row.output,
        savedLabel: `Saved ${formatInTimeZone(row.createdAt, tz, "d MMM HH:mm")}`,
      };
    }
  }

  return (
    <GeneratorPanel
      key={saved?.id ?? "new"}
      initialType={type}
      defaultRanges={defaultRanges(tz, now)}
      presets={rangePresets(tz, now)}
      today={todayInZone(tz, now)}
      standupFormat={user?.settings.standupFormat ?? "ytb"}
      autoStart={params.auto === "1" && !saved}
      saved={saved}
    />
  );
}
