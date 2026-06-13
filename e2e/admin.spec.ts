import { test, expect } from "@playwright/test";

test.describe("Admin Topup Requests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/topup-requests");
  });

  test("admin topup requests page displays header", async ({ page }) => {
    await expect(page.getByText("Top-Up Requests")).toBeVisible();
  });

  test("admin page shows filter buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /pending/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /approved/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /rejected/i })).toBeVisible();
  });

  test("admin page displays request list or empty state", async ({ page }) => {
    const hasRequests = await page.getByText(/no requests/i).isVisible();
    const hasList = await page.locator('[class*="border"]').first().isVisible();
    expect(hasRequests || hasList).toBeTruthy();
  });

  test("reject button opens Dialog instead of prompt", async ({ page }) => {
    const rejectButton = page.getByRole("button", { name: /^Reject$/ }).first();
    if (await rejectButton.isVisible()) {
      await rejectButton.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.getByText(/rejection reason/i)).toBeVisible();
    }
  });

  test("Dialog has cancel and reject buttons", async ({ page }) => {
    const rejectButton = page.getByRole("button", { name: /^Reject$/ }).first();
    if (await rejectButton.isVisible()) {
      await rejectButton.click();
      await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /reject/i }).last()).toBeVisible();
    }
  });
});
