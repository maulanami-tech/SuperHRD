export const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

export interface ProcessingCandidateRecord {
  status: string;
  updatedAt: Date;
}

export function isProcessingTimedOut(
  candidate: ProcessingCandidateRecord,
  now = Date.now()
) {
  return (
    candidate.status === "processing" &&
    now - candidate.updatedAt.getTime() >= PROCESSING_TIMEOUT_MS
  );
}

/**
 * Returns the effective status of a candidate, treating timed-out
 * processing candidates as "failed".
 */
export function getEffectiveStatus(
  candidate: ProcessingCandidateRecord
): string {
  if (isProcessingTimedOut(candidate)) return "failed";
  return candidate.status;
}

/**
 * Builds a Prisma `where` filter that accounts for the virtual timeout.
 * When filtering by "failed", this includes both real "failed" records
 * and "processing" records that have exceeded the timeout.
 * When filtering by "processing", this excludes timed-out records.
 */
export function buildStatusFilter(status: string, now = Date.now()) {
  const cutoff = new Date(now - PROCESSING_TIMEOUT_MS);

  if (status === "failed") {
    return {
      OR: [
        { status: "failed" },
        { status: "processing", updatedAt: { lt: cutoff } },
      ],
    };
  }

  if (status === "processing") {
    return {
      status: "processing",
      updatedAt: { gte: cutoff },
    };
  }

  return { status };
}
