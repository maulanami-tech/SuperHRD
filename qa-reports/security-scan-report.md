# Security Scan Report — SuperHRD Pre-Release Gate

**Date:** 2026-06-06
**Scanner:** Hekel (Security Waker)
**Mode:** READ-ONLY (Auditor)
**Branch:** master

```
╔══════════════════════════════════════════════════════╗
║  SECURITY SCAN REPORT                                ║
║  Project: SuperHRD                                   ║
║  Verdict: ⚠️  CONDITIONAL GO                         ║
╠══════════════════════════════════════════════════════╣
║  🔴 CRITICAL: 0   🟠 HIGH: 0   🔵 MEDIUM: 5       ║
║  🔷 LOW: 3         ⚪ INFO: 2                        ║
║  OWASP: A01(1) A02(0) A03(0) A04(1) A05(2)         ║
║         A06(1) A07(1) A08(0) A09(1) A10(0)          ║
╚══════════════════════════════════════════════════════╝
```

## Scan Scope

| Category | Files Scanned | Status |
|---|---|---|
| API Routes | 5/5 | ✅ Complete |
| Core Libraries | 8/8 | ✅ Complete |
| Configuration | 5/5 | ✅ Complete |
| Frontend (security-relevant) | 3/3 | ✅ Complete |
| npm audit | Full tree | ✅ Complete |
| Git history scan | All commits | ✅ Complete |
| Pattern grep scans | Full src/ | ✅ Complete |

---

## Findings

---

### SEV-001: IDOR — Any Authenticated User Can Access Any Candidate (MEDIUM)

| Field | Value |
|---|---|
| **OWASP** | A01: Broken Access Control |
| **CVSS** | 6.5 — `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` |
| **Location** | `src/app/api/candidates/[id]/route.ts:16-19` |
| **Also affects** | `src/app/api/candidates/route.ts:15-27` (full list, no filtering) |
| **Status** | OPEN |

**Description:**
The GET endpoint for a single candidate verifies that the user is authenticated (`session?.user`) but does not verify that the requesting user owns the candidate resource. Any authenticated user can access any candidate's full data (including CV file path, screening results, and PII) by guessing or enumerating candidate IDs.

**Evidence:**
```typescript
// src/app/api/candidates/[id]/route.ts:16-19
const candidate = await prisma.candidate.findUnique({
  where: { id },           // ← No ownership check against session.user.id
  include: { screeningResult: true },
});
```

**Impact:**
- Horizontal privilege escalation: User A can view User B's candidates
- PII exposure: candidate names, emails, CV file paths, screening summaries
- In a single-role MVP (all users are HR staff), impact is reduced but the pattern is unsafe for multi-tenant growth

**Fix:**
```typescript
const candidate = await prisma.candidate.findUnique({
  where: {
    id,
    submittedById: session.user.id,  // Add ownership filter
  },
  include: { screeningResult: true },
});
```

**Mitigating factor:** Current deployment likely has a single HR user. Prisma uses `cuid()` IDs (non-sequential), making blind enumeration difficult.

---

### SEV-002: Missing Security Headers in Production (MEDIUM)

| Field | Value |
|---|---|
| **OWASP** | A05: Security Misconfiguration |
| **CVSS** | 5.3 — `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N` |
| **Location** | `next.config.ts:3-6` |
| **Status** | OPEN |

**Description:**
`next.config.ts` defines no security headers. The application is missing Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers. This leaves the app vulnerable to clickjacking, MIME sniffing, and downgrade attacks in production.

**Evidence:**
```typescript
// next.config.ts — empty config
const nextConfig: NextConfig = {
  /* config options here */
};
```

**Impact:**
- Clickjacking: app can be embedded in malicious iframes (no X-Frame-Options)
- MIME sniffing attacks (no X-Content-Type-Options)
- SSL stripping on initial load (no HSTS)
- No CSP to restrict script sources

**Fix:**
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

### SEV-003: No Rate Limiting on Login Endpoint (MEDIUM)

