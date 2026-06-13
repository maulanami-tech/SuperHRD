import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("sidebar displays all navigation items", async ({ page }) => {
    const sidebarMenu = page.locator('[data-sidebar="menu"]').first();

    await expect(sidebarMenu.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(sidebarMenu.getByRole("link", { name: "Upload CV" })).toBeVisible();
    await expect(page.getByRole("link", { name: /cv screening/i })).toHaveCount(0);
    await expect(sidebarMenu.getByRole("link", { name: "Analytics" })).toBeVisible();
    await expect(sidebarMenu.getByRole("link", { name: "Top Up" })).toBeVisible();
    await expect(sidebarMenu.getByRole("link", { name: "History" })).toBeVisible();
  });

  test("sidebar navigation works for all items", async ({ page }) => {
    let sidebarMenu = page.locator('[data-sidebar="menu"]').first();

    await sidebarMenu.getByRole("link", { name: "Upload CV" }).click();
    await expect(page).toHaveURL(/.*\/upload/);

    sidebarMenu = page.locator('[data-sidebar="menu"]').first();
    await sidebarMenu.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    sidebarMenu = page.locator('[data-sidebar="menu"]').first();
    await sidebarMenu.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/.*\/analytics/);
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

    sidebarMenu = page.locator('[data-sidebar="menu"]').first();
    await sidebarMenu.getByRole("link", { name: "Top Up" }).click();
    await expect(page).toHaveURL(/.*\/topup/);

    sidebarMenu = page.locator('[data-sidebar="menu"]').first();
    await sidebarMenu.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/.*\/credit-history/);
  });

  test("mobile nav is hidden on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const mobileNav = page.locator('[class*="md:hidden"]').filter({ hasText: /dashboard/i });
    await expect(mobileNav).not.toBeVisible();
  });

  test("mobile nav is visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[class*="fixed bottom-0"]')).toBeVisible();
  });

  test("current page heading is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});
