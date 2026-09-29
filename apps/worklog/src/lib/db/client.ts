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
const globalForDb = globalThis as unknown as { __worklogDb?: Db; __worklogDbUrl?: string };

/** Lazily connects, so importing this module never needs DATABASE_URL (e.g. during `next build`). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  if (!globalForDb.__worklogDb || globalForDb.__worklogDbUrl !== url) {
    globalForDb.__worklogDb = create(url);
    globalForDb.__worklogDbUrl = url;
  }
  return globalForDb.__worklogDb;
}
