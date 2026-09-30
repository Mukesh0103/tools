import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, TEST_LOGIN_SECRET } from "../../playwright.config";

setup("sign in with the test provider", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const form = page.getByTestId("test-login");
  await form.getByLabel("Test email").fill(`e2e-${Date.now()}@worklog.test`);
  await form.getByLabel("Test secret").fill(TEST_LOGIN_SECRET);
  await form.getByRole("button", { name: "Test sign in" }).click();
  await page.waitForURL("**/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
