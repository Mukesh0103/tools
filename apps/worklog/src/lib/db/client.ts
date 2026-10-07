import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function create(url: string) {
  const client = postgres(url, {
    // Poolers (Neon, Supabase) run in transaction mode, which can't hold prepared statements.
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof create>;

// Cached on globalThis so dev hot reloads don't open a new pool each time.
const globalForDb = globalThis as unknown as {
  __worklogDb?: Db;
  __worklogDbUrl?: string;
  __worklogDbSchema?: typeof schema;
};

/** Lazily connects, so importing this module never needs DATABASE_URL (e.g. during `next build`). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  // Editing schema.ts in dev reloads it. A client built from the previous copy mixes old and
  // new table objects, and Drizzle then fails mid-query, so rebuild when the schema changes.
  if (
    !globalForDb.__worklogDb ||
    globalForDb.__worklogDbUrl !== url ||
    globalForDb.__worklogDbSchema !== schema
  ) {
    void globalForDb.__worklogDb?.$client.end({ timeout: 5 }).catch(() => {});
    globalForDb.__worklogDb = create(url);
    globalForDb.__worklogDbUrl = url;
    globalForDb.__worklogDbSchema = schema;
  }
  return globalForDb.__worklogDb;
}
