import { expect, test } from "@playwright/test";

async function loginAsNonAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill("#email", "test@superhrd.com");
  await page.fill("#password", "test123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
}

test.describe("Admin navigation access", () => {
  test("admin sees admin menu in desktop sidebar and can open approval UI", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const adminLink = page.getByRole("link", { name: /top-up requests/i });

    await expect(adminLink).toBeVisible();
    await adminLink.click();

    await expect(page).toHaveURL(/.*\/admin\/topup-requests/);
    await expect(
      page.getByRole("heading", { name: "Top-Up Requests" })
    ).toBeVisible();
  });

  test("admin sees admin shortcut in mobile nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const mobileAdminLink = page.getByRole("link", { name: /approve/i });
    await expect(mobileAdminLink).toBeVisible();

    await mobileAdminLink.click();
    await expect(page).toHaveURL(/.*\/admin\/topup-requests/);
  });
});

test.describe("Non-admin isolation", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-admin does not see admin menu in desktop sidebar", async ({
    page,
  }) => {
    await loginAsNonAdmin(page);
    await expect(
      page.getByRole("link", { name: /top-up requests/i })
    ).toHaveCount(0);
  });

  test("non-admin does not see admin shortcut in mobile nav", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsNonAdmin(page);
    await expect(page.getByRole("link", { name: /approve/i })).toHaveCount(0);
  });

  test("non-admin is redirected away from admin route", async ({ page }) => {
    await loginAsNonAdmin(page);
    await page.goto("/admin/topup-requests");

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByText("Top-Up Requests")).toHaveCount(0);
  });

  test("non-admin gets 403 from admin API", async ({ page }) => {
    await loginAsNonAdmin(page);

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/admin/topup-requests?status=pending");
      return {
        status: res.status,
        body: await res.json(),
      };
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: "Forbidden" });
  });
});
