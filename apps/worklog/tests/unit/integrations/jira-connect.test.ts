import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjectKeys, verifyJira } from "@/lib/integrations/jira";

const SITE = "https://acme.atlassian.net";
const CLOUD_ID = "505c2f65-3256-405a-a3cb-c84f09bc987f";
const GATEWAY = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;
const creds = { siteUrl: SITE, email: "ada@acme.test", token: "token-123" };
const ME = { accountId: "acc-me", displayName: "Ada" };

type Route = (url: string, init?: RequestInit) => Response | undefined;
const fetchMock = vi.fn();

function serve(...routes: Route[]) {
  fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    for (const route of routes) {
      const res = route(url, init);
      if (res) return res;
    }
    return new Response("not found", { status: 404 });
  });
}

const at =
  (url: string, status: number, body: unknown): Route =>
  (u) =>
    u === url ? Response.json(body, { status }) : undefined;
const tenantInfo = at(`${SITE}/_edge/tenant_info`, 200, { cloudId: CLOUD_ID });
const unauthorized = { errorMessages: ["Client must be authenticated to access this resource."] };

const calledUrls = () => fetchMock.mock.calls.map(([u]) => String(u));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("verifyJira", () => {
  it("uses the site address for a plain token", async () => {
    serve(at(`${SITE}/rest/api/3/myself`, 200, ME));
    expect(await verifyJira(creds)).toEqual({ ...ME, apiUrl: null });
    const auth = new Headers(fetchMock.mock.calls[0]![1].headers).get("Authorization");
    expect(auth).toBe(`Basic ${Buffer.from("ada@acme.test:token-123").toString("base64")}`);
  });

  it("falls back to Atlassian's gateway for a token with scopes", async () => {
    serve(
      at(`${SITE}/rest/api/3/myself`, 401, unauthorized),
      tenantInfo,
      at(`${GATEWAY}/rest/api/3/myself`, 200, ME),
    );
    expect(await verifyJira(creds)).toEqual({ ...ME, apiUrl: GATEWAY });
  });

  it("says when a scoped token is missing scopes", async () => {
    serve(
      at(`${SITE}/rest/api/3/myself`, 401, unauthorized),
      tenantInfo,
      at(`${GATEWAY}/rest/api/3/myself`, 401, { message: "Unauthorized; scope does not match" }),
    );
    await expect(verifyJira(creds)).rejects.toThrow(
      /missing scopes.*read:jira-work and read:jira-user/,
    );
  });

  it("explains a rejected email or token when neither address accepts it", async () => {
    serve(
      at(`${SITE}/rest/api/3/myself`, 401, unauthorized),
      tenantInfo,
      at(`${GATEWAY}/rest/api/3/myself`, 401, unauthorized),
    );
    await expect(verifyJira(creds)).rejects.toThrow(/didn't accept this email and API token/);
  });

  it("never sends the token anywhere the site didn't name", async () => {
    serve(
      at(`${SITE}/rest/api/3/myself`, 401, unauthorized),
      at(`${SITE}/_edge/tenant_info`, 200, { cloudId: "../../evil" }),
    );
    await expect(verifyJira(creds)).rejects.toThrow(/didn't accept/);
    expect(calledUrls()).toEqual([`${SITE}/rest/api/3/myself`, `${SITE}/_edge/tenant_info`]);
  });

  it("doesn't retry on a 403, which isn't a token-type problem", async () => {
    serve(at(`${SITE}/rest/api/3/myself`, 403, { errorMessages: ["Forbidden"] }));
    await expect(verifyJira(creds)).rejects.toThrow(/refused access/);
    expect(calledUrls()).toEqual([`${SITE}/rest/api/3/myself`]);
  });
});

describe("Jira calls after connecting", () => {
  it("go to the gateway when the connection saved one", async () => {
    serve(
      at(`${GATEWAY}/rest/api/3/project/search?startAt=0&maxResults=100`, 200, {
        values: [{ key: "pay" }, { key: "WEB" }],
        isLast: true,
      }),
    );
    expect(await listProjectKeys({ ...creds, apiUrl: GATEWAY })).toEqual(new Set(["PAY", "WEB"]));
  });
});
