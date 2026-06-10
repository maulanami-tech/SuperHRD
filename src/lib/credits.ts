import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const WIB_TIMEZONE = 'Asia/Jakarta';

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
export async function canUserScreen(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyQuotaUsed: true,
      lastQuotaDate: true,
      creditBalance: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const today = getCurrentDateWIB();

  // Check if quota needs reset
  if (user.lastQuotaDate !== today) {
    return true; // Will reset on first use
  }

  // Check if has remaining quota or paid credits
  const remainingQuota = 3 - user.dailyQuotaUsed;
  return remainingQuota > 0 || user.creditBalance > 0;
}

/**
 * Deduct credit from user atomically
 * Returns true if deduction succeeded, false if insufficient credits
 */
export async function deductCredit(
  userId: string,
  candidateId: string
): Promise<boolean> {
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
        dailyQuotaUsed: { lt: 3 },
      },
      data: {
        dailyQuotaUsed: { increment: 1 },
      },
    });

    if (deductResult.count > 0) {
      await recordTransaction(userId, candidateId, 'QUOTA');
      return true;
    }
  }

  // Try to use existing quota
  const quotaResult = await prisma.user.updateMany({
    where: {
      id: userId,
      dailyQuotaUsed: { lt: 3 },
      lastQuotaDate: today,
    },
    data: {
      dailyQuotaUsed: { increment: 1 },
    },
  });

  if (quotaResult.count > 0) {
    await recordTransaction(userId, candidateId, 'QUOTA');
    return true;
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
    await recordTransaction(userId, candidateId, 'PAID');
    return true;
  }

  return false;
}

/**
 * Record credit transaction for audit trail
 */
async function recordTransaction(
  userId: string,
  candidateId: string,
  type: 'QUOTA' | 'PAID'
): Promise<void> {
  // Get user's current balance for balanceAfter field
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  await prisma.transaction.create({
    data: {
      userId,
      type: type === 'QUOTA' ? 'daily_quota' : 'deduct_screening',
      creditDelta: -1,
      balanceAfter: user.creditBalance,
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
  lastQuotaDate: string;
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
    throw new Error('User not found');
  }

  const today = getCurrentDateWIB();
  const dailyQuotaUsed = user.lastQuotaDate === today ? user.dailyQuotaUsed : 0;
  const dailyQuotaRemaining = 3 - dailyQuotaUsed;

  return {
    creditBalance: user.creditBalance,
    dailyQuotaUsed,
    dailyQuotaRemaining,
    lastQuotaDate: user.lastQuotaDate,
  };
}
