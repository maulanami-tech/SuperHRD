import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { hashSync } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { Client } from "pg";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

function requireDatabaseUrl() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for email verification E2E");
  }
  return DATABASE_URL;
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}@example.com`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function withClient<T>(fn: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createUser(params: {
  email: string;
  password: string;
  verified?: boolean;
}) {
  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO "User" (
          id, name, email, "passwordHash", "emailVerified", "creditBalance", "dailyQuotaUsed",
          "lastQuotaDate", "isAdmin", "createdAt"
        )
        VALUES ($1, 'Verification Test', $2, $3, $4, 0, 0, '', false, NOW())
      `,
      [
        `email-verification-${randomBytes(8).toString("hex")}`,
        params.email,
        hashSync(params.password, 10),
        params.verified ? new Date().toISOString() : null,
      ],
    );
  });
}

test.describe("Email verification", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("registration creates a pending account and shows check-email state", async ({ page }) => {
    const email = uniqueEmail("register-pending");

    await page.goto("/register");
    await page.fill("#name", "Verification Test");
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await page.fill("#confirmPassword", "password123");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText("Check your email")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(email)).toBeVisible();

    const user = await withClient(async (client) => {
      const result = await client.query(
        `SELECT "emailVerified" FROM "User" WHERE email = $1`,
        [email],
      );
      return result.rows[0];
    });

    expect(user.emailVerified).toBeNull();
  });

  test("unverified users cannot sign in", async ({ page }) => {
    const email = uniqueEmail("unverified-login");
    await createUser({ email, password: "password123" });

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("verification link marks account verified and allows sign in", async ({ page }) => {
    const email = uniqueEmail("verify-success");
    const password = "password123";
    const token = randomBytes(32).toString("base64url");

    await createUser({ email, password });
    await withClient(async (client) => {
      const user = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
      await client.query(
        `
          INSERT INTO "EmailVerificationToken" (id, "userId", "tokenHash", "expiresAt")
          VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')
        `,
        [`token-${randomBytes(8).toString("hex")}`, user.rows[0].id, hashToken(token)],
      );
    });

    await page.goto(`/api/verify-email?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/.*\/verify-email\?status=success/);
    await expect(page.getByText("Email verified")).toBeVisible();

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("invalid verification token shows invalid state", async ({ page }) => {
    await page.goto("/api/verify-email?token=invalid-token");
    await expect(page).toHaveURL(/.*\/verify-email\?status=invalid/);
    await expect(page.getByText("Verification link invalid")).toBeVisible();
  });
});