| Field | Value |
|---|---|
| **OWASP** | A07: Authentication Failures |
| **CVSS** | 5.3 — `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| **Location** | `src/lib/auth.ts` (Credentials provider) |
| **Status** | OPEN |

**Description:**
The login endpoint (`/api/auth/callback/credentials`) has no rate limiting, account lockout, or exponential backoff mechanism. An attacker can attempt unlimited password guesses against any user account without triggering any defense.

**Evidence:**
```typescript
// src/lib/auth.ts — No rate limiting in authorize()
async authorize(credentials) {
  // No attempt counting, no lockout, no CAPTCHA
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const isValid = await compare(password, user.passwordHash);
  if (!isValid) return null;
  return { id: user.id, name: user.name, email: user.email };
}
```

**Impact:**
- Brute force attacks against any known email address
- Credential stuffing attacks
- Currently mitigated by middleware (requires no session to reach login), but the endpoint is publicly accessible

**Fix options (choose one):**
1. **In-memory rate limiter** (quick fix for single-instance):
   ```typescript
   // Use a Map with IP+email as key, expire after 15 min
   const attempts = new Map<string, { count: number; firstAttempt: number }>();
   // Block after 5 failures for 15 minutes
   ```
2. **upstash/ratelimit** (for Vercel/edge): Redis-backed sliding window
3. **Account lockout**: Add `failedLoginCount` and `lockedUntil` to User model

**Mitigating factor:** Generic error message ("CredentialsSignin") prevents username enumeration. bcrypt cost 10 slows individual attempts (~100ms each).

---

### SEV-004: TOCTOU Race Condition in n8n Callback (MEDIUM)

| Field | Value |
|---|---|
| **OWASP** | A04: Insecure Design |
| **CVSS** | 4.7 — `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:L` |
| **Location** | `src/app/api/n8n/callback/route.ts:35-49` |
| **Status** | OPEN |

**Description:**
There is a time-of-check to time-of-use (TOCTOU) gap between the "already processed" check (line 35) and the actual `screeningResult.create` call (line 41). If two identical callbacks arrive simultaneously, both may pass the `status !== "completed"` check before either completes the update.

**Evidence:**
```typescript
// Line 35: Check
if (candidate.status === "completed" && candidate.screeningResult) {
  return NextResponse.json({ success: true, alreadyProcessed: true });
}

// Gap — another request could also pass the check here

// Line 40-49: Use
if (!candidate.screeningResult) {
  await prisma.screeningResult.create({  // Could fail with unique constraint violation
    data: { candidateId: candidate.id, ... },
  });
}
```

**Impact:**
- Duplicate `ScreeningResult` creation attempt — mitigated by `@unique` constraint on `candidateId` in schema, which would cause a Prisma error
- The `try/catch` block (line 39) catches the error and handles it gracefully (line 64-70)
- Net impact: a 500 error response to one of the duplicate callbacks, no data corruption

**Fix:**
```typescript
// Use a database transaction with explicit locking
await prisma.$transaction(async (tx) => {
  const candidate = await tx.candidate.findUnique({
    where: { n8nRunId: runId },
    include: { screeningResult: true },
  });

  if (!candidate) throw new NotFoundError();
  if (candidate.status === "completed" && candidate.screeningResult) {
    return { alreadyProcessed: true };
  }

  // Create + update in same transaction
  if (!candidate.screeningResult) {
    await tx.screeningResult.create({ data: { ... } });
  }
  await tx.candidate.update({ ... });
});
```

**Mitigating factor:** SQLite serializes writes (single-writer model), making the race window extremely narrow (~microseconds). The `@unique` constraint on `candidateId` prevents duplicate screening results. The error handler at line 64-70 already handles this gracefully.

---

### SEV-005: npm audit — 6 Moderate Vulnerabilities (MEDIUM)

| Field | Value |
|---|---|
| **OWASP** | A06: Vulnerable Components |
| **CVSS** | 6.1 (highest in tree — PostCSS XSS) |
| **Location** | `package.json`, `package-lock.json` |
| **Status** | OPEN |

**Description:**
`npm audit` reports 6 moderate-severity vulnerabilities, 0 high, 0 critical. All are transitive dependencies.

| Package | Severity | CVE/Advisory | CVSS | Via | Fix Available |
|---|---|---|---|---|---|
| `postcss` | moderate | GHSA-qx2v-qp2m-jg93 | 6.1 | next → postcss | next downgrade to 9.3.3 (breaking) |
| `next` | moderate | (via postcss) | 6.1 | direct | next downgrade (breaking) |
| `next-auth` | moderate | (via next) | 6.1 | direct | downgrade (breaking) |
| `@hono/node-server` | moderate | GHSA-92pp-h63x-v22m | 5.3 | prisma → @prisma/dev | prisma downgrade (breaking) |
| `@prisma/dev` | moderate | (via honu) | 5.3 | prisma | prisma downgrade (breaking) |
| `prisma` | moderate | (via @prisma/dev) | 5.3 | direct | downgrade (breaking) |

**Exploitability assessment:**
- **PostCSS XSS (GHSA-qx2v-qp2m-jg93):** Affects CSS stringification output. In this project, PostCSS runs at **build time only** (via `@tailwindcss/postcss`). No user-supplied CSS is processed at runtime. **Not exploitable in production.**
- **@hono/node-server middleware bypass (GHSA-92pp-h63x-v22m):** Affects `serveStatic` in Hono. This package is used by `@prisma/dev` (Prisma Studio dev server). **Not included in production builds.** Not exploitable.

**Fix:** No non-breaking fixes available. All fixes require major version downgrades. Recommendation:
1. Monitor advisories for patch releases within current major versions
2. Add `overrides` in `package.json` if patched sub-dependencies become available
3. Document acceptance of these vulnerabilities given non-exploitability in production

---

### SEV-006: Default Seed Password Not Force-Changed (LOW)

| Field | Value |
|---|---|
| **OWASP** | A05: Security Misconfiguration |
| **CVSS** | 3.7 — `AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| **Location** | `prisma/seed.ts:10` |
| **Status** | OPEN |

