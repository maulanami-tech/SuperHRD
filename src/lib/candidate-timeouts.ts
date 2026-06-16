import { prisma } from "@/lib/prisma";
import { PROCESSING_TIMEOUT_MS, type ProcessingCandidateRecord } from "@/lib/candidate-status";

type TimeoutCandidate = ProcessingCandidateRecord & {
  id: string;
  submittedById: string;
  creditSource: string | null;
};

function getTimeoutCutoff(now = Date.now()) {
  return new Date(now - PROCESSING_TIMEOUT_MS);
}

function isRefundableSource(source: string | null): source is "quota" | "paid" {
  return source === "quota" || source === "paid";
}

async function markTimedOutAndRefund(candidate: TimeoutCandidate) {
  if (!isRefundableSource(candidate.creditSource)) {
    const updateResult = await prisma.candidate.updateMany({
      where: { id: candidate.id, status: "processing" },
      data: { status: "failed" },
    });
    return updateResult.count > 0;
  }

  const reason = "processing_timeout";

  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.candidate.updateMany({
      where: { id: candidate.id, status: "processing" },
      data: { status: "failed" },
    });

    if (updateResult.count === 0) return false;

    const existingRefund = await tx.transaction.findFirst({
      where: {
        userId: candidate.submittedById,
        type: "refund",
        metadata: { contains: `"candidateId":"${candidate.id}"` },
      },
    });
    if (existingRefund) return true;

    if (candidate.creditSource === "paid") {
      const refundedUser = await tx.user.update({
        where: { id: candidate.submittedById },
        data: { creditBalance: { increment: 1 } },
      });

      await tx.transaction.create({
        data: {
          userId: candidate.submittedById,
          type: "refund",
          creditDelta: 1,
          balanceAfter: refundedUser.creditBalance,
          amountIdr: null,
          description: "Refund: screening timed out",
          metadata: JSON.stringify({ candidateId: candidate.id, reason }),
        },
      });
      return true;
    }

    const restoreResult = await tx.user.updateMany({
      where: {
        id: candidate.submittedById,
        dailyQuotaUsed: { gt: 0 },
      },
      data: { dailyQuotaUsed: { decrement: 1 } },
    });

    const restoredUser = await tx.user.findUnique({
      where: { id: candidate.submittedById },
      select: { creditBalance: true },
    });

    if (restoreResult.count > 0 && restoredUser) {
      await tx.transaction.create({
        data: {
          userId: candidate.submittedById,
          type: "refund",
          creditDelta: 0,
          balanceAfter: restoredUser.creditBalance,
          amountIdr: null,
          description: "Quota restored: screening timed out",
          metadata: JSON.stringify({ candidateId: candidate.id, reason }),
        },
      });
    }

    return true;
  });
}

export async function expireTimedOutCandidatesForUser(userId: string, now = Date.now()) {
  const candidates = await prisma.candidate.findMany({
    where: {
      submittedById: userId,
      status: "processing",
      updatedAt: { lt: getTimeoutCutoff(now) },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      submittedById: true,
      creditSource: true,
    },
  });

  await Promise.all(candidates.map((candidate) => markTimedOutAndRefund(candidate)));
}

export async function expireTimedOutCandidateById(
  candidateId: string,
  userId: string,
  now = Date.now()
) {
  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      submittedById: userId,
      status: "processing",
      updatedAt: { lt: getTimeoutCutoff(now) },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      submittedById: true,
      creditSource: true,
    },
  });

  if (!candidate) return false;
  return markTimedOutAndRefund(candidate);
}

export async function expireTimedOutCandidateByRunId(runId: string, now = Date.now()) {
  const candidate = await prisma.candidate.findFirst({
    where: {
      n8nRunId: runId,
      status: "processing",
      updatedAt: { lt: getTimeoutCutoff(now) },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      submittedById: true,
      creditSource: true,
    },
  });

  if (!candidate) return false;
  return markTimedOutAndRefund(candidate);
}
