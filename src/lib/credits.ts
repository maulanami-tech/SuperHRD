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