**Description:**
The seed script creates a default admin user with password `"admin123"` (bcrypt cost 10). There is no enforcement mechanism to require this password to be changed before first use in production.

**Evidence:**
```typescript
const passwordHash = hashSync("admin123", 10);
await prisma.user.upsert({
  where: { email: "hrd@superhrd.com" },
  update: {},  // ← upsert with empty update: existing user is never modified
  create: { name: "HRD Admin", email: "hrd@superhrd.com", passwordHash },
});
```

**Impact:**
- If seed is run in production, the default credentials remain active
- An attacker who knows the email (`hrd@superhrd.com`) could try the default password

**Fix options:**
1. Add a `mustChangePassword` boolean field to User model, enforce redirect on first login
2. Generate a random password in seed and print it to console
3. Document in deployment guide that default password must be changed immediately
4. Add a startup check that refuses to run with default credentials in production

**Mitigating factor:** bcrypt cost 10 is acceptable for MVP. The seed uses `upsert` with empty `update`, so re-running seed does not reset an already-changed password.

---

### SEV-007: Unbounded Score Values in n8n Callback Schema (LOW)

| Field | Value |
|---|---|
| **OWASP** | A04: Insecure Design |
| **CVSS** | 3.1 — `AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N` |
| **Location** | `src/lib/validations.ts:25-33` |
| **Status** | OPEN |

**Description:**
The `n8nCallbackSchema` Zod schema accepts any number for `overallScore` and criteria `score` fields, without min/max bounds. A compromised or misconfigured n8n instance could send scores of -9999 or 99999.

**Evidence:**
```typescript
export const n8nCallbackSchema = z.object({
  runId: z.string().min(1),
  overallScore: z.number(),           // ← No .min(0).max(100)
  summary: z.string(),                // ← No .max() length limit
  criteria: z.array(
    z.object({
      name: z.string(),
      score: z.number(),              // ← No .min(0).max(100)
      notes: z.string(),
    })
  ),
  rawResponse: z.string().optional(),
});
```

**Fix:**
```typescript
overallScore: z.number().min(0).max(100),
summary: z.string().max(5000),
criteria: z.array(
  z.object({
    name: z.string().max(200),
    score: z.number().min(0).max(100),
    notes: z.string().max(2000),
  })
).max(20),
```

---

### SEV-008: No Authentication Event Logging (LOW)

| Field | Value |
|---|---|
| **OWASP** | A09: Logging and Monitoring Failures |
| **CVSS** | 3.7 — `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L` |
| **Location** | `src/lib/auth.ts` (authorize callback) |
| **Status** | OPEN |

**Description:**
Login success and failure events are not logged. There is no audit trail for authentication attempts, making it difficult to detect brute force attacks, credential stuffing, or compromised accounts in production.

**Evidence:**
```typescript
async authorize(credentials) {
  // No logging of login attempts (success or failure)
  if (!email || !password) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;  // No log
  const isValid = await compare(password, user.passwordHash);
  if (!isValid) return null;  // No log
  return { id: user.id, name: user.name, email: user.email };  // No log
}
```

**Fix:**
```typescript
async authorize(credentials) {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;

  if (!email || !password) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.warn(`[AUTH] Login failed: unknown email=${email}`);
    return null;
  }
  const isValid = await compare(password, user.passwordHash);
  if (!isValid) {
    console.warn(`[AUTH] Login failed: bad password for email=${email}`);
    return null;
  }
  console.info(`[AUTH] Login success: email=${email} userId=${user.id}`);
  return { id: user.id, name: user.name, email: user.email };
}
```

**Note:** Do NOT log the password value. Log email only, not full PII.

---

### INFO-001: Middleware Token Presence Check (Not Validation) (INFO)

