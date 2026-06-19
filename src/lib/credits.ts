import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TopupStatus } from '@/generated/prisma/client';

export const WIB_TIMEZONE = 'Asia/Jakarta';
export const DAILY_QUOTA_LIMIT = 5;

/**
 * Get current date in WIB timezone as yyyy-MM-dd string
 */
export function getCurrentDateWIB(): string {
  const now = new Date();
  const wibDate = toZonedTime(now, WIB_TIMEZONE);
  return format(wibDate, 'yyyy-MM-dd');
}

/**
 * Check if user can screen a candidate (has quota or credits available)
 */
export async function canUserScreen(userId: string): Promise<{
  canScreen: boolean;
  source?: 'quota' | 'paid';
  reason?: string;
  quotaRemaining?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyQuotaUsed: true,
      lastQuotaDate: true,
      creditBalance: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const today = getCurrentDateWIB();

  // Check if quota needs reset
  if (user.lastQuotaDate !== today) {
    return { canScreen: true, source: 'quota', quotaRemaining: DAILY_QUOTA_LIMIT };
  }

  // Check if has remaining quota or paid credits
  const remainingQuota = DAILY_QUOTA_LIMIT - user.dailyQuotaUsed;

  if (remainingQuota > 0) {
    return { canScreen: true, source: 'quota', quotaRemaining: remainingQuota };
  }

  if (user.creditBalance > 0) {
    return { canScreen: true, source: 'paid' };
  }

  return { canScreen: false, reason: 'Insufficient quota and credits' };
}

export async function getAvailableScreeningCredits(userId: string): Promise<{
  available: number;
  paidCredits: number;
  quotaRemaining: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      dailyQuotaUsed: true,
      lastQuotaDate: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const today = getCurrentDateWIB();
  const quotaUsed = user.lastQuotaDate === today ? user.dailyQuotaUsed : 0;
  const quotaRemaining = Math.max(0, DAILY_QUOTA_LIMIT - quotaUsed);

  return {
    available: quotaRemaining + user.creditBalance,
    paidCredits: user.creditBalance,
    quotaRemaining,
  };
}

/**
 * Deduct credit from user atomically using a database transaction.
 * All operations are wrapped in $transaction to prevent race conditions.
 */
export async function deductCredit(
  userId: string,
  candidateId: string
): Promise<{
  success: boolean;
  source: 'quota' | 'paid';
  newBalance: number;
  quotaRemaining?: number;
}> {
  const today = getCurrentDateWIB();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        dailyQuotaUsed: true,
        lastQuotaDate: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    let dailyQuotaUsed = user.dailyQuotaUsed;

    // Reset quota if date changed
    if (user.lastQuotaDate !== today) {
      dailyQuotaUsed = 0;
      await tx.user.update({
        where: { id: userId },
        data: {
          dailyQuotaUsed: 0,
          lastQuotaDate: today,
        },
      });
    }

    // Try to use daily quota
    if (dailyQuotaUsed < DAILY_QUOTA_LIMIT) {
      await tx.user.update({
        where: { id: userId },
        data: { dailyQuotaUsed: { increment: 1 } },
      });

      const updatedUser = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true, dailyQuotaUsed: true },
      });

      if (!updatedUser) {
        throw new Error(`User not found after quota deduction: ${userId}`);
      }

      await tx.transaction.create({
        data: {
          userId,
          type: 'daily_quota',
          creditDelta: -1,
          balanceAfter: updatedUser.creditBalance,
          description: `Screening candidate ${candidateId} using daily quota`,
          metadata: JSON.stringify({ candidateId }),
        },
      });

      return {
        success: true,
        source: 'quota',
        newBalance: updatedUser.creditBalance,
        quotaRemaining: DAILY_QUOTA_LIMIT - updatedUser.dailyQuotaUsed,
      };
    }

    // Try to deduct paid credits
    if (user.creditBalance > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: 1 } },
      });

      const updatedUser = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      if (!updatedUser) {
        throw new Error(`User not found after credit deduction: ${userId}`);
      }

      await tx.transaction.create({
        data: {
          userId,
          type: 'deduct_screening',
          creditDelta: -1,
          balanceAfter: updatedUser.creditBalance,
          description: `Screening candidate ${candidateId} using paid credits`,
          metadata: JSON.stringify({ candidateId }),
        },
      });

      return {
        success: true,
        source: 'paid',
        newBalance: updatedUser.creditBalance,
      };
    }

    // No quota or credits available
    return {
      success: false,
      source: 'quota',
      newBalance: user.creditBalance,
      quotaRemaining: 0,
    };
  });
}

