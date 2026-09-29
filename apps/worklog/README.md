# Worklog

Log one line per task. Worklog turns those lines into a **standup**, a **weekly summary** or **appraisal notes**, streamed by Claude into an editable box you can copy straight to Slack.

- **Logging takes under five seconds.** The input is focused on load, Enter saves, `#tag` adds a tag, `!blocker` flags a blocker.
- **Keyboard-first.** `N` focuses the input, `/` searches the timeline, `G` then `S`/`W`/`A` generates, and `⌘/Ctrl C` copies the output.
- **Calm, dense and mobile-ready.** Every screen works at 375 px, in light and dark.
- **Output is editable.** Generated text lands in an editable box. Your edits are what gets copied and saved.

## Quick start

```bash
nvm use                                  # Node 22.22+
corepack enable && pnpm install          # from the repo root
cd apps/worklog
cp .env.example .env.local               # then set AUTH_SECRET: openssl rand -base64 33
pnpm db:up                               # Postgres 17 in Docker (needs Docker Compose)
pnpm db:migrate
pnpm dev                                 # http://localhost:3000
```

**No keys needed for local dev:**

- **Sign-in:** enter any email on the login page. The magic link is printed in the terminal running `pnpm dev`.
- **Generation:** with no `ANTHROPIC_API_KEY`, the mock provider streams the plain format, so the whole UI works offline.

Without Docker Compose, start Postgres by hand:

```bash
docker run -d --name worklog-db -e POSTGRES_USER=worklog -e POSTGRES_PASSWORD=worklog \
  -e POSTGRES_DB=worklog -p 5432:5432 postgres:17-alpine
```

## Scripts

| Script                         | What it does                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start` | Next.js dev server / production build / serve                                      |
| `pnpm lint` / `typecheck`      | ESLint / `tsc --noEmit`                                                            |
| `pnpm test`                    | Unit and component tests (Vitest + React Testing Library)                          |
| `pnpm test:integration`        | Queries, server actions and `/api/generate` against real Postgres (Testcontainers) |
| `pnpm test:e2e`                | Playwright + axe against a production build, using the mock AI and test login      |
| `pnpm evals`                   | promptfoo evals of the real prompts (needs `ANTHROPIC_API_KEY`)                    |
| `pnpm db:generate`             | Generate a SQL migration from `src/lib/db/schema.ts`                               |
| `pnpm db:migrate`              | Apply migrations in `drizzle/`                                                     |
| `pnpm db:studio`               | Drizzle Studio                                                                     |

The integration tests start their own Postgres container. To use an existing database instead (for example a Neon branch), set `TEST_DATABASE_URL`. With Colima, export `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`.

## Environment

See [`.env.example`](.env.example) for every variable. Each integration switches on only when its keys are present:

| Variable                                   | Needed for                                          | Without it                                                                     |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                             | Everything                                          | App won't start                                                                |
| `AUTH_SECRET`                              | Sessions                                            | App won't start                                                                |
| `APP_URL`                                  | Links in emails                                     | Defaults to `http://localhost:3000`                                            |
| `AUTH_GITHUB_ID` / `_SECRET`               | "Continue with GitHub"                              | Button hidden                                                                  |
| `AUTH_GOOGLE_ID` / `_SECRET`               | "Continue with Google"                              | Button hidden                                                                  |
| `RESEND_API_KEY` + `EMAIL_FROM`            | Magic links and reminder emails                     | Dev: printed to the console. Prod: magic link hidden and reminders logged only |
| `ANTHROPIC_API_KEY`                        | AI generation                                       | Dev: mock provider. Prod: the UI offers the plain format                       |
| `ANTHROPIC_MODEL` / `ANTHROPIC_FAST_MODEL` | Model choice                                        | `claude-sonnet-5-5` / `claude-haiku-4-5-20251001`                              |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`        | Rate limiting (6/min, `GENERATION_DAILY_LIMIT`/day) | Not rate limited                                                               |
| `CRON_SECRET`                              | `/api/cron/reminders`                               | Endpoint returns 401                                                           |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`     | Error monitoring                                    | Off                                                                            |
| `NEXT_PUBLIC_POSTHOG_KEY`                  | Product analytics                                   | Off                                                                            |
| `AUTH_TEST_LOGIN_SECRET`                   | Password-less test login for Playwright             | Off. **Never set this in production.**                                         |

OAuth callback URLs are `{APP_URL}/api/auth/callback/github` and `{APP_URL}/api/auth/callback/google`.

## How it works

