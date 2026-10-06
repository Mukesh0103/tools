import { expect, test, type Page } from "@playwright/test";

async function logEntry(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: "New entry" });
  await input.fill(text);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  // The row shows up optimistically. Wait for "Saved", which only appears once the
  // server confirms, so a reload right after can't beat the insert.
  const row = page.locator("[data-entry-id]").filter({ hasText: text.replace(/\s*!blocker$/, "") });
  await expect(row.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("log three entries, generate a standup, and copy it", async ({ page }) => {
  await page.goto("/today");
  const input = page.getByRole("textbox", { name: "New entry" });
  await expect(input).toBeFocused();
  await expect(page.getByText("flags a blocker")).toBeVisible();

  await logEntry(page, "Fixed pagination bug in the invoices API");
  await logEntry(page, "Sprint planning, picked up three tickets");
  await logEntry(page, "Waiting on staging DB credentials !blocker");

  await expect(page.getByRole("heading", { name: "3 entries today" })).toBeVisible();
  const list = page.getByRole("region", { name: "3 entries today" });
  await expect(list.getByText("Waiting on staging DB credentials")).toBeVisible();
  await expect(list.getByText("Blocker", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "3 entries today" })).toBeVisible();

  await page.getByRole("link", { name: /Generate standup/ }).click();
  await page.waitForURL(/\/generate\?type=standup/);
  await page.getByRole("button", { name: "Generate", exact: true }).click();

  const output = page.getByRole("textbox", { name: "Generated standup update, editable" });
  await expect(output).toContainText("Waiting on staging DB credentials");
  await expect(output).toHaveAttribute("contenteditable", "true");
  await expect(output.locator("strong")).toHaveText(["Yesterday", "Today", "Blockers"]);
  await expect(page.getByText("From 3 entries")).toBeVisible();

  await output.click();
  await output.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  await page.keyboard.type(" (pinged infra)");
  await page.getByRole("button", { name: /^Copy/ }).first().click();
  await expect(page.getByText("Standup copied to clipboard")).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Blockers\n– Waiting on staging DB credentials (pinged infra)");
  expect(clip).not.toContain("**");

  await page.getByRole("link", { name: "History" }).first().click();
  const row = page
    .getByRole("listitem")
    .getByRole("link", { name: /^Standup/ })
    .first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("textbox", { name: /editable/ })).toContainText("(pinged infra)");
});

test("the heading names the day, and forward stops at today", async ({ page }) => {
  await page.goto("/today");
  const heading = page.getByRole("heading", { level: 1 });
  const nav = page.getByRole("navigation", { name: "Change day" });
  await expect(heading).toHaveText("Today");
  await expect(nav.getByRole("button", { name: "Today" })).toBeDisabled();
  await expect(nav.getByRole("button", { name: "Next day" })).toBeDisabled();

  await nav.getByRole("link", { name: "Previous day" }).click();
  await expect(heading).toHaveText("Yesterday");
  await nav.getByRole("link", { name: "Previous day" }).click();
  await expect(heading).not.toHaveText(/Today|Yesterday/);

  await nav.getByRole("link", { name: "Next day" }).click();
  await expect(heading).toHaveText("Yesterday");
  await nav.getByRole("link", { name: "Next day" }).click();
  await expect(heading).toHaveText("Today");
  await expect(page).toHaveURL(/\/today$/);

  await nav.getByRole("link", { name: "Previous day" }).click();
  await expect(heading).toHaveText("Yesterday");
  await nav.getByRole("link", { name: "Today" }).click();
  await expect(heading).toHaveText("Today");
});

test("connecting an integration checks the details before saving", async ({ page }) => {
  await page.goto("/settings");
  const card = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Integrations" }) });
  await expect(card.getByText("Pull requests you open, merge and review")).toBeVisible();

  await card.getByRole("button", { name: "Connect", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Connect GitHub" });
  await dialog.getByLabel("Personal access token").fill("too-short");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("That doesn't look like a GitHub token");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await card.getByRole("button", { name: "Connect", exact: true }).last().click();
  const jira = page.getByRole("dialog", { name: "Connect Jira" });
  await jira.getByLabel("Jira site").fill("jira.internal.example.com");
  await jira.getByLabel("Atlassian email").fill("ada@example.com");
  await jira.getByLabel("API token").fill("not-a-real-token");
  await jira.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(jira.getByRole("alert")).toHaveText(
    "Use your Jira Cloud address, like acme.atlassian.net.",
  );
});

test("search, filter, edit and delete with undo on the timeline", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();

  await page.locator("body").press("/");
  const search = page.getByRole("searchbox", { name: "Search entries" });
  await expect(search).toBeFocused();
  await search.fill("pagination");
  await expect(page.getByText("Sprint planning, picked up three tickets")).toHaveCount(0);
  await expect(page.getByText("Fixed pagination bug in the invoices API")).toBeVisible();
  await search.fill("");
  await expect(page.getByText("Sprint planning, picked up three tickets")).toBeVisible();

  await page.getByRole("button", { name: "Blockers only" }).click();
  await expect(page.getByText("Fixed pagination bug in the invoices API")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();

  const row = page.locator("[data-entry-id]").filter({ hasText: "Sprint planning" });
  await row.hover();
  await row.getByRole("button", { name: "Edit entry" }).click();
  const edit = page.getByRole("textbox", { name: "Edit entry" });
  await expect(edit).toHaveValue("Sprint planning, picked up three tickets");
  await edit.fill("Sprint planning, picked up four tickets");
  await edit.press("Enter");
  await expect(page.getByText("Sprint planning, picked up four tickets")).toBeVisible();

  const edited = page.locator("[data-entry-id]").filter({ hasText: "four tickets" });
  await edited.hover();
  await edited.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByText("Sprint planning, picked up four tickets")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Sprint planning, picked up four tickets")).toBeVisible();
});

test("settings autosave and persist", async ({ page }) => {
  await page.goto("/settings");
  await page
    .getByRole("group", { name: "Default standup format" })
    .getByRole("button", { name: "Bullets" })
    .click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Default standup format" })
      .getByRole("button", { name: "Bullets" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("an empty range shows the empty state", async ({ page }) => {
  await page.goto("/generate?type=appraisal");
  await page.getByRole("button", { name: /Jul – Sep|Q\d/ }).click();
  await page.getByRole("button", { name: /Last quarter/ }).click();
  await page.getByRole("button", { name: /^Generate/ }).click();
  await expect(page.getByText(/^No entries from/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Log an entry" })).toBeVisible();
});
