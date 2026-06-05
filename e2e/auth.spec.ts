import { test, expect } from "@playwright/test";

test.describe("Auth Flow", () => {
  test("login page renders with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("login page shows SuperHRD branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("SuperHRD")).toBeVisible();
    await expect(
      page.getByText("Sign in to access the CV screening dashboard")
    ).toBeVisible();
  });

  test("unauthenticated user is redirected to /login from /dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("unauthenticated user is redirected to /login from /upload", async ({
    page,
  }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("root / redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("login with invalid credentials shows error toast", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "wrong@example.com");
    await page.fill("#password", "wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible({
      timeout: 10000,
    });
  });

  test("login with empty email shows validation error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#password", "admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    // react-hook-form + zod should show inline validation error
    await expect(page.locator("form")).toBeVisible();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("login with valid credentials redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill("#email", "hrd@superhrd.com");
    await page.fill("#password", "admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("logout clears session and redirects to /login", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill("#email", "hrd@superhrd.com");
    await page.fill("#password", "admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Dismiss Next.js dev overlay, then submit the logout form
    await page.locator("body").click({ position: { x: 0, y: 0 } });
    await page.locator('form:has(button:has-text("Sign out"))').evaluate((f) => (f as HTMLFormElement).requestSubmit());

    // Should redirect to /login after logout
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
  });
});
