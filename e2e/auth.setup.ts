import { test as setup, expect } from "@playwright/test";
import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const authFile = ".playwright/auth.json";

setup("authenticate", async ({ page }) => {
  const now = new Date().toISOString();
  const passwordHash = hashSync("admin123", 10);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  await prisma.user.upsert({
    where: { email: "hrd@superhrd.com" },
    update: {
      name: "HRD Admin",
      passwordHash,
      creditBalance: 25,
      dailyQuotaUsed: 0,
      lastQuotaDate: "",
      isAdmin: true,
    },
    create: {
      id: "test-admin-user",
      name: "HRD Admin",
      email: "hrd@superhrd.com",
      passwordHash,
      creditBalance: 25,
      dailyQuotaUsed: 0,
      lastQuotaDate: "",
      isAdmin: true,
      createdAt: now,
    },
  });

  await prisma.user.updateMany({
    where: {
      email: "hrd@superhrd.com",
      creditBalance: { lt: 25 },
    },
    data: { creditBalance: 25 },
  });

  await prisma.rateLimit.deleteMany({
    where: {
      key: {
        startsWith: "login:",
      },
    },
  });

  await prisma.$disconnect();

  await page.goto("/login");
  await page.fill("#email", "hrd@superhrd.com");
  await page.fill("#password", "admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: authFile });
});
