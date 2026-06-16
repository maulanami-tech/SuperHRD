import path from "path";
import { test as setup, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";

const authFile = ".playwright/auth.json";

function databasePath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return path.resolve(url.replace(/^file:/, ""));
}

setup("authenticate", async ({ page }) => {
  const db = new Database(databasePath());
  const now = new Date().toISOString();
  const passwordHash = hashSync("admin123", 10);

  db.prepare(
    `
    INSERT INTO User (
      id, name, email, passwordHash, creditBalance, dailyQuotaUsed,
      lastQuotaDate, isAdmin, createdAt
    )
    VALUES (
      'test-admin-user', 'HRD Admin', 'hrd@superhrd.com', @passwordHash,
      25, 0, '', 1, @now
    )
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      passwordHash = excluded.passwordHash,
      isAdmin = 1,
      creditBalance = CASE
        WHEN User.creditBalance < 25 THEN 25
        ELSE User.creditBalance
      END
    `
  ).run({ passwordHash, now });
  db.prepare("DELETE FROM RateLimit WHERE key LIKE 'login:%'").run();
  db.close();

  await page.goto("/login");
  await page.fill("#email", "hrd@superhrd.com");
  await page.fill("#password", "admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: authFile });
});
