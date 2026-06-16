/**
 * PoC 5: RATE LIMIT RACE CONDITION — Non-Atomic Rate Limiter
 * Severity: MEDIUM
 * 
 * Finding: In src/lib/rate-limit.ts, the rate limiting implementation uses:
 *   1. deleteMany() — cleanup old entries
 *   2. create() — try to create new record
 *   3. catch → updateMany() — increment if duplicate
 *   4. findFirst() — read count
 * 
 * Steps 2-4 are not atomic. Two concurrent requests can both pass the
 * rate limit check simultaneously. Also, the deleteMany + create sequence
 * has a race window where old entries are deleted but new ones aren't yet created.
 * 
 * Run: npx tsx .tmp-poc/poc5-rate-limit-race.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function poc() {
  console.log('=== PoC 5: Rate Limit Race Condition ===\n');

  const RATE_LIMIT_KEY = 'test:ratelimit:poc5';
  const MAX_REQUESTS = 3;
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour

  // Cleanup any previous test data
  await prisma.rateLimit.deleteMany({ where: { key: RATE_LIMIT_KEY } });

  console.log(`Rate limit config: key="${RATE_LIMIT_KEY}", max=${MAX_REQUESTS}, window=1h\n`);

  // Simulate the exact rate limit check from rate-limit.ts
  async function checkRateLimit(key: string): Promise<{ allowed: boolean; count: number }> {
    const windowStart = new Date(Date.now() - WINDOW_MS);

    // Step 1: Lazy cleanup
    await prisma.rateLimit.deleteMany({
      where: { key, windowStart: { lt: windowStart } },
    });

    // Step 2: Try to create new record
    try {
      await prisma.rateLimit.create({
        data: { key, count: 1, windowStart: new Date() },
      });
      return { allowed: true, count: 1 };
    } catch {
      // Duplicate key — fall through
    }

    // Step 3: Increment existing
    await prisma.rateLimit.updateMany({
      where: { key, windowStart: { gte: windowStart } },
      data: { count: { increment: 1 } },
    });

    // Step 4: Read count
    const record = await prisma.rateLimit.findFirst({
      where: { key, windowStart: { gte: windowStart } },
      orderBy: { windowStart: 'desc' },
    });

    if (!record) {
      return { allowed: false, count: 0 };
    }

    return {
      allowed: record.count <= MAX_REQUESTS,
      count: record.count,
    };
  }

  // Launch concurrent requests
  const CONCURRENT = 10;
  console.log(`Launching ${CONCURRENT} concurrent rate limit checks (limit: ${MAX_REQUESTS})...\n`);

  const promises = Array.from({ length: CONCURRENT }, (_, i) =>
    checkRateLimit(RATE_LIMIT_KEY)
      .then(r => ({ ...r, index: i }))
      .catch(e => ({ allowed: false, count: -1, index: i, error: e.message }))
  );

  const results = await Promise.all(promises);

  console.log('--- Results ---');
  let allowedCount = 0;
  for (const r of results) {
    const status = r.allowed ? '✅ ALLOWED' : '🚫 BLOCKED';
    console.log(`  Request ${r.index}: ${status} | count=${r.count}`);
    if (r.allowed) allowedCount++;
  }

  // Check final DB state
  const finalRecord = await prisma.rateLimit.findFirst({
    where: { key: RATE_LIMIT_KEY },
    orderBy: { windowStart: 'desc' },
  });

  console.log(`\n--- Summary ---`);
  console.log(`Requests launched: ${CONCURRENT}`);
  console.log(`Allowed (passed check): ${allowedCount}`);
  console.log(`Rate limit max: ${MAX_REQUESTS}`);
  console.log(`DB count after all requests: ${finalRecord?.count ?? 'N/A'}`);

  if (allowedCount > MAX_REQUESTS) {
    console.log(`\n🔴 VULNERABILITY CONFIRMED: ${allowedCount} requests allowed`);
    console.log(`   Expected: at most ${MAX_REQUESTS}`);
    console.log(`   Bypass: ${allowedCount - MAX_REQUESTS} extra requests`);
    console.log(`\n   Root cause: Non-atomic check-then-increment in rate-limit.ts`);
    console.log(`   The updateMany (step 3) and findFirst (step 4) are separate queries.`);
    console.log(`   Two concurrent requests can both read count=2, pass check, then increment.`);
  } else {
    console.log(`\n🟡 Rate limit held — SQLite serialization prevented bypass.`);
    console.log(`   But the implementation is fragile and depends on DB-level locking.`);
  }

  // Analysis of the race window
  console.log(`\n--- Race Condition Analysis ---`);
  console.log(`Window 1 (deleteMany + create):`);
  console.log(`  Request A: deleteMany() completes`);
  console.log(`  Request B: deleteMany() completes`);
  console.log(`  Request A: create(count=1) succeeds`);
  console.log(`  Request B: create(count=1) FAILS (duplicate key)`);
  console.log(`  Both proceed to step 3...\n`);
  console.log(`Window 2 (updateMany + findFirst):`);
  console.log(`  Request A: updateMany(increment) — count becomes 2`);
  console.log(`  Request B: updateMany(increment) — count becomes 3`);
  console.log(`  Request A: findFirst() → count=3 → BLOCKED (3 > 3? No, 3 == 3, allowed!)`);
  console.log(`  Request B: findFirst() → count=3 → BLOCKED (3 > 3? No, 3 == 3, allowed!)`);
  console.log(`  Both pass! (The check is <= not <)\n`);

  // Cleanup
  await prisma.rateLimit.deleteMany({ where: { key: RATE_LIMIT_KEY } });
  console.log('Cleaned up test data.');

  await prisma.$disconnect();
}

poc().catch(console.error);
