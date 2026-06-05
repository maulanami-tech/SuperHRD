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
});

test.afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test.describe("Upload Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "hrd@superhrd.com");
    await page.fill("#password", "admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    await page.goto("/upload");
  });

  test("upload page renders with form fields and dropzone", async ({
    page,
  }) => {
    await expect(page.getByText("Candidate Information")).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.getByText("Drag & drop your CV here")).toBeVisible();
    await expect(page.getByText("PDF or DOCX, max 10MB")).toBeVisible();
  });

  test("submit button is disabled without a file", async ({ page }) => {
    await page.fill("#name", "John Doe");
    const submitBtn = page.getByRole("button", { name: /upload & screen/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("submit button is enabled when name and file are provided", async ({
    page,
  }) => {
    await page.fill("#name", "John Doe");
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

  test("upload without candidate name shows validation error", async ({
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
});
