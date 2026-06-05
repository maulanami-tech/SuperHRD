import { test, expect } from "@playwright/test";

test.describe("Dashboard Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill("#email", "hrd@superhrd.com");
    await page.fill("#password", "admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("dashboard loads with header and navigation", async ({ page }) => {
    await expect(page.getByText("Candidate Screening")).toBeVisible();
    await expect(page.getByText("Review AI-scored CVs")).toBeVisible();
  });

  test("dashboard has search input and status filter", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Search by name or email...")
    ).toBeVisible();
    await expect(page.getByText("All statuses")).toBeVisible();
  });

  test("dashboard shows empty state when no candidates exist", async ({
    page,
  }) => {
    await expect(page.getByText("No candidates yet")).toBeVisible();
    await expect(
      page.getByText(
        "Upload a CV to get started. AI will automatically screen and score each candidate."
      )
    ).toBeVisible();
  });

  test("Upload New button navigates to /upload", async ({ page }) => {
    await page.getByRole("link", { name: /upload new/i }).click();
    await expect(page).toHaveURL(/.*\/upload/);
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.getByRole("link", { name: /upload cv/i }).first().click();
    await expect(page).toHaveURL(/.*\/upload/);

    await page.getByRole("link", { name: /dashboard/i }).first().click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("empty state has Upload CV action button", async ({ page }) => {
    await expect(
      page.getByRole("main").getByRole("link", { name: /upload cv/i })
    ).toBeVisible();
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
});
