import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.SUPERHRD_E2E_BASE_URL ??
  "https://superhrd.wigodigital.my.id";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "html",
  timeout: 45_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "prod-setup",
      testMatch: /auth\.production\.setup\.ts/,
    },
    {
      name: "prod-chromium-safe",
      testMatch: [
        /landing\.spec\.ts/,
        /auth\.spec\.ts/,
        /dashboard\.spec\.ts/,
        /navigation\.spec\.ts/,
        /credit-history\.spec\.ts/,
        /topup\.spec\.ts/,
        /candidate-detail\.spec\.ts/,
        /admin\.spec\.ts/,
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/prod-auth.json",
      },
      dependencies: ["prod-setup"],
    },
  ],
});
