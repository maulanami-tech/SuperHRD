import "dotenv/config";
import { test, expect } from "@playwright/test";

test.describe("API Routes - CLI Validation", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("GET /api/candidates returns 401 when unauthenticated", async ({
    request,
  }) => {
    const res = await request.get("/api/candidates");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("GET /api/candidates/[id] returns 401 when unauthenticated", async ({
    request,
  }) => {
    const res = await request.get("/api/candidates/some-id");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/upload returns 401 when unauthenticated", async ({
    request,
  }) => {
    const res = await request.post("/api/upload");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/n8n/callback returns 401 without secret", async ({
    request,
  }) => {
    const res = await request.post("/api/n8n/callback", {
      data: { runId: "test", overallScore: 85, summary: "test", criteria: [] },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid secret");
  });

  test("POST /api/n8n/callback returns 401 with wrong secret", async ({
    request,
  }) => {
    const res = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": "wrong-secret" },
      data: { runId: "test", overallScore: 85, summary: "test", criteria: [] },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid secret");
  });

  test("POST /api/n8n/callback returns 400 with valid secret but invalid payload", async ({
    request,
  }) => {
    test.skip(
      !process.env.N8N_CALLBACK_SECRET,
      "N8N_CALLBACK_SECRET is not configured for this test environment"
    );
    const secret = process.env.N8N_CALLBACK_SECRET ?? "shared-secret-with-n8n";
    const res = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": secret },
      data: { runId: "", overallScore: "not-a-number" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid payload");
  });

  test("POST /api/n8n/callback returns 404 for unknown runId", async ({
    request,
  }) => {
    test.skip(
      !process.env.N8N_CALLBACK_SECRET,
      "N8N_CALLBACK_SECRET is not configured for this test environment"
    );
    const secret = process.env.N8N_CALLBACK_SECRET ?? "shared-secret-with-n8n";
    const res = await request.post("/api/n8n/callback", {
      headers: { "x-callback-secret": secret },
      data: {
        runId: "non-existent-run-id",
        overallScore: 85,
        summary: "Good candidate",
        criteria: [
          { name: "Experience", score: 80, notes: "5 years" },
        ],
      },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Candidate not found");
  });

  test("GET /login page returns 200", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);
  });

  test("GET / returns landing page when unauthenticated", async ({
    request,
  }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });
});
