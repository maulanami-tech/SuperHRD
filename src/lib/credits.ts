import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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

    // Cannot approve if rejected
    if (topup.status === 'rejected') {
      throw new Error(`Cannot approve ${topup.status} topup request`);
    }

    // Find matching bundle
    const bundle = BUNDLES.find((b) => b.amountIdr === topup.amountIdr);
    if (!bundle) {
      throw new Error(
        `Invalid amount: ${topup.amountIdr}. No matching bundle found.`
      );
    }

    // Conditional update: only update if status is pending
    const updateResult = await tx.topupRequest.updateMany({
      where: {
        id: topupId,
        status: 'pending',
      },
      data: {
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminUserId,
      },
    });

    // If no rows updated, check existing status and throw error
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
        description: `QRIS topup approved: Rp ${topup.amountIdr.toLocaleString('id-ID')} → ${bundle.credits} credits`,
        metadata: JSON.stringify({
          topupId,
          amountIdr: topup.amountIdr,
          approvedBy: adminUserId,
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