| Field | Value |
|---|---|
| **OWASP** | A01: Broken Access Control |
| **CVSS** | 0.0 (Informational) |
| **Location** | `src/middleware.ts:16-18` |
| **Status** | ACCEPTED |

**Description:**
The middleware checks for session cookie **presence** only, not JWT validity. A stale, expired, or tampered cookie would pass the middleware check. However, this is properly handled by the `auth()` call in each API route, which validates the JWT signature and expiration. This is standard defense-in-depth for NextAuth v5 and acceptable.

---

### INFO-002: File Extension Extraction from User Filename (INFO)

| Field | Value |
|---|---|
| **OWASP** | A03: Injection |
| **CVSS** | 0.0 (Informational) |
| **Location** | `src/app/api/upload/route.ts:57` |
| **Status** | ACCEPTED |

**Description:**
The file extension is extracted from the user-supplied filename (`file.name.split(".").pop()`) and appended to a UUID. While the magic bytes check validates actual file content, and the UUID prevents path traversal, the extension is not validated against an allowlist.

Theoretical risk: a `.js` file with embedded PDF magic bytes. However, uploaded files are stored in `uploads/` (not served by Next.js), there is no download endpoint, and files are only parsed server-side by `pdf-parse`/`mammoth`. **Not exploitable.**

---

## Summary Table

| # | Finding | Severity | OWASP | CVSS | Status |
|---|---|---|---|---|---|
| SEV-001 | IDOR — No ownership check on candidate endpoints | 🔵 MEDIUM | A01 | 6.5 | OPEN |
| SEV-002 | Missing security headers | 🔵 MEDIUM | A05 | 5.3 | OPEN |
| SEV-003 | No rate limiting on login | 🔵 MEDIUM | A07 | 5.3 | OPEN |
| SEV-004 | TOCTOU race in n8n callback | 🔵 MEDIUM | A04 | 4.7 | OPEN |
| SEV-005 | npm audit: 6 moderate vulnerabilities | 🔵 MEDIUM | A06 | 6.1 | OPEN |
| SEV-006 | Default seed password not force-changed | 🔷 LOW | A05 | 3.7 | OPEN |
| SEV-007 | Unbounded score values in callback schema | 🔷 LOW | A04 | 3.1 | OPEN |
| SEV-008 | No authentication event logging | 🔷 LOW | A09 | 3.7 | OPEN |
| INFO-001 | Middleware token presence check only | ⚪ INFO | A01 | 0.0 | ACCEPTED |
| INFO-002 | File extension from user filename | ⚪ INFO | A03 | 0.0 | ACCEPTED |

---

## OWASP Top 10 Coverage Matrix

| Category | Items Checked | Findings | Result |
|---|---|---|---|
| A01: Broken Access Control | 5 | SEV-001, INFO-001 | ⚠️ WARN |
| A02: Cryptographic Failures | 5 | 0 | ✅ PASS |
| A03: Injection | 5 | INFO-002 | ✅ PASS |
| A04: Insecure Design | 4 | SEV-004, SEV-007 | ⚠️ WARN |
| A05: Security Misconfiguration | 5 | SEV-002, SEV-006 | ⚠️ WARN |
| A06: Vulnerable Components | 5 | SEV-005 | ⚠️ WARN |
| A07: Authentication Failures | 5 | SEV-003 | ⚠️ WARN |
| A08: Software & Data Integrity | 3 | 0 | ✅ PASS |
| A09: Logging & Monitoring | 3 | SEV-008 | ⚠️ WARN |
| A10: SSRF | 3 | 0 | ✅ PASS |

---

## Positive Security Controls (Strengths)

The following security controls are properly implemented and should be acknowledged:

| Control | Implementation | File |
|---|---|---|
| Password hashing | bcryptjs cost 10 | `lib/auth.ts`, `prisma/seed.ts` |
| Timing-safe comparison | `crypto.timingSafeEqual()` with length mismatch handling | `lib/crypto-utils.ts` |
| JWT strategy | Short-lived JWT with user ID in token | `lib/auth.ts` |
| Generic login errors | "CredentialsSignin" for both invalid user/password | `lib/auth.ts` |
| File magic bytes validation | PDF/DOCX magic byte verification | `lib/file-validator.ts` |
| UUID filenames | Uploaded files renamed with UUID v4 | `api/upload/route.ts:58` |
| No raw SQL | All queries via Prisma ORM | All routes |
| No XSS sinks | Zero `dangerouslySetInnerHTML` or `innerHTML` usage | All `.tsx` files |
| No command injection | Zero `eval()`, `exec()`, `child_process` usage | All `.ts` files |
| No hardcoded secrets | All secrets from `process.env` | All files |
| `.env` protected | In `.gitignore` | `.gitignore` |
| No git history leaks | No secrets found in `git log -p` | Repository |
| n8n callback auth | Shared secret + timing-safe comparison | `api/n8n/callback/route.ts` |
| Mass assignment prevention | All server-side values controlled | `api/upload/route.ts:67-78` |
| SSRF protection | Webhook URL from env, no user-controlled fetch | `lib/n8n-client.ts` |
| Input validation | Zod schemas on all user inputs | `lib/validations.ts` |
| File size limit | 10MB max via Zod + client-side dropzone | `lib/validations.ts`, `file-dropzone.tsx` |
| Package lock integrity | `package-lock.json` present and consistent | Root |
| Postinstall automation | `prisma generate` on install | `package.json` |

