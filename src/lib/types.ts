export interface ScreeningResult {
  id: string;
  candidateId: string;
  overallScore: number;
  summary: string;
  criteria: string;
  rawResponse: string | null;
  scoredAt: string;
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
