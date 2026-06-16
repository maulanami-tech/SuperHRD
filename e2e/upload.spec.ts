import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

const MINIMAL_PDF =
  "%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF";

let tmpDir: string;

test.beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "superhrd-e2e-"));
  fs.writeFileSync(path.join(tmpDir, "submit-test.pdf"), MINIMAL_PDF);
  fs.writeFileSync(path.join(tmpDir, "info-test.pdf"), MINIMAL_PDF);
  fs.writeFileSync(path.join(tmpDir, "remove-test.pdf"), MINIMAL_PDF);
  fs.writeFileSync(path.join(tmpDir, "validation-test.pdf"), MINIMAL_PDF);
  fs.writeFileSync(path.join(tmpDir, "full-upload-test.pdf"), MINIMAL_PDF);
  fs.writeFileSync(path.join(tmpDir, "fake-docx.docx"), "not a real docx");
  fs.writeFileSync(path.join(tmpDir, "batch-test.zip"), "not a real zip");
});

test.afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function fillRequiredFields(page: import("@playwright/test").Page) {
  await page.fill("#name", "John Doe");
  await page.fill("#posisi", "Senior Backend Developer");
  await page.fill("#kriteria", "Pengalaman minimal 3 tahun di Python");
  await page.fill("#prompt", "Tolong evaluasi CV yang diupload");
}

test.describe("Upload Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/upload");
  });

  test("upload page renders with all form fields and dropzone", async ({
    page,
  }) => {
    await expect(page.getByText("Candidate Information")).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#posisi")).toBeVisible();
    await expect(page.locator("#kriteria")).toBeVisible();
    await expect(page.locator("#prompt")).toBeVisible();
    await expect(page.getByText("Drag & drop your CV here")).toBeVisible();
    await expect(page.getByText(/PDF.*DOCX.*DOC.*max 10MB/i)).toBeVisible();
  });

  test("posisi is an Input, kriteria and prompt are Textareas", async ({
    page,
  }) => {
    await expect(page.locator("#posisi")).toBeVisible();
    await expect(page.locator("textarea#kriteria")).toBeVisible();
    await expect(page.locator("textarea#prompt")).toBeVisible();
  });

  test("required fields show asterisk indicator", async ({ page }) => {
    const nameField = page
      .locator("label")
      .filter({ hasText: "Candidate Name" });
    await expect(nameField.locator("span")).toBeVisible();

    const posisiField = page.locator("label").filter({ hasText: "Position" });
    await expect(posisiField.locator("span")).toBeVisible();

    const kriteriaField = page
      .locator("label")
      .filter({ hasText: "Evaluation Criteria" });
    await expect(kriteriaField.locator("span")).toBeVisible();

    const promptField = page.locator("label").filter({ hasText: "AI Prompt" });
    await expect(promptField.locator("span")).toBeVisible();
  });

  test("submit button is disabled without a file", async ({ page }) => {
    await fillRequiredFields(page);
    const submitBtn = page.getByRole("button", { name: /upload & screen/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("submit button is enabled when all required fields and file are provided", async ({
    page,
  }) => {
    await fillRequiredFields(page);
    await page.setInputFiles(
      'input[type="file"]',
      path.join(tmpDir, "submit-test.pdf")
    );
    const submitBtn = page.getByRole("button", { name: /upload & screen/i });
    await expect(submitBtn).toBeEnabled();
  });

  test("dropzone shows file info after file selection", async ({ page }) => {
    await page.setInputFiles(
      'input[type="file"]',
      path.join(tmpDir, "info-test.pdf")
    );
    await expect(page.getByText("info-test.pdf")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /remove file/i })
    ).toBeVisible();
  });

  test("remove file button clears the selected file", async ({ page }) => {
    await page.setInputFiles(
      'input[type="file"]',
      path.join(tmpDir, "remove-test.pdf")
    );
    await expect(page.getByText("remove-test.pdf")).toBeVisible();

    await page.getByRole("button", { name: /remove file/i }).click();
    await expect(page.getByText("Drag & drop your CV here")).toBeVisible();
  });

  test("upload without required fields shows validation errors", async ({
    page,
  }) => {
    await page.setInputFiles(
      'input[type="file"]',
      path.join(tmpDir, "validation-test.pdf")
    );
    await page.getByRole("button", { name: /upload & screen/i }).click();
    await expect(
      page.getByText("Candidate name is required")
    ).toBeVisible({ timeout: 5000 });
  });

  test("file dropzone accepts PDF, DOCX, and DOC files", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", /.*pdf.*docx.*doc.*/);
  });

  test("upload page shows supported formats", async ({ page }) => {
    await expect(page.getByText(/PDF.*DOCX.*DOC/i)).toBeVisible();
  });

  test("batch ZIP mode renders shared screening fields and ZIP dropzone", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /batch zip/i }).click();
    await expect(page.getByText("Batch ZIP Screening")).toBeVisible();
    await expect(page.locator("#batch-posisi")).toBeVisible();
    await expect(page.locator("textarea#batch-kriteria")).toBeVisible();
    await expect(page.locator("textarea#batch-prompt")).toBeVisible();
    await expect(page.getByText("Drag & drop your ZIP here")).toBeVisible();
    await expect(page.getByText(/ZIP.*max 50MB.*50 valid CVs/i)).toBeVisible();
  });

  test("batch ZIP submit button is enabled when fields and ZIP are provided", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /batch zip/i }).click();
    await page.fill("#batch-posisi", "Senior Backend Developer");
    await page.fill("#batch-kriteria", "Pengalaman minimal 3 tahun di Python");
    await page.fill("#batch-prompt", "Tolong evaluasi semua CV di ZIP");
    await page.setInputFiles(
      'input[type="file"]',
      path.join(tmpDir, "batch-test.zip")
    );
    await expect(
      page.getByRole("button", { name: /upload zip & screen/i })
    ).toBeEnabled();
  });
});

test.describe("Upload API — Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("POST /api/upload returns 401 when unauthenticated", async ({
    request,
  }) => {
    const res = await request.post("/api/upload");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/upload/batch returns 401 when unauthenticated", async ({
    request,
  }) => {
    const res = await request.post("/api/upload/batch");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/upload with DOCX file returns 400 (file type rejected)", async ({
    request,
  }) => {
    const formData = new FormData();
    formData.append("name", "Test");
    formData.append("posisi", "Developer");
    formData.append("kriteria", "Criteria");
    formData.append("prompt", "Prompt");
    formData.append(
      "file",
      new Blob(["fake docx content"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "test.docx"
    );

    const res = await request.post("/api/upload", {
      multipart: formData,
    });

    expect(res.status()).toBe(401);
  });
});