```
src/
├── app/
│   ├── (auth)/login/            # sign-in page + server actions
│   ├── (app)/                   # auth-guarded shell: sidebar (desktop), bottom tabs (mobile)
│   │   ├── today/               # log + list a day's entries
│   │   ├── timeline/            # search, tag/blocker filters, day groups, inline edit
│   │   ├── generate/            # standup / weekly / appraisal generator
│   │   ├── history/             # saved outputs
│   │   └── settings/            # zone, reminder, formats, theme, export, delete
│   └── api/
│       ├── generate/            # streaming LLM endpoint
│       ├── auth/[...nextauth]/  # Auth.js
│       ├── cron/reminders/      # hourly reminder sweep
│       └── export/              # Markdown / CSV download
├── components/                  # ui/ primitives, entries/, generate/, settings/, app/ shell
├── lib/
│   ├── db/                      # Drizzle schema, lazy client, migrator, queries/
│   ├── ai/                      # client, versioned prompts/, fallback, pipeline, output shape
│   ├── auth.ts                  # Auth.js config, only providers whose keys are set
│   ├── dates.ts                 # time-zone-aware ranges and labels
│   ├── parse-entry.ts           # #tags and !blocker
│   └── validators.ts            # Zod schemas shared by client and server
├── server/actions/              # entries, settings, auth
└── styles/globals.css           # design tokens (light + dark) as CSS variables
```

**Data.** Every query takes `userId` and filters on it. `entries` has an index on `(user_id, entry_date)`. `entry_date` is stored separately from `created_at`, so yesterday's work can be logged this morning (use ← on Today). Calendar days travel as `YYYY-MM-DD` strings. They only become instants through the user's zone (`lib/dates.ts`), which keeps DST shifts from moving a day.

**Generation.** `POST /api/generate` goes through five steps:

1. Checks the session and the rate limit.
2. Fetches the range in the user's zone.
3. Builds the prompt from a versioned template (`prompts/standup.v1.ts`, …).
4. Streams Claude's text.
5. Saves the result to `generations` with its prompt version and model.

The prompts keep entries safe:

- Entries sit inside `<entries>` delimiters.
- Anything in an entry that would open or close those delimiters is stripped.
- The model is told to treat entries as data, never as instructions.

Other details:

- For long appraisal ranges (more than one month and more than 40 entries), each month is summarized first with the fast model, then the monthly notes are combined.
- The route waits for the first chunk before answering 200, so provider failures come back as JSON (`AI_FAILED`, `AI_UNAVAILABLE`), and the UI then offers the **plain format**: entries listed as written, with no model involved.
- Every generator writes one text shape: `**Heading**` lines and `– ` bullets. The panel renders it with bold headings, and Copy puts both rich HTML and plain text on the clipboard.

**Optimistic UI.** Saving an entry clears the input straight away and shows the row immediately. If the save fails, the row goes away, the text comes back into the input, and a Retry appears. Deletes show an **Undo** toast, which restores the entry with its original id and timestamp.

## Deploying (Vercel + Neon)

1. **Neon.** Create a project and copy the _pooled_ connection string. The Neon ↔ Vercel integration gives each preview its own database branch.
2. **Vercel.** Import the repo and set **Root Directory** to `apps/worklog`. `vercel.json` runs `pnpm db:migrate && pnpm build`, so every deploy migrates its own database.
3. **Env vars.** Add the variables from the table above. At minimum, `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` and at least one sign-in method.
4. **Resend.** Verify your sending domain and set `EMAIL_FROM` to an address on it.
5. **Reminders.** The hourly trigger lives in `.github/workflows/worklog-reminders.yml`, because Vercel Hobby only allows daily crons. Set the repo variable `WORKLOG_APP_URL` and the secret `WORKLOG_CRON_SECRET` (the same value as `CRON_SECRET`). On Vercel Pro you can use Vercel Cron instead by adding this to `vercel.json`:
   ```json
   "crons": [{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }]
   ```
   Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.

## CI

`.github/workflows/worklog-ci.yml` runs on every PR that touches this app:

- **Checks:** format, lint, typecheck, then unit and component tests.
- **Integration:** tests against Postgres via Testcontainers.
- **E2E:** Playwright + axe against a production build, with a Postgres service container.
- **Prompt evals:** only when `src/lib/ai/prompts/**` changes, and only when the `ANTHROPIC_API_KEY` secret is set.

`worklog-e2e-preview.yml` can also run the Playwright suite against each Vercel preview. It's opt-in; see the comments in that file.

## What's in the MVP, and what's next

**MVP:**

- One-line entry input with `#tag` autocomplete
- Timeline with search and filters, inline edit, and delete with undo
- The three generators, with an editable output box and copy
- History of saved outputs
- Login with persistent storage
- Settings: time zone, daily email reminder, standup format, tone, theme
- Markdown and CSV export
- Account deletion

**Later:** projects, Slack delivery, team and manager views, and swipe-to-delete on mobile (today it's tap a row, then the delete button).
