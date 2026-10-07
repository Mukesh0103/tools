import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEntriesForDay, updateEntry } from "@/lib/db/queries/entries";
import {
  deleteIntegration,
  listIntegrations,
  upsertIntegration,
} from "@/lib/db/queries/integrations";
import { upsertSettings } from "@/lib/db/queries/users";
import { createUser } from "./helpers";

process.env.AUTH_SECRET ??= "integration-test-secret-000000000000";

let currentUser = "";
vi.mock("@/lib/auth", () => ({
  requireUserId: async () => currentUser,
  currentUserId: async () => currentUser || null,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const ai = vi.hoisted(() => ({ available: false, summarize: vi.fn() }));
vi.mock("@/lib/integrations/summarize", () => ({
  aiSummariesAvailable: () => ai.available,
  summarizePullRequest: ai.summarize,
}));

const { encryptSecret } = await import("@/lib/integrations/crypto");
const { syncUserActivity } = await import("@/lib/integrations/sync");
const { deleteEntry, restoreEntry } = await import("@/server/actions/entries");
const { POST } = await import("@/app/api/sync/route");

const DAY = "2026-10-05";
const range = { start: DAY, end: DAY };
const SITE = "https://acme.atlassian.net";
const GATEWAY = "https://api.atlassian.com/ex/jira/505c2f65-3256-405a-a3cb-c84f09bc987f";

const github = {
  created: [
    {
      number: 12,
      title: "feat(auth): add Okta SSO",
      url: "https://github.com/acme/web/pull/12",
      body: "Adds SSO",
      headRefName: "feature/pay-7-okta-sso",
      createdAt: `${DAY}T09:00:00Z`,
      mergedAt: `${DAY}T15:00:00Z`,
      closedAt: `${DAY}T15:00:00Z`,
      additions: 10,
      deletions: 2,
      repository: { nameWithOwner: "acme/web" },
      commits: { nodes: [] },
      files: { nodes: [] },
    },
  ],
  reviewed: [
    {
      number: 45,
      title: "fix: double charge on retry",
      url: "https://github.com/acme/api/pull/45",
      body: "",
      headRefName: "double-charge",
      author: { login: "ravi" },
      repository: { nameWithOwner: "acme/api" },
      reviews: { nodes: [{ state: "APPROVED", submittedAt: `${DAY}T11:00:00Z` }] },
    },
  ],
  status: 200,
};

const jira = {
  issues: [
    {
      id: "10001",
      key: "PAY-7",
      fields: { summary: "Retry failed payouts", status: { id: "3", name: "In Review" } },
    },
  ],
  changelogs: [
    {
      issueId: "10001",
      changeHistories: [
        {
          author: { accountId: "acc-me" },
          created: `${DAY}T13:00:00.000+0000`,
          items: [{ field: "status", fieldId: "status", to: "3", toString: "In Review" }],
        },
      ],
    },
  ],
  status: 200,
};

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (url === "https://api.github.com/graphql") {
    if (github.status !== 200) return new Response("{}", { status: github.status });
    const q: string = body.variables?.q ?? "";
    const nodes = q.includes("reviewed-by:")
      ? github.reviewed
      : q.includes("created:") || q.includes("closed:")
        ? github.created
        : [];
    return Response.json({
      data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
    });
  }
  if (url.startsWith(SITE) || url.startsWith(GATEWAY)) {
    if (jira.status !== 200) return new Response("{}", { status: jira.status });
    if (url.endsWith("/rest/api/3/search/jql"))
      return Response.json({ issues: jira.issues, isLast: true });
    if (url.endsWith("/rest/api/3/changelog/bulkfetch")) {
      return Response.json({ issueChangeLogs: jira.changelogs });
    }
    if (url.includes("/rest/api/3/project/search")) {
      return Response.json({ values: [{ key: "PAY" }], isLast: true });
    }
  }
  return new Response("not found", { status: 404 });
});

async function connectBoth(userId: string) {
  await upsertIntegration({
    userId,
    provider: "github",
    accountId: "ada",
    displayName: "@ada",
    siteUrl: null,
    email: null,
    apiUrl: null,
    secret: encryptSecret("github_pat_test_token_000"),
  });
  await upsertIntegration({
    userId,
    provider: "jira",
    accountId: "acc-me",
    displayName: "Ada",
    siteUrl: SITE,
    email: "ada@acme.test",
    apiUrl: null,
    secret: encryptSecret("jira-token-000"),
  });
}

const texts = async (userId: string) =>
  (await listEntriesForDay(userId, DAY)).map((e) => e.text).sort();

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  github.status = 200;
  jira.status = 200;
  ai.available = false;
  ai.summarize.mockReset();
  currentUser = (await createUser({ timezone: "UTC" })).id;
  await connectBoth(currentUser);
});
afterEach(() => vi.unstubAllGlobals());