export async function deductPromptGenerationCredit(
  userId: string,
  params: { mode: "single" | "batch"; posisi: string; provider?: string; model?: string }
): Promise<{ success: boolean; newBalance: number; reason?: string }> {
  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.user.updateMany({
      where: {
        id: userId,
        creditBalance: { gt: 0 },
      },
      data: { creditBalance: { decrement: 1 } },
    });

    if (updateResult.count === 0) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });
      return {
        success: false,
        newBalance: user?.creditBalance ?? 0,
        reason: "Insufficient paid credits",
      };
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user) {
      throw new Error(`User not found after prompt generation deduction: ${userId}`);
    }

    await tx.transaction.create({
      data: {
        userId,
        type: "generate_prompt",
        creditDelta: -1,
        balanceAfter: user.creditBalance,
        description: "AI generated screening criteria and prompt",
        metadata: JSON.stringify({
          mode: params.mode,
          posisi: params.posisi,
          provider: params.provider,
          model: params.model,
        }),
      },
    });

    return { success: true, newBalance: user.creditBalance };
  });
}

export async function refundPromptGenerationCredit(
  userId: string,
  params: { mode: "single" | "batch"; posisi: string; reason: string }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: 1 } },
      select: { creditBalance: true },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: "refund",
        creditDelta: 1,
        balanceAfter: user.creditBalance,
        amountIdr: null,
        description: "Refund: AI prompt generation failed",
        metadata: JSON.stringify({
          mode: params.mode,
          posisi: params.posisi,
          reason: params.reason,
        }),
      },
    });
  });
}

export async function refundScreeningCredit(
  userId: string,
  candidateId: string,
  source: 'quota' | 'paid',
  description = 'Refund: screening service unavailable',
  reason = 'n8n_failed'
): Promise<void> {
  if (source === 'paid') {
    await prisma.$transaction(async (tx) => {
      const existingRefund = await tx.transaction.findFirst({
        where: {
          userId,
          type: 'refund',
          metadata: { contains: `"candidateId":"${candidateId}"` },
        },
      });
      if (existingRefund) return;

      const refundedUser = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: 1 } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'refund',
          creditDelta: 1,
          balanceAfter: refundedUser.creditBalance,
          amountIdr: null,
          description,
          metadata: JSON.stringify({ candidateId, reason }),
        },
      });
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existingRefund = await tx.transaction.findFirst({
      where: {
        userId,
        type: 'refund',
        metadata: { contains: `"candidateId":"${candidateId}"` },
      },
    });
    if (existingRefund) return;

    const restoreResult = await tx.user.updateMany({
      where: {
        id: userId,
        dailyQuotaUsed: { gt: 0 },
      },
      data: { dailyQuotaUsed: { decrement: 1 } },
    });

    const restoredUser = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (restoreResult.count > 0 && restoredUser) {
      await tx.transaction.create({
        data: {
          userId,
          type: 'refund',
          creditDelta: 0,
          balanceAfter: restoredUser.creditBalance,
          amountIdr: null,
          description:
            reason === 'processing_timeout'
              ? 'Quota restored: screening timed out'
              : 'Quota restored: screening service unavailable',
          metadata: JSON.stringify({ candidateId, reason }),
        },
      });
    }
  });
}

/**
 * Get user's current balance and quota information
 */
export async function getUserBalance(userId: string): Promise<{
  creditBalance: number;
  dailyQuotaUsed: number;
  dailyQuotaRemaining: number;
  totalPurchased: number;
}> {
  const [user, purchaseAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        dailyQuotaUsed: true,
        lastQuotaDate: true,
      },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ["topup_qris", "topup_stripe"] },
      },
      _sum: { creditDelta: true },
    }),
  ]);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const today = getCurrentDateWIB();
  const dailyQuotaUsed = user.lastQuotaDate === today ? user.dailyQuotaUsed : 0;
  const dailyQuotaRemaining = DAILY_QUOTA_LIMIT - dailyQuotaUsed;
  const totalPurchased = purchaseAgg._sum.creditDelta ?? 0;

  return {
    creditBalance: user.creditBalance,
    dailyQuotaUsed,
    dailyQuotaRemaining,
    totalPurchased,
  };
}

/**
 * QRIS Topup bundles mapping
 */
export const BUNDLES = [
  { amountIdr: 10000, credits: 20 },
  { amountIdr: 50000, credits: 110 },
  { amountIdr: 150000, credits: 350 },
  { amountIdr: 500000, credits: 1250 },
];

/**
 * Approve a pending QRIS topup request (admin operation)
 * Idempotent: returns success if already approved, fails if rejected/cancelled
 */
