CREATE TYPE "JobPositionStatus" AS ENUM ('open','closed','archived');
CREATE TABLE "JobPosition" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kriteria" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "status" "JobPositionStatus" NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobPosition_ownerId_status_idx" ON "JobPosition"("ownerId","status");
ALTER TABLE "JobPosition" ADD CONSTRAINT "JobPosition_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Candidate" ADD COLUMN "jobPositionId" TEXT;
CREATE INDEX "Candidate_jobPositionId_idx" ON "Candidate"("jobPositionId");
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobPositionId_fkey"
  FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UploadBatch" ADD COLUMN "jobPositionId" TEXT;
CREATE INDEX "UploadBatch_jobPositionId_idx" ON "UploadBatch"("jobPositionId");
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_jobPositionId_fkey"
  FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
