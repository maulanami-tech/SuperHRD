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

  // Try to create a new record for this window.
  // The @unique constraint on `key` ensures only one record per window;
  // a duplicate insert will throw, which we catch below.
  try {
    await prisma.rateLimit.create({
      data: { key, count: 1, windowStart: new Date() },
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetMs: config.windowMs };
  } catch {
    // Duplicate key — record exists, fall through to increment
  }

  // Find existing record and atomically increment
  await prisma.rateLimit.updateMany({
    where: {
      key,
      windowStart: { gte: windowStart },
    },
    data: { count: { increment: 1 } },
  });

  // Read the updated count
  const record = await prisma.rateLimit.findFirst({
    where: { key, windowStart: { gte: windowStart } },
    orderBy: { windowStart: 'desc' },
  });

  if (!record || record.count > config.maxRequests) {
    const resetMs = record
      ? record.windowStart.getTime() + config.windowMs - Date.now()
      : config.windowMs;
    return { allowed: false, remaining: 0, resetMs: Math.max(0, resetMs) };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - record.count),
    resetMs: record.windowStart.getTime() + config.windowMs - Date.now(),
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
