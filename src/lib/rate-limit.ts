import { prisma } from '@/lib/prisma';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const windowStart = new Date(Date.now() - config.windowMs);

  // Lazy cleanup of old entries
  await prisma.rateLimit.deleteMany({
    where: {
      key,
      windowStart: { lt: windowStart },
    },
  });

  // Find existing record in current window
  const existing = await prisma.rateLimit.findFirst({
    where: {
      key,
      windowStart: { gte: windowStart },
    },
    orderBy: { windowStart: 'desc' },
  });

  if (!existing) {
    await prisma.rateLimit.create({
      data: { key, count: 1, windowStart: new Date() },
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetMs: config.windowMs,
    };
  }

  if (existing.count >= config.maxRequests) {
    const resetMs = existing.windowStart.getTime() + config.windowMs - Date.now();
    return { allowed: false, remaining: 0, resetMs: Math.max(0, resetMs) };
  }

  await prisma.rateLimit.update({
    where: { id: existing.id },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count - 1,
    resetMs: existing.windowStart.getTime() + config.windowMs - Date.now(),
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
