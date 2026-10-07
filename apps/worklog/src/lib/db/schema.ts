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
  uniqueIndex,
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

export const entrySource = pgEnum("entry_source", ["manual", "github", "jira"]);

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
    isBlocker: boolean().notNull().default(false),
    source: entrySource().notNull().default("manual"),
    /** Stable id of the imported activity (see lib/integrations/activity.ts), so a sync
     *  never adds the same pull request or issue move twice. Null for typed entries. */
    externalId: text(),
    /** Link back to the pull request or issue. Null for typed entries. */
    url: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("entries_user_date_idx").on(t.userId, t.entryDate),
    // NULLs never collide, so typed entries are unaffected.
    uniqueIndex("entries_user_external_idx").on(t.userId, t.externalId),
  ],
);

/** Imported activity the user deleted. Sync skips these so they don't come back. */
export const entryDismissals = pgTable(
  "entry_dismissals",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    externalId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.externalId] })],
);

export const integrationProvider = pgEnum("integration_provider", ["github", "jira"]);

export const integrations = pgTable(
  "integrations",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: integrationProvider().notNull(),
    /** GitHub login, or Jira account id. Used to pick out the user's own activity. */
    accountId: text().notNull(),
    /** Shown in Settings, e.g. "@octocat" or "Ada Lovelace". */
    displayName: text().notNull(),
    /** Jira only: site origin ("https://acme.atlassian.net") and the email the token belongs to. */
    siteUrl: text(),
    email: text(),
    /** Jira only: where API calls go when it isn't the site. Atlassian's gateway, for tokens with scopes. */
    apiUrl: text(),
    /** The API token, encrypted with lib/integrations/crypto.ts. Never sent to the client. */
    secret: text().notNull(),
    lastSyncedAt: timestamp({ withTimezone: true }),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("generations_user_created_idx").on(t.userId, t.createdAt)],
);

export const standupFormat = pgEnum("standup_format", ["ytb", "bullets", "paragraph"]);

export const settings = pgTable("settings", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  reminderTime: time().notNull().default("18:00:00"),
  reminderEnabled: boolean().notNull().default(false),
  /** Local calendar date of the last reminder sent, so the cron never double-sends. */
  lastRemindedOn: date({ mode: "string" }),
  standupFormat: standupFormat().notNull().default("ytb"),
  /** Summarise imported pull requests with Claude. Only used when ANTHROPIC_API_KEY is set. */
  aiSummaries: boolean().notNull().default(true),
});

export type User = typeof users.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type GenerationType = (typeof generationType.enumValues)[number];
export type StandupFormat = (typeof standupFormat.enumValues)[number];
export type Settings = typeof settings.$inferSelect;
export type EntrySource = (typeof entrySource.enumValues)[number];
export type Integration = typeof integrations.$inferSelect;
export type IntegrationProvider = (typeof integrationProvider.enumValues)[number];
