import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";
import { randomBytes } from "crypto";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const defaultPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(16).toString("hex");
  const passwordHash = hashSync(defaultPassword, 10);
  const now = new Date();

  // Create/update admin user
  const admin = await prisma.user.upsert({
    where: { email: "hrd@superhrd.com" },
    update: {
      isAdmin: true,
      emailVerified: now,
    },
    create: {
      name: "HRD Admin",
      email: "hrd@superhrd.com",
      passwordHash,
      emailVerified: now,
      isAdmin: true,
      creditBalance: 0,
      dailyQuotaUsed: 0,
      lastQuotaDate: "",
    },
  });

  console.log("Admin user created/updated:", admin.email);

  // Create regular test user
  const testPassword = hashSync("test123", 10);

  const testUser = await prisma.user.upsert({
    where: { email: "test@superhrd.com" },
    update: {
      emailVerified: now,
    },
    create: {
      name: "Test User",
      email: "test@superhrd.com",
      passwordHash: testPassword,
      emailVerified: now,
      isAdmin: false,
      creditBalance: 10,
      dailyQuotaUsed: 0,
      lastQuotaDate: "",
    },
  });

  console.log("Test user created/updated:", testUser.email);

  console.log("\nCredentials:");
  console.log(`Admin: hrd@superhrd.com / ${defaultPassword}`);
  console.log(`Test:  test@superhrd.com / test123`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
