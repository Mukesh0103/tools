# Worklog

Log one line per task. Worklog turns those lines into a **standup**, a **weekly summary** or **appraisal notes**, built from your entries in an editable box you can copy straight to Slack.

- **Logging takes under five seconds.** The input is focused on load, Enter saves, `!blocker` flags a blocker.
- **Keyboard-first.** `N` focuses the input, `/` searches the timeline, `G` then `W`/`A` generates a weekly summary or appraisal notes, and `⌘/Ctrl C` copies the output.
- **Calm, dense and mobile-ready.** Every screen works at 375 px, in light and dark.
- **Output is editable.** Generated text lands in an editable box. Your edits are what gets copied and saved.
- **Or don't write at all.** Connect GitHub and Jira, and the pull requests you open, merge and review, and the issues you move, show up as entries on their own. With an Anthropic key, Claude writes each pull request's line from its description, commits and changed files.

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
- **Generation:** needs no keys. Outputs are built straight from your entries.

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
| `pnpm test:e2e`                | Playwright + axe against a production build, using the test login                  |
| `pnpm db:generate`             | Generate a SQL migration from `src/lib/db/schema.ts`                               |
| `pnpm db:migrate`              | Apply migrations in `drizzle/`                                                     |
| `pnpm db:studio`               | Drizzle Studio                                                                     |

The integration tests start their own Postgres container. To use an existing database instead (for example a Neon branch), set `TEST_DATABASE_URL`. With Colima, export `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`.

## Environment

See [`.env.example`](.env.example) for every variable. Each integration switches on only when its keys are present:

| Variable                               | Needed for                              | Without it                                                                     |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                         | Everything                              | App won't start                                                                |
| `AUTH_SECRET`                          | Sessions                                | App won't start                                                                |
| `APP_URL`                              | Links in emails                         | Defaults to `http://localhost:3000`                                            |
| `AUTH_GITHUB_ID` / `_SECRET`           | "Continue with GitHub"                  | Button hidden                                                                  |
| `AUTH_GOOGLE_ID` / `_SECRET`           | "Continue with Google"                  | Button hidden                                                                  |
| `RESEND_API_KEY` + `EMAIL_FROM`        | Magic links and reminder emails         | Dev: printed to the console. Prod: magic link hidden and reminders logged only |
| `CRON_SECRET`                          | `/api/cron/sync`, `/api/cron/reminders` | Endpoints return 401                                                           |
| `ANTHROPIC_API_KEY`                    | AI summaries of imported pull requests  | The pull request title is used (prefix like `feat:` removed)                   |
| `ANTHROPIC_MODEL`                      | Picking the summary model               | `claude-opus-5-5`                                                              |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring                        | Off                                                                            |
| `NEXT_PUBLIC_POSTHOG_KEY`              | Product analytics                       | Off                                                                            |
| `AUTH_TEST_LOGIN_SECRET`               | Password-less test login for Playwright | Off. **Never set this in production.**                                         |

OAuth callback URLs are `{APP_URL}/api/auth/callback/github` and `{APP_URL}/api/auth/callback/google`.

GitHub and Jira need no server keys. Each user connects their own account in **Settings → Integrations**, with a token:

