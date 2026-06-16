import fs from "fs";
import os from "os";
import path from "path";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

const callbackSecret =
  process.env.N8N_CALLBACK_SECRET ?? "generate-a-random-secret-here";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL regression tests");
}

const testIds = {
  callbackSuccessCandidate: "candidate-callback-success",
  callbackPaidCandidate: "candidate-callback-paid",
  callbackQuotaCandidate: "candidate-callback-quota",
  timeoutPaidCandidate: "candidate-timeout-paid",
  timeoutQuotaCandidate: "candidate-timeout-quota",
  timeoutLateCandidate: "candidate-timeout-late",
  callbackSuccessRun: "run-success-1",
  callbackPaidRun: "run-error-paid-1",
  callbackQuotaRun: "run-error-quota-1",
  timeoutPaidRun: "run-timeout-paid-1",
  timeoutQuotaRun: "run-timeout-quota-1",
  timeoutLateRun: "run-timeout-late-1",
};

const MINIMAL_PDF =
  "%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF";

function getCurrentDateWIB() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function withClient<T>(fn: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function getUsers() {
  return withClient(async (client) => {
    const adminRes = await client.query(
      `SELECT id, name, email FROM "User" WHERE email = 'hrd@superhrd.com'`
    );
    const testUserRes = await client.query(
      `SELECT id, name, email FROM "User" WHERE email = 'test@superhrd.com'`
    );

    const admin = adminRes.rows[0];
    const testUser = testUserRes.rows[0];

    if (!admin || !testUser) {
      throw new Error("Seed users are required for regression tests");
    }

    return { admin, testUser };
  });
}

async function cleanupRegressionData() {
  await withClient(async (client) => {
    await client.query(
      `
        DELETE FROM "ScreeningResult"
        WHERE "candidateId" = ANY($1::text[])
      `,
      [[
        testIds.callbackSuccessCandidate,
        testIds.callbackPaidCandidate,
        testIds.callbackQuotaCandidate,
        testIds.timeoutPaidCandidate,
        testIds.timeoutQuotaCandidate,
        testIds.timeoutLateCandidate,
      ]]
    );

    await client.query(
      `
        DELETE FROM "Candidate"
        WHERE id = ANY($1::text[])
      `,
      [[
        testIds.callbackSuccessCandidate,
        testIds.callbackPaidCandidate,
        testIds.callbackQuotaCandidate,
        testIds.timeoutPaidCandidate,
        testIds.timeoutQuotaCandidate,
        testIds.timeoutLateCandidate,
      ]]
    );

    await client.query(
      `
        DELETE FROM "Transaction"
        WHERE metadata LIKE '%candidate-callback-%'
           OR metadata LIKE '%candidate-timeout-%'
      `
    );
  });
}

test.describe.serial("PostgreSQL callback and refund regression", () => {
  test.beforeAll(async () => {
    await cleanupRegressionData();
  });

  test.afterAll(async () => {
    await cleanupRegressionData();
  });

  test("callback completed marks candidate completed and stores screening result", async ({
    request,
  }) => {
    const { admin } = await getUsers();

    await withClient(async (client) => {
      await client.query(
        `
          INSERT INTO "Candidate" (
            id, name, email, "fileName", "filePath", status, "n8nRunId",
            "creditSource", "submittedBy", "submittedById", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, 'processing', $6, 'quota', $7, $8, NOW(), NOW())
        `,
        [
          testIds.callbackSuccessCandidate,
          "Callback Success",
          "success@example.com",
          "success.pdf",
          "/uploads/success.pdf",
          testIds.callbackSuccessRun,
          admin.name,
          admin.id,
        ]
      );
    });

    const res = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": callbackSecret },
      data: {
        runId: testIds.callbackSuccessRun,
        status: "completed",
        overallScore: 88,
        summary: "Strong profile",
        criteria: [{ name: "Experience", score: 90, notes: "Relevant" }],
        rawResponse: "ok",
      },
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT c.status, c."overallScore", sr.summary
              FROM "Candidate" c
              LEFT JOIN "ScreeningResult" sr ON sr."candidateId" = c.id
              WHERE c.id = $1
            `,
            [testIds.callbackSuccessCandidate]
          );

          const row = result.rows[0];
          return {
            status: row?.status ?? null,
            overallScore: row?.overallScore ?? null,
            summary: row?.summary ?? null,
          };
        })
      )
      .toEqual({
        status: "completed",
        overallScore: 88,
        summary: "Strong profile",
      });
  });

  test("callback error refunds paid credit and repeated callback does not double refund", async ({
    request,
  }) => {
    const { testUser } = await getUsers();

    await withClient(async (client) => {
      await client.query(
        `
          UPDATE "User"
          SET "creditBalance" = 4, "dailyQuotaUsed" = 0, "lastQuotaDate" = ''
          WHERE id = $1
        `,
        [testUser.id]
      );

      await client.query(
        `
          INSERT INTO "Candidate" (
            id, name, email, "fileName", "filePath", status, "n8nRunId",
            "creditSource", "submittedBy", "submittedById", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, 'processing', $6, 'paid', $7, $8, NOW(), NOW())
        `,
        [
          testIds.callbackPaidCandidate,
          "Callback Error Paid",
          "paid@example.com",
          "paid.pdf",
          "/uploads/paid.pdf",
          testIds.callbackPaidRun,
          testUser.name,
          testUser.id,
        ]
      );
    });

    const firstRes = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": callbackSecret },
      data: {
        runId: testIds.callbackPaidRun,
        status: "error",
        error: "Synthetic paid-credit failure",
      },
    });

    expect(firstRes.status()).toBe(200);

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                c.status,
                u."creditBalance",
                (
                  SELECT COUNT(*)
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                )::int AS "refundCount"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              WHERE c.id = $1
            `,
            [testIds.callbackPaidCandidate, `%${testIds.callbackPaidCandidate}%`]
          );

          const row = result.rows[0];
          return {
            status: row?.status ?? null,
            creditBalance: row?.creditBalance ?? null,
            refundCount: row?.refundCount ?? 0,
          };
        })
      )
      .toEqual({
        status: "failed",
        creditBalance: 5,
        refundCount: 1,
      });

    const retryRes = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": callbackSecret },
      data: {
        runId: testIds.callbackPaidRun,
        status: "error",
        error: "Synthetic paid-credit failure",
      },
    });

    expect(retryRes.status()).toBe(409);
    expect(await retryRes.json()).toMatchObject({
      error: "Candidate has already failed",
    });

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                u."creditBalance",
                (
                  SELECT COUNT(*)
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                )::int AS "refundCount"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              WHERE c.id = $1
            `,
            [testIds.callbackPaidCandidate, `%${testIds.callbackPaidCandidate}%`]
          );

          const row = result.rows[0];
          return {
            creditBalance: row?.creditBalance ?? null,
            refundCount: row?.refundCount ?? 0,
          };
        })
      )
      .toEqual({
        creditBalance: 5,
        refundCount: 1,
      });
  });

  test("callback error restores free quota without changing paid credits", async ({
    request,
  }) => {
    const { admin } = await getUsers();
    const today = getCurrentDateWIB();

    await withClient(async (client) => {
      await client.query(
        `
          UPDATE "User"
          SET "creditBalance" = 11, "dailyQuotaUsed" = 3, "lastQuotaDate" = $2
          WHERE id = $1
        `,
        [admin.id, today]
      );

      await client.query(
        `
          INSERT INTO "Candidate" (
            id, name, email, "fileName", "filePath", status, "n8nRunId",
            "creditSource", "submittedBy", "submittedById", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, 'processing', $6, 'quota', $7, $8, NOW(), NOW())
        `,
        [
          testIds.callbackQuotaCandidate,
          "Callback Error Quota",
          "quota@example.com",
          "quota.pdf",
          "/uploads/quota.pdf",
          testIds.callbackQuotaRun,
          admin.name,
          admin.id,
        ]
      );
    });

    const res = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": callbackSecret },
      data: {
        runId: testIds.callbackQuotaRun,
        status: "error",
        error: "Synthetic quota failure",
      },
    });

    expect(res.status()).toBe(200);

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                c.status,
                u."creditBalance",
                u."dailyQuotaUsed",
                u."lastQuotaDate",
                (
                  SELECT t."creditDelta"
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                  ORDER BY t."createdAt" DESC
                  LIMIT 1
                ) AS "refundDelta"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              WHERE c.id = $1
            `,
            [testIds.callbackQuotaCandidate, `%${testIds.callbackQuotaCandidate}%`]
          );

          const row = result.rows[0];
          return {
            status: row?.status ?? null,
            creditBalance: row?.creditBalance ?? null,
            dailyQuotaUsed: row?.dailyQuotaUsed ?? null,
            lastQuotaDate: row?.lastQuotaDate ?? null,
            refundDelta: row?.refundDelta ?? null,
          };
        })
      )
      .toEqual({
        status: "failed",
        creditBalance: 11,
        dailyQuotaUsed: 2,
        lastQuotaDate: today,
        refundDelta: 0,
      });
  });
});

