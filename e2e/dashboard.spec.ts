import { test, expect } from "@playwright/test";

test.describe("Dashboard Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("dashboard loads with header and navigation", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Track credits and screening activity")).toBeVisible();
  });

  test("dashboard has search input and status filter", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Search by name or email...")
    ).toBeVisible();
    await expect(page.getByText("All statuses")).toBeVisible();
  });

  test("dashboard shows candidates data", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const hasTable = await page.locator("table").count() > 0;
    const hasEmptyState = await page.getByText(/no candidates yet/i).isVisible();
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test("Upload CV button navigates to /upload", async ({ page }) => {
    await page.getByRole("banner").getByRole("link", { name: /upload cv/i }).click();
    await expect(page).toHaveURL(/.*\/upload/);
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.getByRole("link", { name: /upload cv/i }).first().click();
    await expect(page).toHaveURL(/.*\/upload/);

    await page.getByRole("link", { name: /dashboard/i }).first().click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("dashboard has upload action available", async ({ page }) => {
    const uploadLink = page.getByRole("link", { name: /upload/i }).first();
    await expect(uploadLink).toBeVisible();
  });

  test("status filter dropdown opens with options", async ({ page }) => {
    await page.locator('[role="combobox"]').click();
    await expect(
      page.getByRole("option", { name: "All statuses" })
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "Pending" })).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Processing" })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Completed" })
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "Failed" })).toBeVisible();
  });

  test("dashboard displays CreditBalanceCard with balance", async ({ page }) => {
    await expect(page.getByText(/credits/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /top up/i })).toBeVisible();
  });

  test("sidebar has Upload CV and Analytics nav items", async ({ page }) => {
    const sidebarMenu = page.locator('[data-sidebar="menu"]').first();

    await expect(sidebarMenu.getByRole("link", { name: "Upload CV" })).toBeVisible();
    await expect(page.getByRole("link", { name: /cv screening/i })).toHaveCount(0);
    await expect(sidebarMenu.getByRole("link", { name: "Analytics" })).toBeVisible();
    await expect(sidebarMenu.getByRole("link", { name: "Top Up" })).toBeVisible();
    await expect(sidebarMenu.getByRole("link", { name: "History" })).toBeVisible();
  });

  test("dashboard has proper page structure", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
