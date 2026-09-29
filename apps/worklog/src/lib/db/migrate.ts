/**
 * Applies pending SQL migrations from ./drizzle. Run with `pnpm db:migrate`.
 * Used locally, in CI, and as the first step of the Vercel build.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log("Migrations applied."))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
