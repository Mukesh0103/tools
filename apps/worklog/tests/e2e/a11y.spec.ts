import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/today", "/timeline", "/generate", "/history", "/settings"];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

for (const path of PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page);
  });
}

test("dark mode has no contrast violations on Today", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/today");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectNoViolations(page);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("/login has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoViolations(page);
  });
});
