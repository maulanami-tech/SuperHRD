import { config } from "dotenv";
import { test as setup, expect } from "@playwright/test";

config({ path: ".env.local" });

const authFile = ".playwright/prod-auth.json";
const E2E_EMAIL = process.env.SUPERHRD_E2E_EMAIL;
const E2E_PASSWORD = process.env.SUPERHRD_E2E_PASSWORD;

setup("authenticate against production", async ({ page }) => {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "Set SUPERHRD_E2E_EMAIL and SUPERHRD_E2E_PASSWORD for production E2E."
    );
  }

  await page.goto("/login");
  await page.fill("#email", E2E_EMAIL);
  await page.fill("#password", E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 20_000 });
  await page.context().storageState({ path: authFile });
});
