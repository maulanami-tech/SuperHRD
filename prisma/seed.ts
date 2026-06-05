import { hashSync } from "bcryptjs";
import { randomBytes } from "crypto";
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const defaultPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(16).toString("hex");
  const passwordHash = hashSync(defaultPassword, 10);

  await prisma.user.upsert({
    where: { email: "hrd@superhrd.com" },
    update: {},
    create: {
      name: "HRD Admin",
      email: "hrd@superhrd.com",
      passwordHash,
    },
  });

  console.log("Seed completed: HRD Admin user created");
  console.log(`Email: hrd@superhrd.com`);
  console.log(`Password: ${defaultPassword}`);
  console.log("Save this password! It will not be shown again.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
