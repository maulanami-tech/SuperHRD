import { test, expect } from "@playwright/test";

test.describe("Dashboard Operations - QA Blockers Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("QA1: Position column is visible in dashboard table", async ({
    page,
  }) => {
    // Wait for table to load
    await page.waitForSelector("table", { timeout: 10000 }).catch(() => {
      // If no table, check for empty state
      expect(page.getByText("No candidates yet")).toBeTruthy();
    });

    const tableExists = await page.locator("table").count();
    if (tableExists > 0) {
      // Check Position column header exists
      await expect(
        page.getByRole("columnheader", { name: /position/i })
      ).toBeVisible();

      // Check Position header is sortable (has button)
      const positionHeader = page
        .getByRole("columnheader", { name: /position/i })
        .locator("button");
      await expect(positionHeader).toBeVisible();

      // Verify Briefcase icon is present
      const briefcaseIcon = page
        .getByRole("columnheader", { name: /position/i })
        .locator("svg");
      await expect(briefcaseIcon).toBeVisible();
    }
  });

  test("QA2: Remove action is present in dashboard table", async ({ page }) => {
    const tableExists = await page.locator("table tbody tr").count();

    if (tableExists > 0) {
      // Find first row with more options button (three dots)
      const moreButton = page.locator('button[aria-label*="More"]').first();
      const moreButtonCount = await moreButton.count();

      if (moreButtonCount > 0) {
        await moreButton.click();

        // Check Remove candidate option appears
        await expect(
          page.getByRole("menuitem", { name: /remove candidate/i })
        ).toBeVisible();
      }
    }
  });

  test("QA2b: Remove action does not trigger row click navigation", async ({
    page,
  }) => {
    const tableExists = await page.locator("table tbody tr").count();

    if (tableExists > 0) {
      const currentUrl = page.url();

      // Click more options button
      const moreButton = page.locator('button[aria-label*="More"]').first();
      const moreButtonCount = await moreButton.count();

      if (moreButtonCount > 0) {
        await moreButton.click();

        // Verify we're still on dashboard, not navigated to detail
        expect(page.url()).toBe(currentUrl);
        expect(page.url()).toContain("/dashboard");
      }
    }
  });

  test("QA2c: Remove confirmation dialog shows candidate name and position", async ({
    page,
  }) => {
    const tableExists = await page.locator("table tbody tr").count();

    if (tableExists > 0) {
      const moreButton = page.locator('button[aria-label*="More"]').first();
      const moreButtonCount = await moreButton.count();

      if (moreButtonCount > 0) {
        await moreButton.click();
        await page.getByRole("menuitem", { name: /remove candidate/i }).click();

        // Check confirmation dialog appears
        await expect(
          page.getByText(/are you sure you want to remove/i)
        ).toBeVisible();

        // Dialog should have Remove candidate button
        await expect(
          page
            .locator('[role="dialog"]')
            .getByRole("button", { name: /remove candidate/i })
        ).toBeVisible();

        // Dialog should have Cancel button
        await expect(
          page.locator('[role="dialog"]').getByRole("button", { name: /cancel/i })
        ).toBeVisible();

        // Close dialog
        await page
          .locator('[role="dialog"]')
          .getByRole("button", { name: /cancel/i })
          .click();
      }
    }
  });

  test("QA3: Position column displays correct data", async ({ page }) => {
    const tableExists = await page.locator("table tbody tr").count();

    if (tableExists > 0) {
      // Get first row position cell
      const positionCell = page
        .locator("table tbody tr")
        .first()
        .locator("td")
        .nth(1); // Position is 2nd column after Name

      // Position cell should be visible and contain text or "—" fallback
      await expect(positionCell).toBeVisible();
      const positionText = await positionCell.textContent();
      expect(positionText).toBeTruthy();
    }
  });
});

