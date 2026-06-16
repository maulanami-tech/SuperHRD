import { test, expect } from "@playwright/test";

test.describe("Candidate Detail Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("non-existent candidate shows error state", async ({ page }) => {
    await page.goto("/candidates/non-existent-id");
    await expect(
      page.getByText("Candidate not found")
    ).toBeVisible({ timeout: 10000 });
  });

  test("non-existent candidate has Try again button", async ({ page }) => {
    await page.goto("/candidates/non-existent-id");
    await expect(
      page.getByText("Candidate not found")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /try again/i })
    ).toBeVisible();
  });

  test("error state has back button to dashboard", async ({ page }) => {
    await page.goto("/candidates/non-existent-id");
    await expect(
      page.getByText("Candidate not found")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /back/i })
    ).toBeVisible();
  });

  test("back button navigates to dashboard", async ({ page }) => {
    await page.goto("/candidates/non-existent-id");
    await expect(
      page.getByText("Candidate not found")
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
