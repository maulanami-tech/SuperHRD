-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_idempotencyKey_key" ON "Candidate"("idempotencyKey");
