import { config } from "dotenv";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

config({ path: ".env.local" });

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function setAdminCreditBalance(balance: number) {
  await withDb(async (client) => {
    await client.query(
      `UPDATE "User" SET "creditBalance" = $1 WHERE email = $2`,
      [balance, process.env.SUPERHRD_E2E_EMAIL ?? "hrd@superhrd.com"],
    );
  });
}

test.describe("AI Generate Criteria & Prompt UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/upload");
  });

  test("single and batch forms show optional generate buttons disabled until position is filled", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /generate with ai/i }),
    ).toBeDisabled();
    await expect(
      page.getByText(/optional.*uses 1 paid credit/i),
    ).toBeVisible();

    await page.fill("#posisi", "Backend Developer Golang");
    await expect(
      page.getByRole("button", { name: /generate with ai/i }),
    ).toBeEnabled();

    await page.getByRole("tab", { name: /batch zip/i }).click();
    await expect(
      page.getByRole("button", { name: /generate with ai/i }),
    ).toBeDisabled();
    await page.fill("#batch-posisi", "Backend Developer Golang");
    await expect(
      page.getByRole("button", { name: /generate with ai/i }),
    ).toBeEnabled();
  });

  test("single generate asks confirmation and fills criteria and prompt", async ({
    page,
  }) => {
    await page.route("**/api/upload/generate-prompt", async (route) => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toMatchObject({
        posisi: "Backend Developer Golang",
        mode: "single",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kriteria: "Pengalaman Golang minimal 3 tahun\nREST API\nPostgreSQL",
          prompt: "Evaluasi CV berdasarkan kriteria role Backend Developer.",
          balanceAfter: 24,
        }),
      });
    });

    await page.fill("#posisi", "Backend Developer Golang");
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("1 paid credit");
      await dialog.accept();
    });
    await page.getByRole("button", { name: /generate with ai/i }).click();

    await expect(page.locator("#kriteria")).toHaveValue(/Pengalaman Golang/);
    await expect(page.locator("#prompt")).toHaveValue(/Evaluasi CV/);
  });

  test("batch generate fills batch criteria and prompt", async ({ page }) => {
    await page.route("**/api/upload/generate-prompt", async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        posisi: "Data Analyst",
        mode: "batch",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kriteria: "SQL\nDashboarding\nAnalytical thinking",
          prompt: "Evaluasi semua CV dalam ZIP untuk role Data Analyst.",
          balanceAfter: 24,
        }),
      });
    });

    await page.getByRole("tab", { name: /batch zip/i }).click();
    await page.fill("#batch-posisi", "Data Analyst");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /generate with ai/i }).click();

    await expect(page.locator("#batch-kriteria")).toHaveValue(/SQL/);
    await expect(page.locator("#batch-prompt")).toHaveValue(/semua CV/);
  });

  test("generate handles insufficient credit and provider errors without changing fields", async ({
    page,
  }) => {
    await page.fill("#posisi", "Frontend Engineer");

    await page.route("**/api/upload/generate-prompt", async (route) => {
      await route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({ error: "Insufficient paid credits" }),
      });
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /generate with ai/i }).click();
    await expect(page.getByText(/insufficient paid credits/i)).toBeVisible();
    await expect(page.locator("#kriteria")).toHaveValue("");
    await expect(page.locator("#prompt")).toHaveValue("");

    await page.unroute("**/api/upload/generate-prompt");
    await page.route("**/api/upload/generate-prompt", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to generate prompt" }),
      });
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /generate with ai/i }).click();
    await expect(page.getByText(/failed to generate prompt/i)).toBeVisible();
    await expect(page.locator("#kriteria")).toHaveValue("");
    await expect(page.locator("#prompt")).toHaveValue("");
  });

  test("manual criteria and prompt flow remains available", async ({ page }) => {
    await page.fill("#name", "Manual Candidate");
    await page.fill("#posisi", "QA Engineer");
    await page.fill("#kriteria", "Manual criteria");
    await page.fill("#prompt", "Manual prompt");

    await expect(page.locator("#kriteria")).toHaveValue("Manual criteria");
    await expect(page.locator("#prompt")).toHaveValue("Manual prompt");
  });
});

test.describe("AI Generate Criteria & Prompt API", () => {
  test.describe("Unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("POST /api/upload/generate-prompt returns 401 when unauthenticated", async ({
      request,
    }) => {
      const res = await request.post("/api/upload/generate-prompt", {
        data: { posisi: "Backend Developer", mode: "single" },
      });
      expect(res.status()).toBe(401);
    });
  });

  test("POST /api/upload/generate-prompt validates position", async ({
    request,
  }) => {
    const res = await request.post("/api/upload/generate-prompt", {
      data: { posisi: "", mode: "single" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/upload/generate-prompt returns 402 when paid credit is insufficient", async ({
    request,
  }) => {
    await setAdminCreditBalance(0);
    const res = await request.post("/api/upload/generate-prompt", {
      headers: {
        "x-superhrd-test-ai-response": JSON.stringify({
          kriteria: "Criteria",
          prompt: "Prompt",
        }),
      },
      data: { posisi: "Backend Developer", mode: "single" },
    });
    expect(res.status()).toBe(402);
  });

  test("POST /api/upload/generate-prompt deducts one paid credit and records history", async ({
    request,
  }) => {
    await setAdminCreditBalance(5);

    const res = await request.post("/api/upload/generate-prompt", {
      headers: {
        "x-superhrd-test-ai-response": JSON.stringify({
          kriteria: "Pengalaman TypeScript\nNext.js\nPostgreSQL",
          prompt: "Evaluasi CV untuk role Fullstack Engineer.",
        }),
      },
      data: { posisi: "Fullstack Engineer", mode: "single" },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      kriteria: expect.stringContaining("TypeScript"),
      prompt: expect.stringContaining("Fullstack"),
      balanceAfter: 4,
    });

    await withDb(async (client) => {
      const user = await client.query(
        `SELECT id, "creditBalance" FROM "User" WHERE email = $1`,
        [process.env.SUPERHRD_E2E_EMAIL ?? "hrd@superhrd.com"],
      );
      expect(user.rows[0].creditBalance).toBe(4);
      const tx = await client.query(
        `SELECT type, "creditDelta", "balanceAfter", description
         FROM "Transaction"
         WHERE "userId" = $1
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [user.rows[0].id],
      );
      expect(tx.rows[0]).toMatchObject({
        type: "generate_prompt",
        creditDelta: -1,
        balanceAfter: 4,
        description: "AI generated screening criteria and prompt",
      });
    });
  });
});
