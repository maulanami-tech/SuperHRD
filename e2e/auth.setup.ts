import { test as setup, expect } from "@playwright/test";
import { hashSync } from "bcryptjs";
import { Client } from "pg";

const authFile = ".playwright/auth.json";

setup("authenticate", async ({ page }) => {
  const now = new Date().toISOString();
  const passwordHash = hashSync("admin123", 10);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  await client.query(
    `
      INSERT INTO "User" (
        id, name, email, "passwordHash", "creditBalance", "dailyQuotaUsed",
        "lastQuotaDate", "isAdmin", "createdAt"
      )
      VALUES (
        'test-admin-user', 'HRD Admin', 'hrd@superhrd.com', $1,
        25, 0, '', true, $2
      )
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        "passwordHash" = excluded."passwordHash",
        "creditBalance" = 25,
        "dailyQuotaUsed" = 0,
        "lastQuotaDate" = '',
        "isAdmin" = true
    `,
    [passwordHash, now]
  );

  await client.query(`DELETE FROM "RateLimit" WHERE key LIKE 'login:%'`);
  await client.end();

  await page.goto("/login");
  await page.fill("#email", "hrd@superhrd.com");
  await page.fill("#password", "admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: authFile });
});
