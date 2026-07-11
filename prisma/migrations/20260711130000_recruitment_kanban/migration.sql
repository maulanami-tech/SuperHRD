-- Custom fields
CREATE TYPE "CandidateFieldType" AS ENUM ('number','currency','text','date');

CREATE TABLE "CandidateFieldDefinition" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "CandidateFieldType" NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateFieldDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CandidateFieldDefinition_ownerId_order_idx" ON "CandidateFieldDefinition"("ownerId","order");
ALTER TABLE "CandidateFieldDefinition" ADD CONSTRAINT "CandidateFieldDefinition_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CandidateFieldValue" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "fieldDefinitionId" TEXT NOT NULL,
  "valueNumber" DOUBLE PRECISION,
  "valueText" TEXT,
  "valueDate" TIMESTAMP(3),
  CONSTRAINT "CandidateFieldValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CandidateFieldValue_candidateId_fieldDefinitionId_key" ON "CandidateFieldValue"("candidateId","fieldDefinitionId");
CREATE INDEX "CandidateFieldValue_fieldDefinitionId_idx" ON "CandidateFieldValue"("fieldDefinitionId");
ALTER TABLE "CandidateFieldValue" ADD CONSTRAINT "CandidateFieldValue_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateFieldValue" ADD CONSTRAINT "CandidateFieldValue_fieldDefinitionId_fkey"
  FOREIGN KEY ("fieldDefinitionId") REFERENCES "CandidateFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Relational pipeline stages (replaces the fixed PipelineStage enum)
CREATE TABLE "PipelineStageNew" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'slate',
  "order" INTEGER NOT NULL,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStageNew_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PipelineStageNew_ownerId_order_idx" ON "PipelineStageNew"("ownerId","order");
ALTER TABLE "PipelineStageNew" ADD CONSTRAINT "PipelineStageNew_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Candidate" ADD COLUMN "pipelineStageId" TEXT;

-- Backfill: create a default 5-stage set per owner that already has candidates,
-- then point each candidate at the matching new stage row.
DO $$
DECLARE
  owner RECORD;
  stage_shortlisted TEXT;
  stage_interview TEXT;
  stage_offered TEXT;
  stage_hired TEXT;
  stage_rejected TEXT;
BEGIN
  FOR owner IN SELECT DISTINCT "submittedById" AS id FROM "Candidate" LOOP
    stage_shortlisted := gen_random_uuid()::text;
    stage_interview := gen_random_uuid()::text;
    stage_offered := gen_random_uuid()::text;
    stage_hired := gen_random_uuid()::text;
    stage_rejected := gen_random_uuid()::text;

    INSERT INTO "PipelineStageNew" ("id","ownerId","name","color","order","isTerminal")
    VALUES
      (stage_shortlisted, owner.id, 'Shortlisted', 'slate', 0, false),
      (stage_interview, owner.id, 'Interview', 'indigo', 1, false),
      (stage_offered, owner.id, 'Offered', 'violet', 2, false),
      (stage_hired, owner.id, 'Hired', 'emerald', 3, false),
      (stage_rejected, owner.id, 'Rejected', 'red', 4, true);

    UPDATE "Candidate" SET "pipelineStageId" = CASE "pipelineStage"
      WHEN 'shortlisted' THEN stage_shortlisted
      WHEN 'interview' THEN stage_interview
      WHEN 'offered' THEN stage_offered
      WHEN 'hired' THEN stage_hired
      WHEN 'rejected' THEN stage_rejected
    END
    WHERE "submittedById" = owner.id;
  END LOOP;
END $$;

ALTER TABLE "Candidate" DROP COLUMN "pipelineStage";
DROP TYPE "PipelineStage";

ALTER TABLE "PipelineStageNew" RENAME TO "PipelineStage";
ALTER INDEX "PipelineStageNew_pkey" RENAME TO "PipelineStage_pkey";
ALTER INDEX "PipelineStageNew_ownerId_order_idx" RENAME TO "PipelineStage_ownerId_order_idx";
ALTER TABLE "PipelineStage" RENAME CONSTRAINT "PipelineStageNew_ownerId_fkey" TO "PipelineStage_ownerId_fkey";

CREATE INDEX "Candidate_pipelineStageId_idx" ON "Candidate"("pipelineStageId");
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_pipelineStageId_fkey"
  FOREIGN KEY ("pipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
