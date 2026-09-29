import { expect, test } from "@playwright/test";

test("today works at 375px with the docked input and bottom tabs", async ({ page }) => {
  await page.goto("/today");
  const input = page.getByRole("combobox", { name: "New entry" });
  await expect(input).toBeVisible();
  // Phones don't autofocus, which would pop the keyboard over the list.
  await expect(input).not.toBeFocused();

  await input.fill("Logged from my phone #mobile");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(
    page.locator("[data-entry-id]").filter({ hasText: "Logged from my phone" }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const tabs = page.getByRole("navigation", { name: "Main" });
  await tabs.getByRole("link", { name: "Generate" }).click();
  await page.waitForURL(/\/generate/);
  await expect(page.getByRole("group", { name: "Output" })).toBeVisible();
  const overflowGenerate = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowGenerate).toBeLessThanOrEqual(0);
});