export async function approveTopup(
  topupId: string,
  adminUserId: string
): Promise<{
  success: boolean;
  newBalance: number;
  creditAmount: number;
}> {
  // Atomic approval: check status and update topup + user balance + record transaction
  // All reads and writes happen inside the transaction to prevent TOCTOU races
  const result = await prisma.$transaction(async (tx) => {
    // Fetch topup request with user relation inside transaction
    const topup = await tx.topupRequest.findUnique({
      where: { id: topupId },
      include: {
        user: {
          select: {
            id: true,
            creditBalance: true,
          },
        },
      },
    });

    if (!topup) {
      throw new Error('Topup request not found');
    }

    // Idempotent: if already approved, return success with current balance
    if (topup.status === 'approved') {
      const bundle = BUNDLES.find((b) => b.amountIdr === topup.amountIdr);
      if (!bundle) {
        throw new Error(
          `Invalid amount: ${topup.amountIdr}. No matching bundle found.`
        );
      }
      return {
        newBalance: topup.user.creditBalance,
        creditAmount: bundle.credits,
      };
    }

    // Find matching bundle
    const bundle = BUNDLES.find((b) => b.amountIdr === topup.amountIdr);
    if (!bundle) {
      throw new Error(
        `Invalid amount: ${topup.amountIdr}. No matching bundle found.`
      );
    }

    // A late Midtrans settlement can arrive after a request was already marked
    // expired/rejected (e.g. delayed webhook). Since the user has actually paid,
    // we reopen from those states. 'approved' is excluded above (idempotent guard),
    // so the status set below still prevents double-crediting.
    const reopenableStatuses: TopupStatus[] = ['pending', 'expired', 'rejected'];

    if (!reopenableStatuses.includes(topup.status)) {
      throw new Error(`Cannot approve ${topup.status} topup request`);
    }

    const isReopen = topup.status !== 'pending';

    // Conditional update: only update if status is still a reopenable state.
    // This keeps the approval atomic and race-free — 'approved' is never in the
    // set, so concurrent approvers cannot double-credit.
    const updateResult = await tx.topupRequest.updateMany({
      where: {
        id: topupId,
        status: { in: reopenableStatuses },
      },
      data: {
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminUserId,
        ...(isReopen
          ? {
              notes: `Reopened from ${topup.status} after verified payment settlement`,
            }
          : {}),
      },
    });

    // If no rows updated, the status changed under us — report it.
    if (updateResult.count === 0) {
      const existing = await tx.topupRequest.findUnique({
        where: { id: topupId },
        select: { status: true },
      });
      if (existing) {
        throw new Error(`Topup request is ${existing.status}, cannot approve`);
      }
      throw new Error('Topup request not found');
    }

    // Increment user credit balance
    const user = await tx.user.update({
      where: { id: topup.userId },
      data: {
        creditBalance: { increment: bundle.credits },
      },
      select: { creditBalance: true },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId: topup.userId,
        type: 'topup_qris',
        creditDelta: bundle.credits,
        balanceAfter: user.creditBalance,
        amountIdr: topup.amountIdr,
        description: `QRIS topup approved: Rp ${topup.amountIdr.toLocaleString('id-ID')} → ${bundle.credits} credits`,
        metadata: JSON.stringify({
          topupId,
          amountIdr: topup.amountIdr,
          approvedBy: adminUserId,
          paymentProvider: topup.paymentProvider,
          providerOrderId: topup.providerOrderId,
          ...(isReopen ? { reopenedFrom: topup.status } : {}),
        }),
      },
    });

    return {
      newBalance: user.creditBalance,
      creditAmount: bundle.credits,
    };
  });

  return {
    success: true,
    newBalance: result.newBalance,
    creditAmount: result.creditAmount,
  };
}

/**
 * Reject a pending QRIS topup request (admin operation)
 */
export async function rejectTopup(
  topupId: string,
  adminUserId: string,
  reason: string
): Promise<{
  success: boolean;
}> {
  // Atomic rejection: check status and update inside transaction to prevent TOCTOU
  const result = await prisma.$transaction(async (tx) => {
    // Check topup request exists and get current status inside transaction
    const topup = await tx.topupRequest.findUnique({
      where: { id: topupId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!topup) {
      throw new Error('Topup request not found');
    }

    // Cannot reject if already approved
    if (topup.status === 'approved') {
      throw new Error('Cannot reject approved topup request');
    }

    // Idempotent: if already rejected, return success
    if (topup.status === 'rejected') {
      return { success: true };
    }

    // Update status to rejected with reason
    const updateResult = await tx.topupRequest.updateMany({
      where: {
        id: topupId,
        status: 'pending',
      },
      data: {
        status: 'rejected',
        processedAt: new Date(),
        processedBy: adminUserId,
        notes: reason,
      },
    });

    // If no rows updated, check existing status and throw specific error
    if (updateResult.count === 0) {
      const existing = await tx.topupRequest.findUnique({
        where: { id: topupId },
        select: { status: true },
      });
      if (existing) {
        throw new Error(`Topup request is ${existing.status}, not pending`);
      }
      throw new Error('Topup request not found');
    }

    return { success: true };
  });

  return result;
}