test.describe.serial("PostgreSQL processing timeout refund regression", () => {
  test.beforeAll(async () => {
    await cleanupRegressionData();
  });

  test.afterAll(async () => {
    await cleanupRegressionData();
  });

  test("candidate list expires paid-credit processing candidates and refunds once", async ({
    request,
  }) => {
    const { admin } = await getUsers();

    await withClient(async (client) => {
      await client.query(
        `
          UPDATE "User"
          SET "creditBalance" = 2, "dailyQuotaUsed" = 5, "lastQuotaDate" = $2
          WHERE id = $1
        `,
        [admin.id, getCurrentDateWIB()]
      );

      await client.query(
        `
          INSERT INTO "Candidate" (
            id, name, email, "fileName", "filePath", status, "n8nRunId",
            "creditSource", "submittedBy", "submittedById", "createdAt", "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, 'processing', $6, 'paid', $7, $8,
            NOW() - INTERVAL '11 minutes', NOW() - INTERVAL '11 minutes'
          )
        `,
        [
          testIds.timeoutPaidCandidate,
          "Timeout Paid",
          "timeout-paid@example.com",
          "timeout-paid.pdf",
          "/uploads/timeout-paid.pdf",
          testIds.timeoutPaidRun,
          admin.name,
          admin.id,
        ]
      );
    });

    const res = await request.get("/api/candidates?status=failed");
    expect(res.status()).toBe(200);

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                c.status,
                u."creditBalance",
                (
                  SELECT COUNT(*)
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                    AND t.metadata LIKE '%processing_timeout%'
                )::int AS "refundCount"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              WHERE c.id = $1
            `,
            [testIds.timeoutPaidCandidate, `%${testIds.timeoutPaidCandidate}%`]
          );

          const row = result.rows[0];
          return {
            status: row?.status ?? null,
            creditBalance: row?.creditBalance ?? null,
            refundCount: row?.refundCount ?? 0,
          };
        })
      )
      .toEqual({
        status: "failed",
        creditBalance: 3,
        refundCount: 1,
      });

    const retryRes = await request.get("/api/candidates?status=failed");
    expect(retryRes.status()).toBe(200);

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                u."creditBalance",
                (
                  SELECT COUNT(*)
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                )::int AS "refundCount"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              WHERE c.id = $1
            `,
            [testIds.timeoutPaidCandidate, `%${testIds.timeoutPaidCandidate}%`]
          );

          const row = result.rows[0];
          return {
            creditBalance: row?.creditBalance ?? null,
            refundCount: row?.refundCount ?? 0,
          };
        })
      )
      .toEqual({
        creditBalance: 3,
        refundCount: 1,
      });
  });

  test("candidate detail expires quota processing candidates and restores quota", async ({
    request,
  }) => {
    const { admin } = await getUsers();
    const today = getCurrentDateWIB();

    await withClient(async (client) => {
      await client.query(
        `
          UPDATE "User"
          SET "creditBalance" = 11, "dailyQuotaUsed" = 3, "lastQuotaDate" = $2
          WHERE id = $1
        `,
        [admin.id, today]
      );

      await client.query(
        `
          INSERT INTO "Candidate" (
            id, name, email, "fileName", "filePath", status, "n8nRunId",
            "creditSource", "submittedBy", "submittedById", "createdAt", "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, 'processing', $6, 'quota', $7, $8,
            NOW() - INTERVAL '11 minutes', NOW() - INTERVAL '11 minutes'
          )
        `,
        [
          testIds.timeoutQuotaCandidate,
          "Timeout Quota",
          "timeout-quota@example.com",
          "timeout-quota.pdf",
          "/uploads/timeout-quota.pdf",
          testIds.timeoutQuotaRun,
          admin.name,
          admin.id,
        ]
      );
    });

    const res = await request.get(`/api/candidates/${testIds.timeoutQuotaCandidate}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "failed" });

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                c.status,
                u."creditBalance",
                u."dailyQuotaUsed",
                u."lastQuotaDate",
                (
                  SELECT t."creditDelta"
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                    AND t.metadata LIKE '%processing_timeout%'
                  ORDER BY t."createdAt" DESC
                  LIMIT 1
                ) AS "refundDelta"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              WHERE c.id = $1
            `,
            [testIds.timeoutQuotaCandidate, `%${testIds.timeoutQuotaCandidate}%`]
          );

          const row = result.rows[0];
          return {
            status: row?.status ?? null,
            creditBalance: row?.creditBalance ?? null,
            dailyQuotaUsed: row?.dailyQuotaUsed ?? null,
            lastQuotaDate: row?.lastQuotaDate ?? null,
            refundDelta: row?.refundDelta ?? null,
          };
        })
      )
      .toEqual({
        status: "failed",
        creditBalance: 11,
        dailyQuotaUsed: 2,
        lastQuotaDate: today,
        refundDelta: 0,
      });
  });

  test("late success callback after timeout fails candidate, refunds once, and stores no result", async ({
    request,
  }) => {
    const { admin } = await getUsers();

    await withClient(async (client) => {
      await client.query(
        `
          UPDATE "User"
          SET "creditBalance" = 7, "dailyQuotaUsed" = 5, "lastQuotaDate" = $2
          WHERE id = $1
        `,
        [admin.id, getCurrentDateWIB()]
      );

      await client.query(
        `
          INSERT INTO "Candidate" (
            id, name, email, "fileName", "filePath", status, "n8nRunId",
            "creditSource", "submittedBy", "submittedById", "createdAt", "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, 'processing', $6, 'paid', $7, $8,
            NOW() - INTERVAL '11 minutes', NOW() - INTERVAL '11 minutes'
          )
        `,
        [
          testIds.timeoutLateCandidate,
          "Timeout Late Callback",
          "timeout-late@example.com",
          "timeout-late.pdf",
          "/uploads/timeout-late.pdf",
          testIds.timeoutLateRun,
          admin.name,
          admin.id,
        ]
      );
    });

    const res = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": callbackSecret },
      data: {
        runId: testIds.timeoutLateRun,
        status: "completed",
        overallScore: 95,
        summary: "Late success should be ignored",
        criteria: [{ name: "Late", score: 95, notes: "Too late" }],
      },
    });

    expect(res.status()).toBe(409);

    await expect
      .poll(async () =>
        withClient(async (client) => {
          const result = await client.query(
            `
              SELECT
                c.status,
                sr.id AS "screeningResultId",
                u."creditBalance",
                (
                  SELECT COUNT(*)
                  FROM "Transaction" t
                  WHERE t."userId" = u.id
                    AND t.type = 'refund'
                    AND t.metadata LIKE $2
                )::int AS "refundCount"
              FROM "Candidate" c
              JOIN "User" u ON u.id = c."submittedById"
              LEFT JOIN "ScreeningResult" sr ON sr."candidateId" = c.id
              WHERE c.id = $1
            `,
            [testIds.timeoutLateCandidate, `%${testIds.timeoutLateCandidate}%`]
          );

          const row = result.rows[0];
          return {
            status: row?.status ?? null,
            screeningResultId: row?.screeningResultId ?? null,
            creditBalance: row?.creditBalance ?? null,
            refundCount: row?.refundCount ?? 0,
          };
        })
      )
      .toEqual({
        status: "failed",
        screeningResultId: null,
        creditBalance: 8,
        refundCount: 1,
      });
  });
});

