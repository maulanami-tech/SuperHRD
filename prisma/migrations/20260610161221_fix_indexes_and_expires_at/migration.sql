-- DropIndex
DROP INDEX "Transaction_createdAt_idx";

-- DropIndex
DROP INDEX "Transaction_userId_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TopupRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amountIdr" INTEGER NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proofImageUrl" TEXT,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopupRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TopupRequest" ("amountIdr", "approvedAt", "approvedBy", "createdAt", "creditAmount", "expiresAt", "id", "notes", "paymentMethod", "proofImageUrl", "status", "userId") SELECT "amountIdr", "approvedAt", "approvedBy", "createdAt", "creditAmount", coalesce("expiresAt", CURRENT_TIMESTAMP) AS "expiresAt", "id", "notes", "paymentMethod", "proofImageUrl", "status", "userId" FROM "TopupRequest";
DROP TABLE "TopupRequest";
ALTER TABLE "new_TopupRequest" RENAME TO "TopupRequest";
CREATE INDEX "TopupRequest_userId_status_idx" ON "TopupRequest"("userId", "status");
CREATE INDEX "TopupRequest_status_createdAt_idx" ON "TopupRequest"("status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");