describe("syncUserActivity", () => {
  it("imports pull requests, reviews and issue moves as entries, once", async () => {
    const first = await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(first.imported).toBe(3);
    expect(first.providers.map((p) => [p.provider, p.status, p.imported])).toEqual([
      ["github", "ok", 2],
      ["jira", "ok", 1],
    ]);

    const rows = await listEntriesForDay(currentUser, DAY);
    expect(rows.map((r) => [r.text, r.source, r.createdAt.toISOString()]).sort()).toEqual([
      ["Approved - Fix double charge on retry #45", "github", `${DAY}T11:00:00.000Z`],
      ["Merged - PAY-7 - Add Okta SSO #12", "github", `${DAY}T15:00:00.000Z`],
      ["Moved PAY-7 to In Review: Retry failed payouts", "jira", `${DAY}T13:00:00.000Z`],
    ]);
    expect(rows.find((r) => r.source === "jira")?.url).toBe(`${SITE}/browse/PAY-7`);

    const again = await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(again.imported).toBe(0);
    expect(await listEntriesForDay(currentUser, DAY)).toHaveLength(3);
  });

  it("never overwrites an imported entry the user edited", async () => {
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    const [row] = (await listEntriesForDay(currentUser, DAY)).filter((r) => r.source === "jira");
    await updateEntry(currentUser, row!.id, {
      text: "Sent PAY-7 to review with Ravi",
      isBlocker: false,
    });
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(await texts(currentUser)).toContain("Sent PAY-7 to review with Ravi");
    expect(await listEntriesForDay(currentUser, DAY)).toHaveLength(3);
  });

  it("keeps deleted imports deleted, and Undo brings them back", async () => {
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    const merged = (await listEntriesForDay(currentUser, DAY)).find((r) =>
      r.text.startsWith("Merged"),
    )!;

    const deleted = await deleteEntry({ id: merged.id });
    expect(deleted.ok).toBe(true);
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(await texts(currentUser)).not.toContain("Merged - PAY-7 - Add Okta SSO #12");

    if (!deleted.ok) return;
    expect((await restoreEntry(deleted.data)).ok).toBe(true);
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    const rows = await listEntriesForDay(currentUser, DAY);
    expect(rows.filter((r) => r.text === "Merged - PAY-7 - Add Okta SSO #12")).toHaveLength(1);
    expect(rows.find((r) => r.id === merged.id)?.externalId).toBe("github:pr:acme/web#12:merged");
  });

  it("skips providers synced in the last 10 minutes unless forced", async () => {
    const now = new Date();
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true, now });
    fetchMock.mockClear();
    const soon = new Date(now.getTime() + 5 * 60_000);
    const auto = await syncUserActivity(currentUser, { range, tz: "UTC", now: soon });
    expect(auto.providers.every((p) => p.status === "skipped")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves the Jira key out when Jira isn't connected", async () => {
    await deleteIntegration(currentUser, "jira");
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(await texts(currentUser)).toEqual([
      "Approved - Fix double charge on retry #45",
      "Merged - Add Okta SSO #12",
    ]);
  });

  it("still imports GitHub work, without keys, when Jira can't be read", async () => {
    jira.status = 401;
    const result = await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(result.providers.find((p) => p.provider === "github")).toMatchObject({
      status: "ok",
      imported: 2,
    });
    expect(await texts(currentUser)).toContain("Merged - Add Okta SSO #12");
  });

  it("drops the key from an AI summary that repeats it", async () => {
    ai.available = true;
    ai.summarize.mockResolvedValue("PAY-7: Add Okta single sign-on");
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true, aiSummaries: true });
    expect(await texts(currentUser)).toContain("Merged - PAY-7 - Add Okta single sign-on #12");
  });

  it("sends Jira calls through the gateway when the token has scopes", async () => {
    await upsertIntegration({
      userId: currentUser,
      provider: "jira",
      accountId: "acc-me",
      displayName: "Ada",
      siteUrl: SITE,
      email: "ada@acme.test",
      apiUrl: GATEWAY,
      secret: encryptSecret("jira-scoped-token-000"),
    });
    const result = await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(result.providers.find((p) => p.provider === "jira")).toMatchObject({
      status: "ok",
      imported: 1,
    });
    const jiraCalls = fetchMock.mock.calls
      .map(([u]) => String(u))
      .filter((u) => !u.includes("github"));
    expect(jiraCalls.length).toBeGreaterThan(0);
    expect(jiraCalls.every((u) => u.startsWith(GATEWAY))).toBe(true);
    // Links still point at the site people browse.
    const row = (await listEntriesForDay(currentUser, DAY)).find((r) => r.source === "jira");
    expect(row?.url).toBe(`${SITE}/browse/PAY-7`);
    expect(await texts(currentUser)).toContain("Merged - PAY-7 - Add Okta SSO #12");
  });

  it("records a rejected token without stopping the other provider", async () => {
    github.status = 401;
    const result = await syncUserActivity(currentUser, { range, tz: "UTC", force: true });
    expect(result.providers).toEqual([
      {
        provider: "github",
        status: "error",
        imported: 0,
        error: "GitHub rejected the token. Connect again with a new one.",
      },
      { provider: "jira", status: "ok", imported: 1 },
    ]);
    const saved = await listIntegrations(currentUser);
    expect(saved.find((i) => i.provider === "github")?.lastError).toMatch(/rejected the token/);
    expect(saved.find((i) => i.provider === "jira")?.lastError).toBeNull();
  });

  it("uses the AI summary for your own pull requests when it's on", async () => {
    ai.available = true;
    ai.summarize.mockResolvedValue("Add Okta single sign-on to the admin dashboard");
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true, aiSummaries: true });
    expect(ai.summarize).toHaveBeenCalledTimes(1);
    expect(await texts(currentUser)).toContain(
      "Merged - PAY-7 - Add Okta single sign-on to the admin dashboard #12",
    );
  });

  it("doesn't call the AI when the user turned summaries off", async () => {
    ai.available = true;
    await syncUserActivity(currentUser, { range, tz: "UTC", force: true, aiSummaries: false });
    expect(ai.summarize).not.toHaveBeenCalled();
    expect(await texts(currentUser)).toContain("Merged - PAY-7 - Add Okta SSO #12");
  });
});

describe("POST /api/sync", () => {
  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  it("syncs the requested days with the user's AI setting", async () => {
    ai.available = true;
    await upsertSettings(currentUser, { aiSummaries: false });
    const res = await post({ range, force: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ imported: 3 });
    expect(ai.summarize).not.toHaveBeenCalled();
  });

  it("rejects long ranges and signed-out callers", async () => {
    expect((await post({ range: { start: "2026-08-01", end: "2026-09-30" } })).status).toBe(400);
    currentUser = "";
    expect((await post({})).status).toBe(401);
  });
});
