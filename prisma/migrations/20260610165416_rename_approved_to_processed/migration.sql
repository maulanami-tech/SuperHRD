/*
  Warnings:

  - You are about to drop the column `approvedAt` on the `TopupRequest` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `TopupRequest` table. All the data in the column will be lost.

*/
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
    "processedBy" TEXT,
    "processedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopupRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TopupRequest" ("amountIdr", "createdAt", "creditAmount", "expiresAt", "id", "notes", "paymentMethod", "proofImageUrl", "status", "userId") SELECT "amountIdr", "createdAt", "creditAmount", "expiresAt", "id", "notes", "paymentMethod", "proofImageUrl", "status", "userId" FROM "TopupRequest";
DROP TABLE "TopupRequest";
ALTER TABLE "new_TopupRequest" RENAME TO "TopupRequest";
CREATE INDEX "TopupRequest_userId_status_idx" ON "TopupRequest"("userId", "status");
CREATE INDEX "TopupRequest_status_createdAt_idx" ON "TopupRequest"("status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
