import { hashSync } from "bcryptjs";
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const passwordHash = hashSync("admin123", 10);

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

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
