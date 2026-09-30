import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build by default (`next build && next start`)
 * with the mock AI provider and the test-login provider, so it is deterministic
 * and costs nothing. Set PLAYWRIGHT_BASE_URL to aim at a deployed preview.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const external = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export const AUTH_FILE = "playwright/.auth/user.json";
export const TEST_LOGIN_SECRET = process.env.AUTH_TEST_LOGIN_SECRET ?? "e2e-local-test-secret";

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    timezoneId: "UTC",
    locale: "en-GB",
    trace: "retain-on-failure",
    extraHTTPHeaders: bypass
      ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      testMatch: /(worklog|a11y)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: AUTH_FILE,
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
        storageState: AUTH_FILE,
      },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        env: {
          DATABASE_URL:
            process.env.DATABASE_URL ?? "postgres://worklog:worklog@localhost:5432/worklog",
          AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret-do-not-use-in-production-000",
          AUTH_TEST_LOGIN_SECRET: TEST_LOGIN_SECRET,
          AUTH_URL: baseURL,
          APP_URL: baseURL,
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
