import { test, expect } from "@playwright/test";

test.describe("Credit History", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/credit-history");
  });

  test("credit history page displays header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Transaction History" })
    ).toBeVisible();
  });

  test("credit history page shows loading skeleton", async ({ page }) => {
    await expect(page.locator('[class*="animate-pulse"]').first()).toBeVisible();
  });

  test("credit history page displays transaction list surface", async ({ page }) => {
    await expect(page.getByText("All Transactions")).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Top Up" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deduction" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quota" })).toBeVisible();
  });

  test("credit history page renders transactions or empty state", async ({ page }) => {
    await expect(
      page.getByText(/no transactions yet|balance:/i).first()
    ).toBeVisible();
  });
});
