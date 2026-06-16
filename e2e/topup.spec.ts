import { test, expect } from "@playwright/test";

test.describe("Topup Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/topup");
  });

  test("topup page displays header with title", async ({ page }) => {
    await expect(page.getByText("Top Up Credits")).toBeVisible();
  });

  test("topup page shows current balance", async ({ page }) => {
    await expect(page.getByText(/current balance/i)).toBeVisible();
  });

  test("topup page displays credit bundle options", async ({ page }) => {
    await expect(page.getByText(/20/).first()).toBeVisible();
    await expect(page.getByText(/110/).first()).toBeVisible();
    await expect(page.getByText(/350/).first()).toBeVisible();
    await expect(page.getByText(/1250/).first()).toBeVisible();
  });

  test("topup page shows QRIS payment method", async ({ page }) => {
    await expect(page.getByText(/qris midtrans/i)).toBeVisible();
  });

  test("topup form has QRIS create button", async ({ page }) => {
    await page.getByText("Starter").click();
    await expect(page.getByRole("button", { name: /create qris payment/i })).toBeVisible();
  });

  test("topup page shows QRIS payment panel", async ({ page }) => {
    await expect(page.getByText(/qris payment/i)).toBeVisible();
  });
});
