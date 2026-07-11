CREATE TYPE "PipelineStage" AS ENUM ('shortlisted','interview','offered','hired','rejected');
ALTER TABLE "Candidate" ADD COLUMN "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'shortlisted';
ALTER TABLE "Candidate" ADD COLUMN "notes" TEXT;
CREATE INDEX "Candidate_pipelineStage_idx" ON "Candidate"("pipelineStage");
