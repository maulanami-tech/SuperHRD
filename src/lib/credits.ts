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
 * Deduct credit from user atomically
 * Returns object with success status, source, and balance info
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

  // First, try to reset quota if needed
  const resetResult = await prisma.user.updateMany({
    where: {
      id: userId,
      lastQuotaDate: { not: today },
    },
    data: {
      dailyQuotaUsed: 0, // Reset quota usage
      lastQuotaDate: today,
    },
  });

  // If we reset the quota, use it
  if (resetResult.count > 0) {
    const deductResult = await prisma.user.updateMany({
      where: {
        id: userId,
        dailyQuotaUsed: { lt: DAILY_QUOTA_LIMIT },
      },
      data: {
        dailyQuotaUsed: { increment: 1 },
      },
    });

    if (deductResult.count > 0) {
      // After reset, dailyQuotaUsed is now 1, creditBalance unchanged
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      if (!user) {
        throw new Error(`User not found after quota reset: ${userId}`);
      }

      await recordTransaction(userId, candidateId, 'QUOTA', user.creditBalance);

      return {
        success: true,
        source: 'quota',
        newBalance: user.creditBalance,
        quotaRemaining: DAILY_QUOTA_LIMIT - 1,
      };
    }
  }

  // Try to use existing quota
  const quotaResult = await prisma.user.updateMany({
    where: {
      id: userId,
      dailyQuotaUsed: { lt: DAILY_QUOTA_LIMIT },
      lastQuotaDate: today,
    },
    data: {
      dailyQuotaUsed: { increment: 1 },
    },
  });

  if (quotaResult.count > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true, dailyQuotaUsed: true },
    });

    if (!user) {
      throw new Error(`User not found after quota deduction: ${userId}`);
    }

    await recordTransaction(userId, candidateId, 'QUOTA', user.creditBalance);

    return {
      success: true,
      source: 'quota',
      newBalance: user.creditBalance,
      quotaRemaining: DAILY_QUOTA_LIMIT - user.dailyQuotaUsed,
    };
  }

  // Try to deduct paid credits
  const creditResult = await prisma.user.updateMany({
    where: {
      id: userId,
      creditBalance: { gt: 0 },
    },
    data: {
      creditBalance: { decrement: 1 },
    },
  });

  if (creditResult.count > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user) {
      throw new Error(`User not found after credit deduction: ${userId}`);
    }

    await recordTransaction(userId, candidateId, 'PAID', user.creditBalance);

    return {
      success: true,
      source: 'paid',
      newBalance: user.creditBalance,
    };
  }

  // Fallback - get current balance and return failure
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true, dailyQuotaUsed: true },
  });

  return {
    success: false,
    source: 'quota',
    newBalance: user?.creditBalance || 0,
    quotaRemaining: 0,
  };
}

/**
 * Record credit transaction for audit trail
 */
async function recordTransaction(
  userId: string,
  candidateId: string,
  type: 'QUOTA' | 'PAID',
  balanceAfter: number
): Promise<void> {
  await prisma.transaction.create({
    data: {
      userId,
      type: type === 'QUOTA' ? 'daily_quota' : 'deduct_screening',
      creditDelta: -1,
      balanceAfter,
      description: `Screening candidate ${candidateId} using ${type === 'QUOTA' ? 'daily quota' : 'paid credits'}`,
      metadata: JSON.stringify({ candidateId }),
    },
  });
}

/**
 * Get user's current balance and quota information
 */
export async function getUserBalance(userId: string): Promise<{
  creditBalance: number;
  dailyQuotaUsed: number;
  dailyQuotaRemaining: number;
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
  const dailyQuotaUsed = user.lastQuotaDate === today ? user.dailyQuotaUsed : 0;
  const dailyQuotaRemaining = DAILY_QUOTA_LIMIT - dailyQuotaUsed;

  return {
    creditBalance: user.creditBalance,
    dailyQuotaUsed,
    dailyQuotaRemaining,
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
  // Fetch topup request with user relation
  const topup = await prisma.topupRequest.findUnique({
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
      throw new Error(`Invalid amount: ${topup.amountIdr}. No matching bundle found.`);
    }
    return {
      success: true,
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
    throw new Error(`Invalid amount: ${topup.amountIdr}. No matching bundle found.`);
  }

  // Atomic approval: update topup status + increment user balance + record transaction
  const result = await prisma.$transaction(async (tx) => {
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
  // Check topup request exists and get current status
  const topup = await prisma.topupRequest.findUnique({
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

  // Update status to rejected with reason using updateMany in transaction
  const result = await prisma.$transaction(async (tx) => {
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

    // If count=0, throw error
    if (updateResult.count === 0) {
      throw new Error('Topup request is not pending');
    }

    return { success: true };
  });

  return result;
}
