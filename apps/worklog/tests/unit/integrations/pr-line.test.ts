import { describe, expect, it } from "vitest";
import {
  findIssueKey,
  pullRequestLineParts,
  splitStatus,
  stripIssueKey,
} from "@/lib/integrations/pr-line";

const PROJECTS = new Set(["PAY", "WEB"]);

describe("pullRequestLineParts", () => {
  it("builds Status - KEY - … #n, without the key column when there's no key", () => {
    expect(pullRequestLineParts("Merged", "PAY-7", 128)).toEqual({
      prefix: "Merged - PAY-7 - ",
      suffix: " #128",
    });
    expect(pullRequestLineParts("Opened", null, 3)).toEqual({ prefix: "Opened - ", suffix: " #3" });
  });
});

describe("splitStatus", () => {
  it("splits off a leading status for colouring", () => {
    expect(splitStatus("Merged - PAY-7 - Add Okta SSO #128")).toEqual({
      status: "Merged",
      rest: " - PAY-7 - Add Okta SSO #128",
    });
    expect(splitStatus("Changes requested - Fix retry #45")?.status).toBe("Changes requested");
  });
  it("leaves other lines alone", () => {
    expect(splitStatus("Merged the hotfix by hand")).toBeNull();
    expect(splitStatus("Opened web#1: old format")).toBeNull();
  });
});

describe("findIssueKey", () => {
  it("looks in the title, then the branch, then the description", () => {
    expect(findIssueKey(["Add SSO", "feature/pay-7-sso", "Closes WEB-2"], PROJECTS)).toBe("PAY-7");
    expect(findIssueKey(["WEB-3: Add SSO", "pay-7", null], PROJECTS)).toBe("WEB-3");
    expect(findIssueKey(["Add SSO", "sso", "Closes WEB-2"], PROJECTS)).toBe("WEB-2");
  });
  it("only accepts projects that exist in Jira", () => {
    expect(findIssueKey(["Encode as UTF-8 with SHA-256", "release-2026-10"], PROJECTS)).toBeNull();
    expect(findIssueKey([undefined, ""], PROJECTS)).toBeNull();
  });
});

describe("stripIssueKey", () => {
  it.each([
    ["[PAY-7] Add Okta SSO", "Add Okta SSO"],
    ["PAY-7: Add Okta SSO", "Add Okta SSO"],
    ["PAY-7 - Add Okta SSO", "Add Okta SSO"],
    ["Add Okta SSO (PAY-7)", "Add Okta SSO"],
    ["fix(PAY-7): crash on login", "fix: crash on login"],
    ["pay-7 add okta sso", "add okta sso"],
  ])("%s → %s", (title, expected) => {
    expect(stripIssueKey(title, "PAY-7")).toBe(expected);
  });

  it("keeps the title when the key is all there is", () => {
    expect(stripIssueKey("PAY-7", "PAY-7")).toBe("PAY-7");
  });
});
