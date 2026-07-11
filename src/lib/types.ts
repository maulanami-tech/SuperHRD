export interface ScreeningResult {
  id: string;
  candidateId: string;
  overallScore: number;
  summary: string;
  criteria: string;
  rawResponse: string | null;
  scoredAt: string;
}

export type CandidateFieldType = "number" | "currency" | "text" | "date";

export interface PipelineStage {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  order: number;
  isTerminal: boolean;
  createdAt: string;
  candidateCount?: number;
}

export interface CandidateFieldDefinition {
  id: string;
  ownerId: string;
  label: string;
  type: CandidateFieldType;
  order: number;
  createdAt: string;
}

export interface CandidateFieldValue {
  id: string;
  candidateId: string;
  fieldDefinitionId: string;
  valueNumber: number | null;
  valueText: string | null;
  valueDate: string | null;
}

export interface Candidate {
  id: string;
  name: string;
  email: string | null;
  fileName: string;
  filePath: string;
  status: string;
  overallScore: number | null;
  posisi: string | null;
  kriteria: string | null;
  prompt: string | null;
  n8nRunId: string | null;
  batchId: string | null;
  jobPositionId: string | null;
  pipelineStageId: string | null;
  pipelineStage: PipelineStage | null;
  fieldValues: CandidateFieldValue[];
  notes: string | null;
  submittedBy: string;
  submittedById: string;
  createdAt: string;
  updatedAt: string;
  screeningResult: ScreeningResult | null;
}

export interface CriteriaItem {
  name: string;
  score: number;
  notes: string;
}

export type JobPositionStatus = "open" | "closed" | "archived";

export interface JobPosition {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  kriteria: string;
  prompt: string;
  status: JobPositionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JobPositionListItem extends JobPosition {
  candidateCount: number;
  avgScore: number | null;
}

export interface JobPositionDetail extends JobPosition {
  candidates: Array<Candidate & { batch: { id: string; createdAt: string } | null }>;
}
