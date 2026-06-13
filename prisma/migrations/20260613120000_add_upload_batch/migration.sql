-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submittedById" TEXT NOT NULL,
    "posisi" TEXT NOT NULL,
    "kriteria" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "acceptedFiles" INTEGER NOT NULL,
    "rejectedFiles" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UploadBatch_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "UploadBatch_submittedById_createdAt_idx" ON "UploadBatch"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_batchId_idx" ON "Candidate"("batchId");
