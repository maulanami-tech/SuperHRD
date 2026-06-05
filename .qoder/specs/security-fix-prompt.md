# SuperHRD — Security Fix Prompt (Pre-Release)

> Based on Security Scan Report: CONDITIONAL GO — 5 MEDIUM, 3 LOW, 2 INFO
> Goal: Fix all actionable findings to reach unconditional GO

---

## 🔧 BE Waker — Security Fix Prompt

```
You are the Backend Engineer for SuperHRD. The security scanner found 8 actionable findings (5 MEDIUM, 3 LOW). Fix ALL of them:

## MEDIUM FIXES

### SEV-001: IDOR — Add Ownership Check on Candidate Endpoints

**Location:** `src/app/api/candidates/[id]/route.ts`
**Also:** `src/app/api/candidates/route.ts`

**Fix for [id]/route.ts:**
Add `submittedById` filter to the candidate query:
```typescript
const candidate = await prisma.candidate.findUnique({
  where: {
    id,
    submittedById: session.user.id,  // ← Add ownership filter
  },
  include: { screeningResult: true },
});
```

**Fix for candidates/route.ts:**
Filter the candidate list by the authenticated user:
```typescript
const candidates = await prisma.candidate.findMany({
  where: { submittedById: session.user.id },  // ← Add ownership filter
  include: { screeningResult: true },
  orderBy: { createdAt: "desc" },
});
```

**Important:** Both routes already call `auth()` and have `session.user.id` available. Just add the `where` filter.

---

### SEV-002: Add Security Headers

**Location:** `next.config.ts`

Replace the empty config with:
```typescript
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

---

### SEV-003: Add Rate Limiting on Login

**Location:** `src/lib/auth.ts`

Add an in-memory rate limiter inside the `authorize` callback. Use a simple Map-based approach:

```typescript
// Add at top of file (outside NextAuth config):
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

function isRateLimited(key: string): boolean {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (Date.now() < record.lockedUntil) return true;
  if (Date.now() >= record.lockedUntil) {
    loginAttempts.delete(key);
    return false;
  }
  return false;
}

function recordFailedAttempt(key: string): void {
  const record = loginAttempts.get(key);
  if (!record) {
    loginAttempts.set(key, { count: 1, lockedUntil: 0 });
    return;
  }
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION;
  }
}

// Inside authorize():
async authorize(credentials) {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;
  if (!email || !password) return null;

  // Rate limit check
  if (isRateLimited(email)) {
    console.warn(`[AUTH] Rate limited: email=${email}`);
    return null;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordFailedAttempt(email);
    console.warn(`[AUTH] Login failed: unknown email=${email}`);
    return null;
  }
  const isValid = await compare(password, user.passwordHash);
  if (!isValid) {
    recordFailedAttempt(email);
    console.warn(`[AUTH] Login failed: bad password for email=${email}`);
    return null;
  }
  // Clear rate limit on success
  loginAttempts.delete(email);
  console.info(`[AUTH] Login success: email=${email} userId=${user.id}`);
  return { id: user.id, name: user.name, email: user.email };
}
```

**Note:** This also fixes SEV-008 (auth logging) at the same time.

---

### SEV-004: TOCTOU Race — Use Transaction in n8n Callback

**Location:** `src/app/api/n8n/callback/route.ts`

Wrap the screening result creation + candidate update in a Prisma transaction:

```typescript
// Replace the try block (lines 39-60) with:
try {
  const result = await prisma.$transaction(async (tx) => {
    const lockedCandidate = await tx.candidate.findUnique({
      where: { n8nRunId: runId },
      include: { screeningResult: true },
    });

    if (!lockedCandidate) {
      return { error: "Candidate not found", status: 404 };
    }

    if (lockedCandidate.status === "completed" && lockedCandidate.screeningResult) {
      return { success: true, alreadyProcessed: true };
    }

    if (!lockedCandidate.screeningResult) {
      await tx.screeningResult.create({
        data: {
          candidateId: lockedCandidate.id,
          overallScore,
          summary,
          criteria: JSON.stringify(criteria),
          rawResponse: rawResponse ?? null,
        },
      });
    }

    await tx.candidate.update({
      where: { id: lockedCandidate.id },
      data: { status: "completed", overallScore },
    });

    return { success: true };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
} catch (error) {
  console.error("Callback processing error:", error);
  return NextResponse.json(
    { error: "Failed to process callback" },
    { status: 500 }
  );
}
```

**Note:** Remove the old catch block race condition handler (lines 64-76) since the transaction handles it.

---

## LOW FIXES

### SEV-006: Generate Random Seed Password

**Location:** `prisma/seed.ts`

Replace the hardcoded password with a random one:
```typescript
import { hashSync } from "bcryptjs";
import { randomBytes } from "crypto";
import "dotenv/config";
// ... rest of imports

async function main() {
  // ... prisma setup

  const defaultPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(16).toString("hex");
  const passwordHash = hashSync(defaultPassword, 10);

  await prisma.user.upsert({
    where: { email: "hrd@superhrd.com" },
    update: {},
    create: {
      name: "HRD Admin",
      email: "hrd@superhrd.com",
      passwordHash,
    },
  });

  console.log("Seed completed: HRD Admin user created");
  console.log(`Email: hrd@superhrd.com`);
  console.log(`Password: ${defaultPassword}`);
  console.log("⚠️  Save this password! It will not be shown again.");
}
```

---

### SEV-007: Bound Score Values in Zod Schema

**Location:** `src/lib/validations.ts`

Add min/max bounds to the n8n callback schema:
```typescript
export const n8nCallbackSchema = z.object({
  runId: z.string().min(1),
  overallScore: z.number().min(0).max(100),
  summary: z.string().max(5000),
  criteria: z.array(
    z.object({
      name: z.string().max(200),
      score: z.number().min(0).max(100),
      notes: z.string().max(2000),
    })
  ).max(20),
  rawResponse: z.string().max(50000).optional(),
});
```

---

### SEV-008: Add Auth Event Logging

Already included in the SEV-003 fix above (rate limiting + logging combined).

---

## NOT FIXABLE (Accept Risk)

### SEV-005: npm audit — 6 Moderate Vulnerabilities
- All are build-time/dev-only dependencies (postcss, @hono/node-server)
- No non-breaking fixes available
- **Action:** Document acceptance, monitor advisories

---

## Verification

After all fixes:
- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `curl -sI http://localhost:3000 | grep -iE "(x-frame|x-content-type|strict-transport|referrer-policy)"` returns all headers
- [ ] Login rate limiting works: 5 failed attempts → locked for 15 min
- [ ] Auth events appear in console logs
- [ ] n8n callback still works with transaction
- [ ] Candidate detail returns 404 for other user's candidates
- [ ] Score validation rejects values < 0 or > 100
- [ ] Seed script generates and prints random password
- [ ] All 35 E2E tests still pass: `npx playwright test`

Commit: `fix(security): address all scan findings — IDOR, headers, rate limiting, TOCTOU, logging`
```
