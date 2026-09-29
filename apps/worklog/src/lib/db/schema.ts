import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ─── Auth.js tables ────────────────────────────────────────────────────────
 * Shapes follow @auth/drizzle-adapter. `users` carries the app's own
 * `timezone` and `created_at` columns on top of the adapter's.
 */

export const users = pgTable("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp({ mode: "date", withTimezone: true }),
  image: text(),
  /** IANA zone, e.g. "Asia/Kolkata". Null until the browser reports one. */
  timezone: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().$type<"oauth" | "oidc" | "email" | "webauthn">().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp({ mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ─── App tables ──────────────────────────────────────────────────────────── */

export const entries = pgTable(
  "entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Calendar day the work belongs to, in the user's zone. Separate from
     *  created_at because people log yesterday's work the next morning. */
    entryDate: date({ mode: "string" }).notNull(),
    text: text().notNull(),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isBlocker: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("entries_user_date_idx").on(t.userId, t.entryDate)],
);

export const generationType = pgEnum("generation_type", ["standup", "weekly", "appraisal"]);

export const generations = pgTable(
  "generations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: generationType().notNull(),
    rangeStart: date({ mode: "string" }).notNull(),
    rangeEnd: date({ mode: "string" }).notNull(),
    output: text().notNull(),
    promptVersion: text().notNull(),
    model: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("generations_user_created_idx").on(t.userId, t.createdAt)],
);

export const tone = pgEnum("tone", ["concise", "detailed"]);
export const standupFormat = pgEnum("standup_format", ["ytb", "bullets", "paragraph"]);

export const settings = pgTable("settings", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Local wall-clock time, "HH:MM:SS". */
  reminderTime: time().notNull().default("18:00:00"),
  reminderEnabled: boolean().notNull().default(false),
  /** Local calendar date of the last reminder sent, so the cron never double-sends. */
  lastRemindedOn: date({ mode: "string" }),
  defaultTone: tone().notNull().default("concise"),
  standupFormat: standupFormat().notNull().default("ytb"),
});

export type User = typeof users.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type GenerationType = (typeof generationType.enumValues)[number];
export type Tone = (typeof tone.enumValues)[number];
export type StandupFormat = (typeof standupFormat.enumValues)[number];
export type Settings = typeof settings.$inferSelect;