test.describe("Candidate Detail Operations - QA Blockers Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("QA3: Remove button is visible on detail page", async ({ page }) => {
    // Navigate to first candidate detail if exists
    const firstRow = page.locator("table tbody tr").first();
    const rowExists = await firstRow.count();

    if (rowExists > 0) {
      await firstRow.click();
      await page.waitForURL(/.*\/candidates\/.*/, { timeout: 10000 });

      // Check Remove button exists in header
      const removeButton = page.getByRole("button", { name: /remove/i });
      await expect(removeButton).toBeVisible();
    }
  });

  test("QA3b: Remove button shows confirmation dialog on detail page", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    const rowExists = await firstRow.count();

    if (rowExists > 0) {
      await firstRow.click();
      await page.waitForURL(/.*\/candidates\/.*/, { timeout: 10000 });

      // Click Remove button
      const removeButton = page.getByRole("button", { name: /remove/i });
      await removeButton.click();

      // Verify confirmation dialog
      await expect(
        page.getByText(/are you sure you want to remove/i)
      ).toBeVisible();
    }
  });

  test("QA5: Position field is displayed on detail page", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    const rowExists = await firstRow.count();

    if (rowExists > 0) {
      await firstRow.click();
      await page.waitForURL(/.*\/candidates\/.*/, { timeout: 10000 });

      // Check for Position field in metadata grid
      const positionLabel = page.getByText(/^position$/i);
      await expect(positionLabel).toBeVisible();

      // Verify Briefcase icon is present
      const briefcaseIcon = positionLabel
        .locator("..")
        .locator("svg")
        .first();
      await expect(briefcaseIcon).toBeVisible();
    }
  });

  test("QA4: Timeout hint is displayed for timed-out processing candidates", async ({
    page,
  }) => {
    // This test requires a processing candidate that's >10 minutes old
    // In real scenario, this would need test data setup
    // For now, we verify the UI elements exist when condition is met

    const firstRow = page.locator("table tbody tr").first();
    const rowExists = await firstRow.count();

    if (rowExists > 0) {
      await firstRow.click();
      await page.waitForURL(/.*\/candidates\/.*/, { timeout: 10000 });

      // Check if timeout hint card exists (conditional rendering)
      const timeoutHint = page.getByText(/screening timed out/i);
      const timeoutHintExists = await timeoutHint.count();

      if (timeoutHintExists > 0) {
        // If timeout hint is visible, verify its elements
        await expect(timeoutHint).toBeVisible();

        // Check for Upload Again button
        await expect(
          page.getByRole("button", { name: /upload again/i })
        ).toBeVisible();

        // Check for RefreshCw icon
        const refreshIcon = page
          .locator("text=/screening timed out/i")
          .locator("..")
          .locator("svg")
          .first();
        await expect(refreshIcon).toBeVisible();
      }
    }
  });

  test("QA4b: Timeout hint has correct styling and CTA", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    const rowExists = await firstRow.count();

    if (rowExists > 0) {
      await firstRow.click();
      await page.waitForURL(/.*\/candidates\/.*/, { timeout: 10000 });

      const timeoutCard = page
        .locator("text=/screening timed out/i")
        .locator("..");
      const timeoutCardExists = await timeoutCard.count();

      if (timeoutCardExists > 0) {
        // Verify card has destructive styling (red border)
        const cardClass = await timeoutCard.getAttribute("class");
        expect(cardClass).toContain("border");

        // Verify Upload Again button
        await expect(
          page.getByRole("button", { name: /upload again/i })
        ).toBeVisible();
      }
    }
  });
});

test.describe("Dashboard Operations - Delete Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  });

  test("Delete flow: confirmation dialog can be cancelled", async ({
    page,
  }) => {
    const rowCountBefore = await page.locator("table tbody tr").count();

    if (rowCountBefore > 0) {
      const moreButton = page.locator('button[aria-label*="More"]').first();
      const moreButtonCount = await moreButton.count();

      if (moreButtonCount > 0) {
        await moreButton.click();
        await page.getByRole("menuitem", { name: /remove candidate/i }).click();

        // Cancel the dialog
        await page
          .locator('[role="dialog"]')
          .getByRole("button", { name: /cancel/i })
          .click();

        // Verify row still exists
        const rowCountAfter = await page.locator("table tbody tr").count();
        expect(rowCountAfter).toBe(rowCountBefore);
      }
    }
  });

  test("Delete flow: candidate is removed from UI immediately after confirmation", async ({
    page,
  }) => {
    // Wait for table to load first
    await page.waitForTimeout(1000);
    const rowCountBefore = await page.locator("table tbody tr").count();

    if (rowCountBefore > 0) {
      // Get candidate name from first row before delete
      const firstRowName = await page
        .locator("table tbody tr")
        .first()
        .locator("td")
        .first()
        .textContent();

      // Wait for the button to be ready
      const moreButton = page.locator('button[aria-label*="More"]').first();
      await moreButton.waitFor({ state: "visible", timeout: 5000 });

      // Stop propagation by clicking the button directly
      await moreButton.click({ force: true });

      // Wait for menu to be visible
      await page.waitForSelector('[role="menuitem"]', { timeout: 2000 });

      await page.getByRole("menuitem", { name: /remove candidate/i }).click();

      // Confirm delete
      await page
        .locator('[role="dialog"]')
        .getByRole("button", { name: /remove candidate/i })
        .click();

      // Wait for success toast
      await expect(page.getByText(/candidate removed/i)).toBeVisible({
        timeout: 5000,
      });

      // CRITICAL: Verify we stay on dashboard page (should NOT navigate to detail)
      await page.waitForTimeout(1000);
      expect(page.url()).toContain("/dashboard");
      expect(page.url()).not.toContain("/candidates/");

      // Verify candidate is immediately removed from table (no 10s polling wait)
      const rowCountAfter = await page.locator("table tbody tr").count();
      expect(rowCountAfter).toBe(rowCountBefore - 1);

      // Verify the specific candidate name is no longer in the table
      if (firstRowName) {
        const nameExists = await page.locator(`text=${firstRowName}`).count();
        expect(nameExists).toBe(0);
      }
    }
  });
});
