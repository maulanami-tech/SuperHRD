import { config } from "dotenv";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
const serverKey = process.env.MIDTRANS_SERVER_KEY;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for topup E2E");
}

if (!serverKey) {
  throw new Error("MIDTRANS_SERVER_KEY is required for topup E2E");
}

const ADMIN_EMAIL = "hrd@superhrd.com";
const STARTER_CREDITS = 20;
const BASELINE_BALANCE = 25;

async function withClient<T>(fn: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function getAdminState() {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, email, "creditBalance" FROM "User" WHERE email = $1 LIMIT 1`,
      [ADMIN_EMAIL],
    );

    if (result.rows.length === 0) {
      throw new Error(`Admin user not found for ${ADMIN_EMAIL}`);
    }

    return result.rows[0] as {
      id: string;
      email: string;
      creditBalance: number;
    };
  });
}

async function resetTopupState() {
  const admin = await getAdminState();

  await withClient(async (client) => {
    await client.query(
      `
        DELETE FROM "Transaction"
        WHERE "userId" = $1
          AND type = 'topup_qris'
          AND description LIKE 'QRIS topup approved:%'
      `,
      [admin.id],
    );

    await client.query(
      `
        DELETE FROM "TopupRequest"
        WHERE "userId" = $1
          AND "paymentProvider" = 'midtrans'
      `,
      [admin.id],
    );
    await client.query(
      `
        DELETE FROM "RateLimit"
        WHERE key IN ($1, $2)
      `,
      [`topup:user:${admin.id}`, `topup:sync:user:${admin.id}`],
    );


    await client.query(
      `
        UPDATE "User"
        SET "creditBalance" = $2,
            "dailyQuotaUsed" = 0,
            "lastQuotaDate" = ''
        WHERE id = $1
      `,
      [admin.id, BASELINE_BALANCE],
    );
  });

  return admin;
}

async function getTopupState(topupId: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT id, status, "providerOrderId", "providerStatus", "creditAmount"
        FROM "TopupRequest"
        WHERE id = $1
      `,
      [topupId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Topup request not found: ${topupId}`);
    }

    return result.rows[0] as {
      id: string;
      status: "pending" | "approved" | "rejected" | "expired";
      providerOrderId: string;
      providerStatus: string | null;
      creditAmount: number;
    };
  });
}
async function getPaymentLinkStatus(orderId: string) {
  const response = await fetch(
    `https://api.sandbox.midtrans.com/v1/payment-links/${orderId}/status`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Payment Link status: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as {
    usage_status?: string;
    purchase_history?: Array<{
      transaction_status?: string;
      payment_type?: string;
      acquirer?: string;
    }>;
  };
}

async function completeBcaVaSandboxPayment(
  context: import("@playwright/test").BrowserContext,
  paymentUrl: string,
) {
  const checkoutPage = await context.newPage();
  try {
    await checkoutPage.goto(paymentUrl, { waitUntil: "networkidle" });
    await checkoutPage.locator("#customer-fullname").fill("HRD Admin");
    await checkoutPage.locator("#customer-phone").fill("081234567890");
    await checkoutPage.locator("#customer-email").fill(ADMIN_EMAIL);
    await expect(checkoutPage.getByRole("button", { name: /next/i })).toBeEnabled();
    await checkoutPage.getByRole("button", { name: /next/i }).click();
    await checkoutPage.locator("iframe#snap-midtrans").waitFor({ state: "attached" });
    await checkoutPage.waitForTimeout(3_000);

    const snapFrame = checkoutPage.frameLocator("iframe#snap-midtrans");
    await expect(snapFrame.locator("#bank_transfer")).toBeAttached({ timeout: 45_000 });
    await snapFrame.locator("#bank_transfer .collapse-button").click();
    await snapFrame.locator('a[href*="/bank-transfer/bca-va"]').first().click();

    const vaNumber = (await snapFrame.locator("#vaField").innerText()).trim();
    expect(vaNumber).toMatch(/^\d+$/);

    const simulatorPage = await context.newPage();
    try {
      await simulatorPage.goto("https://simulator.sandbox.midtrans.com/bca/va/index", {
        waitUntil: "domcontentloaded",
      });
      await simulatorPage.locator('input[name="va_number"]').fill(vaNumber);
      await simulatorPage.locator('input[type="submit"]').click();
      await simulatorPage.locator('input[name="total_amount"]').waitFor();
      await simulatorPage.locator('input[type="submit"][value="Pay"]').click();
      await expect(simulatorPage.getByText(/simulated payment is successful/i)).toBeVisible();
    } finally {
      await simulatorPage.close();
    }
  } finally {
    await checkoutPage.close();
  }
}

test.describe.serial("Topup Flow", () => {
  test.beforeEach(async ({ page }) => {
    await resetTopupState();
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

  test("topup page shows payment link method", async ({ page }) => {
    await expect(page.getByText(/midtrans payment link/i)).toBeVisible();
  });

  test("topup form has payment link create button", async ({ page }) => {
    await page.getByText("Starter").click();
    await expect(page.getByRole("button", { name: /create payment link/i })).toBeVisible();
  });

  test("topup page shows payment link panel", async ({ page }) => {
    await expect(page.getByText(/payment link appears after you create a payment/i)).toBeVisible();
  });

  test("payment link BCA VA sandbox settlement adds starter credits to the account", async ({ page, context }) => {
    test.setTimeout(90_000);

    const adminBefore = await getAdminState();
    expect(adminBefore.creditBalance).toBe(BASELINE_BALANCE);

    await page.getByText("Starter").click();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/topup/qris") && response.request().method() === "POST",
    );

    await page.getByRole("button", { name: /create payment link/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();

    const createBody = (await createResponse.json()) as {
      success: boolean;
      topupRequestId: string;
      orderId: string;
      status: string;
      providerStatus: string;
      paymentUrl: string | null;
    };

    expect(createBody.success).toBe(true);
    expect(createBody.status).toBe("pending");
    expect(createBody.providerStatus).toBe("pending");
    expect(createBody.paymentUrl).toMatch(
      /^https:\/\/app(\.sandbox)?\.midtrans\.com\/payment-links\//,
    );

    await expect(page.getByRole("link", { name: /open payment link/i })).toBeVisible();

    await page.getByRole("button", { name: /check status/i }).click();
    await expect(page.getByText(/provider: pending/i)).toBeVisible();

    const pendingTopup = await getTopupState(createBody.topupRequestId);
    expect(pendingTopup.status).toBe("pending");
    expect(pendingTopup.creditAmount).toBe(STARTER_CREDITS);
    expect(createBody.paymentUrl).not.toBeNull();

    await completeBcaVaSandboxPayment(context, createBody.paymentUrl!);

    await expect
      .poll(async () => {
        const status = await getPaymentLinkStatus(createBody.orderId);
        const latestPurchase = status.purchase_history?.[status.purchase_history.length - 1];

        return {
          usageStatus: status.usage_status,
          transactionStatus: latestPurchase?.transaction_status,
          paymentType: latestPurchase?.payment_type,
          acquirer: latestPurchase?.acquirer,
        };
      }, { timeout: 30_000 })
      .toEqual({
        usageStatus: "COMPLETE",
        transactionStatus: "settlement",
        paymentType: "BANK_TRANSFER",
        acquirer: "bca",
      });

    await page.getByRole("button", { name: /check status/i }).click();

    await expect
      .poll(async () => {
        const [adminAfter, topupAfter] = await Promise.all([
          getAdminState(),
          getTopupState(createBody.topupRequestId),
        ]);

        return {
          balance: adminAfter.creditBalance,
          status: topupAfter.status,
          providerStatus: topupAfter.providerStatus,
        };
      }, { timeout: 30_000 })
      .toEqual({
        balance: BASELINE_BALANCE + STARTER_CREDITS,
        status: "approved",
        providerStatus: "settlement",
      });

    await expect(page.getByText("Payment successful").first()).toBeVisible();
    await expect(
      page.getByText(`Current balance: ${BASELINE_BALANCE + STARTER_CREDITS} credits`, {
        exact: false,
      }),
    ).toBeVisible();
  });
});