test.describe.serial("PostgreSQL upload failure refund regression", () => {
  test("upload failure returns 503 and restores paid credit", async ({ page }) => {
    test.skip(
      process.env.E2E_FORCE_N8N_FAILURE !== "1",
      "This regression requires N8N_WEBHOOK_URL to be intentionally unreachable"
    );

    const { admin } = await getUsers();
    const today = getCurrentDateWIB();
    const candidateName = `Refund Failure ${Date.now()}`;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "superhrd-upload-"));
    const filePath = path.join(
      tempDir,
      `refund-failure-${Date.now().toString()}.pdf`
    );

    try {
      fs.writeFileSync(
        filePath,
        `${MINIMAL_PDF}\n% unique ${candidateName}\n`
      );

      await withClient(async (client) => {
        await client.query(
          `
            UPDATE "User"
            SET "creditBalance" = 2, "dailyQuotaUsed" = 5, "lastQuotaDate" = $2
            WHERE id = $1
          `,
          [admin.id, today]
        );
      });

      await page.goto("/upload");
      await page.fill("#name", candidateName);
      await page.fill("#email", "refund-failure@example.com");
      await page.fill("#posisi", "Backend Engineer");
      await page.fill("#kriteria", "Pengalaman PostgreSQL dan API integration");
      await page.fill("#prompt", "Tolong evaluasi CV ini");
      await page.setInputFiles('input[type="file"]', filePath);

      const uploadResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/upload") &&
          response.request().method() === "POST"
      );

      await page.getByRole("button", { name: /upload & screen/i }).click();

      const response = await uploadResponse;
      expect(response.status()).toBe(503);
      await expect(page.getByText(/credit refunded/i)).toBeVisible();

      await expect
        .poll(async () =>
          withClient(async (client) => {
            const result = await client.query(
              `
                SELECT
                  c.id,
                  c.status,
                  c."creditSource",
                  u."creditBalance",
                  u."dailyQuotaUsed",
                  u."lastQuotaDate",
                  (
                    SELECT COUNT(*)
                    FROM "Transaction" t
                    WHERE t."userId" = u.id
                      AND t.type = 'refund'
                      AND t.metadata LIKE ('%' || c.id || '%')
                  )::int AS "refundCount"
                FROM "Candidate" c
                JOIN "User" u ON u.id = c."submittedById"
                WHERE c.name = $1 AND c."submittedById" = $2
                ORDER BY c."createdAt" DESC
                LIMIT 1
              `,
              [candidateName, admin.id]
            );

            const row = result.rows[0];
            return {
              candidateStatus: row?.status ?? null,
              creditSource: row?.creditSource ?? null,
              creditBalance: row?.creditBalance ?? null,
              dailyQuotaUsed: row?.dailyQuotaUsed ?? null,
              lastQuotaDate: row?.lastQuotaDate ?? null,
              refundCount: row?.refundCount ?? 0,
            };
          })
        )
        .toEqual({
          candidateStatus: "failed",
          creditSource: "paid",
          creditBalance: 2,
          dailyQuotaUsed: 5,
          lastQuotaDate: today,
          refundCount: 1,
        });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