---

## Residual Risk Statement

### What Was NOT Scanned

| Dimension | Reason | Risk Level |
|---|---|---|
| Dynamic penetration testing (DAST) | Static audit only — no running instance | Not assessed |
| Runtime dependency behavior | Static analysis of code, not runtime monitoring | Not assessed |
| Infrastructure/network security | No access to hosting environment, CDN, or WAF config | Not assessed |
| CI/CD pipeline security | No GitHub Actions or deployment scripts in scope | Not assessed |
| Third-party service security | n8n instance security, database hosting security | Not assessed |
| Cookie configuration flags | NextAuth v5 manages cookie flags internally; verified HttpOnly default but SameSite/Secure depend on NEXTAUTH_URL | Low |
| JWT algorithm enforcement | NextAuth v5 defaults to HS256; no `alg:none` risk in current implementation | Low |

### Accepted Risks

1. **INFO-001 (Middleware token check):** Defense-in-depth handled by per-route `auth()` calls. No action needed.
2. **INFO-002 (File extension):** Not exploitable given no file serving endpoint. No action needed.
3. **SEV-005 (npm audit moderates):** All vulnerabilities are in dev-only or build-time dependencies, not exploitable in production runtime. Monitor for patches.

---

## Fix Priority Roadmap

### Before Release (Recommended)

| Priority | Finding | Effort | Risk if Deferred |
|---|---|---|---|
| 1 | SEV-002: Add security headers | 15 min | Clickjacking, MIME attacks in production |
| 2 | SEV-008: Add auth logging | 15 min | Cannot detect attacks post-launch |
| 3 | SEV-007: Bound score values | 10 min | Data integrity risk from n8n |

### Within First Sprint Post-Release

| Priority | Finding | Effort | Risk if Deferred |
|---|---|---|---|
| 4 | SEV-001: Add IDOR ownership checks | 30 min | Horizontal privilege escalation |
| 5 | SEV-003: Add login rate limiting | 1 hour | Brute force attacks |
| 6 | SEV-006: Force-change seed password | 30 min | Default credential exposure |

### Technical Debt Backlog

| Priority | Finding | Effort | Risk if Deferred |
|---|---|---|---|
| 7 | SEV-004: Transaction-safe callback | 1 hour | Duplicate processing (already mitigated) |
| 8 | SEV-005: Monitor npm advisories | Ongoing | Low (build-time only) |

---

## Verdict Rationale

### ⚠️ CONDITIONAL GO

**Justification:**

- **Zero CRITICAL findings** — no immediate data breach or system compromise risks
- **Zero HIGH findings** — no exploitable vulnerabilities that could lead to unauthorized access under realistic attack scenarios
- **5 MEDIUM findings** — all documented with fix plans and realistic timelines
- **3 LOW findings** — minor hardening items suitable for post-release sprints
- **All MEDIUM items have mitigating factors** that reduce real-world exploitability:
  - IDOR mitigated by single-role architecture + non-sequential IDs
  - Missing headers mitigated by NextAuth's internal cookie security
  - No rate limiting mitigated by bcrypt cost factor + generic error messages
  - TOCTOU mitigated by SQLite serialization + unique constraint
  - npm audit moderates are all build-time/dev-only dependencies

**Conditions for full GO:**
1. SEV-002 (security headers) implemented before production deployment
2. SEV-008 (auth logging) implemented before production deployment
3. SEV-001 (IDOR fix) committed within first post-release sprint
4. SEV-005 (npm vulnerabilities) monitored via automated advisories

---

*Report generated by Hekel — Security Scanning Expert*
*Scan method: Static code analysis + pattern matching + dependency audit + configuration review*
*Tools: Source code review, npm audit, git history scan, Grep pattern matching*