- **GitHub:** a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with read-only **Pull requests** access to the repos you work in. A classic token with `repo` also works. Signing in with GitHub isn't enough, because that token can't see private repos.
- **Jira Cloud:** your site (`acme.atlassian.net`), your Atlassian email and an [API token](https://id.atlassian.com/manage-profile/security/api-tokens). Jira Server and Data Center aren't supported.

Tokens are stored encrypted (AES-256-GCM, with a key derived from `AUTH_SECRET`). Rotating `AUTH_SECRET` makes them unreadable, and Settings then asks each user to reconnect.

## How it works

```
src/
├── app/
│   ├── (auth)/login/            # sign-in page + server actions
│   ├── (app)/                   # auth-guarded shell: sidebar (desktop), bottom tabs (mobile)
│   │   ├── today/               # log + list a day's entries
│   │   ├── timeline/            # search, blocker filter, day groups, inline edit
│   │   ├── generate/            # standup / weekly / appraisal generator
│   │   ├── history/             # saved outputs
│   │   └── settings/            # zone, reminder, formats, theme, export, delete
│   └── api/
│       ├── generate/            # builds and saves an output
│       ├── sync/                # imports the signed-in user's GitHub + Jira activity
│       ├── auth/[...nextauth]/  # Auth.js
│       ├── cron/sync/           # hourly import for everyone connected
│       ├── cron/reminders/      # hourly reminder sweep
│       └── export/              # Markdown / CSV download
├── components/                  # ui/ primitives, entries/, generate/, settings/, app/ shell
├── lib/
│   ├── db/                      # Drizzle schema, lazy client, migrator, queries/
│   ├── generate/                # output templates (plain.ts) and the output shape
│   ├── integrations/            # GitHub + Jira clients, pure mappers, AI summaries, sync, token crypto
│   ├── auth.ts                  # Auth.js config, only providers whose keys are set
│   ├── dates.ts                 # time-zone-aware ranges and labels
│   ├── parse-entry.ts           # !blocker flag
│   └── validators.ts            # Zod schemas shared by client and server
├── server/actions/              # entries, settings, integrations, auth
└── styles/globals.css           # design tokens (light + dark) as CSS variables
```

**Data.** Every query takes `userId` and filters on it. `entries` has an index on `(user_id, entry_date)`. `entry_date` is stored separately from `created_at`, so yesterday's work can be logged this morning (use ← on Today). Calendar days travel as `YYYY-MM-DD` strings. They only become instants through the user's zone (`lib/dates.ts`), which keeps DST shifts from moving a day.

**Moving between days.** The Today header reads `[Today] [‹][›]`. The heading is the only place that names the day you're on. The controls only move, and you can't go past today. The server works out "today" when it renders, so `useDayRollover` re-renders the page at local midnight, and when a tab left open overnight comes back into view. Entries typed on plain Today don't send a date: the server files them under the current day. If the device's zone differs from the saved one, Today offers to switch.

**Integrations.** A sync fetches activity for a range of days, maps it to entries with pure functions (`lib/integrations/github.ts`, `jira.ts`), and inserts what's new:

| Source | What becomes an entry                                    | Example                                                     |
| ------ | -------------------------------------------------------- | ----------------------------------------------------------- |
| GitHub | A pull request you opened, merged or closed              | `Merged - PAY-7 - Add Okta SSO to the admin dashboard #128` |
| GitHub | Your reviews on someone else's PR, one per PR per day    | `Approved - Fix double charge on retry #45`                 |
| Jira   | The last status you moved an issue to, per issue per day | `Moved PAY-7 to In Review: Retry failed payouts`            |

GitHub lines read **Status - Jira key - PR title #number**. The status is coloured on Today and the Timeline: Opened green, Merged purple, Closed red. The Jira key is taken from the PR title, then the branch name, then the description. It's only used if its project exists in your Jira, so `UTF-8` in a description is never mistaken for a ticket. It's left out when Jira isn't connected, or when the PR names no ticket. A PR opened and merged (or closed) on the same day is logged once, with its outcome.

Every imported entry has a stable `external_id`, with a unique index on `(user_id, external_id)`, so re-syncing never duplicates. Imported entries are ordinary entries: you can edit them, and they feed standups, summaries and exports. Their time is when the work happened, and they link back to the PR or issue. Deleting one records a dismissal so it never comes back, and **Undo** lifts it. Edits survive later syncs.

Like [release-please](https://github.com/googleapis/release-please), the line for a PR is built from what's already in GitHub. Without AI, the PR title is used with its conventional-commit prefix removed, and `fix:` and `revert:` keep their verb. With `ANTHROPIC_API_KEY` set, Settings shows a **Summarise pull requests with AI** toggle (hidden otherwise), and while it's on, Claude reads the description, commit messages and changed files, and writes one commit-subject-style line. That helps most when the title is vague ("Updates", "WIP"). Summaries run at low effort, at most 20 per sync, and any failure falls back to the title.

Syncs run when Today opens (the standup range, at most every 10 minutes), from the sync button (the day on screen), as a 7-day backfill right after connecting, and hourly through `/api/cron/sync`.

**Generation.** `POST /api/generate` checks the session, fetches the range in the user's zone, builds the output with `lib/generate/plain.ts`, and saves it to `generations`. No AI is involved:

- **Standup:** Yesterday, Today and Blockers, in the format picked in Settings (sections, bullets or one paragraph).
- **Weekly summary:** entries grouped by day, with blockers marked.
- **Appraisal notes:** accomplishments and collaboration filled in from your entries, with placeholders for impact and skills.

Every generator writes one text shape: `**Heading**` lines and `– ` bullets. The panel renders it with bold headings, and Copy puts both rich HTML and plain text on the clipboard.

**Optimistic UI.** Saving an entry clears the input straight away and shows the row immediately. If the save fails, the row goes away, the text comes back into the input, and a Retry appears. Deletes show an **Undo** toast, which restores the entry with its original id and timestamp.

## Deploying (Vercel + Neon)

1. **Neon.** Create a project and copy the _pooled_ connection string. The Neon ↔ Vercel integration gives each preview its own database branch.
2. **Vercel.** Import the repo and set **Root Directory** to `apps/worklog`. `vercel.json` runs `pnpm db:migrate && pnpm build`, so every deploy migrates its own database.
3. **Env vars.** Add the variables from the table above. At minimum, `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` and at least one sign-in method.
4. **Resend.** Verify your sending domain and set `EMAIL_FROM` to an address on it.
5. **Hourly jobs.** `.github/workflows/worklog-reminders.yml` calls `/api/cron/sync` and then `/api/cron/reminders` every hour, because Vercel Hobby only allows daily crons. Sync runs first, so imported work counts as logged and doesn't trigger a reminder. Set the repo variable `WORKLOG_APP_URL` and the secret `WORKLOG_CRON_SECRET` (the same value as `CRON_SECRET`). On Vercel Pro you can use Vercel Cron instead by adding this to `vercel.json`:
   ```json
   "crons": [
     { "path": "/api/cron/sync", "schedule": "0 * * * *" },
     { "path": "/api/cron/reminders", "schedule": "5 * * * *" }
   ]
   ```
   Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.

## CI

`.github/workflows/worklog-ci.yml` runs on every PR that touches this app:

- **Checks:** format, lint, typecheck, then unit and component tests.
- **Integration:** tests against Postgres via Testcontainers.
- **E2E:** Playwright + axe against a production build, with a Postgres service container.

`worklog-e2e-preview.yml` can also run the Playwright suite against each Vercel preview. It's opt-in; see the comments in that file.

## What's in the MVP, and what's next

**MVP:**

- One-line entry input with a `!blocker` flag
- Timeline with search and filters, inline edit, and delete with undo
- The three generators, with an editable output box and copy
- History of saved outputs
- Login with persistent storage
- Settings: time zone, daily email reminder, standup format, theme
- Markdown and CSV export
- Account deletion

**Since the MVP:** GitHub and Jira import, with optional AI summaries of pull requests.

**Later:** projects, Slack delivery, team and manager views, grouping imported work by type in weekly summaries (release-please's Features / Bug Fixes sections), and swipe-to-delete on mobile (today it's tap a row, then the delete button).
