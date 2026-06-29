import { prisma } from '@/lib/prisma';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.windowMs);

  const record = await prisma.$transaction(async (tx) => {
    await tx.rateLimit.deleteMany({
      where: {
        key,
        windowStart: { lt: cutoff },
      },
    });

    return tx.rateLimit.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        windowStart: now,
      },
      update: {
        count: { increment: 1 },
      },
    });
  });

  const resetMs = Math.max(0, record.windowStart.getTime() + config.windowMs - Date.now());

  if (record.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetMs };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - record.count),
    resetMs,
  };
}

export function addRateLimitHeaders(
  headers: Headers,
  remaining: number,
  resetMs: number
): void {
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetMs / 1000)));
}
