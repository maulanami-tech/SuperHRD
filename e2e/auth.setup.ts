import { config } from "dotenv";
import { test as setup, expect } from "@playwright/test";
import { hashSync } from "bcryptjs";
import { Client } from "pg";

config({ path: ".env.local" });

const authFile = ".playwright/auth.json";
const E2E_EMAIL = process.env.SUPERHRD_E2E_EMAIL ?? "hrd@superhrd.com";
const E2E_PASSWORD = process.env.SUPERHRD_E2E_PASSWORD ?? "superhrd-e2e-password";

setup("authenticate", async ({ page }) => {
  const now = new Date().toISOString();
  const passwordHash = hashSync(E2E_PASSWORD, 10);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  await client.query(
    `
      INSERT INTO "User" (
        id, name, email, "passwordHash", "emailVerified", "creditBalance", "dailyQuotaUsed",
        "lastQuotaDate", "isAdmin", "createdAt"
      )
      VALUES (
        'test-admin-user', 'HRD Admin', $3, $1, $2,
        25, 0, '', true, $2
      )
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        "passwordHash" = excluded."passwordHash",
        "emailVerified" = excluded."emailVerified",
        "creditBalance" = 25,
        "dailyQuotaUsed" = 0,
        "lastQuotaDate" = '',
        "isAdmin" = true
    `,
    [passwordHash, now, E2E_EMAIL]
  );

  await client.query(`DELETE FROM "RateLimit" WHERE key LIKE 'login:%'`);
  await client.end();

  await page.goto("/login");
  await page.fill("#email", E2E_EMAIL);
  await page.fill("#password", E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: authFile });
});
