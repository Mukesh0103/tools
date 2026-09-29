# tools

A monorepo of small personal productivity tools.

| App         | What it does                                                                                    | Path                           |
| ----------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| **Worklog** | Log one line per task and get your standup, weekly summary and appraisal notes written for you. | [`apps/worklog`](apps/worklog) |

## Layout

```
tools/
├── apps/
│   └── worklog/                 # Next.js 15 app (UI + API)
├── packages/
│   └── typescript-config/       # shared tsconfig presets
├── .github/workflows/           # CI per app, filtered by path
├── package.json                 # workspace scripts (Turborepo)
├── pnpm-workspace.yaml
└── turbo.json
```

## Requirements

- Node **22.22+**: `nvm install 22 && nvm use` (the repo has an `.nvmrc`)
- pnpm 10: `corepack enable`. The exact version is pinned in `package.json`.
- Docker, for local Postgres and the integration tests

## Common commands

```bash
pnpm install          # install everything
pnpm dev              # run every app in dev mode
pnpm build            # build every app
pnpm lint             # lint every app
pnpm typecheck        # tsc --noEmit everywhere
pnpm test             # unit + component tests everywhere
pnpm format           # prettier --write
```

Work on one app with `pnpm --filter worklog <script>`, or run scripts from inside `apps/worklog`.

## Adding a tool

1. Create `apps/<name>` with its own `package.json`, and extend `@tools/typescript-config`.
2. Add `.github/workflows/<name>-ci.yml` with `paths: ["apps/<name>/**", …]` so it only runs when that app changes.
3. On Vercel, create a separate project with **Root Directory** set to `apps/<name>`.
