# Security Audit Report: Credit Payment System

```
╔══════════════════════════════════════════════════════════╗
║  SECURITY SCAN REPORT                                    ║
║  Project: SuperHRD — Credit Payment System               ║
║  Branch:  security/credit-payment-system-audit           ║
║  Date:    2026-06-11                                     ║
║  Auditor: Hekel (Security Scan Specialist)               ║
║  Verdict: ⚠️ WARN — 3 HIGH, 7 MEDIUM, 5 LOW, 2 INFO    ║
╠══════════════════════════════════════════════════════════╣
║  🔴 CRITICAL: 0  🟠 HIGH: 3  🟡 MEDIUM: 7              ║
║  🔵 LOW: 5       ⚪ INFO: 2                              ║
║                                                          ║
║  OWASP Mapping:                                          ║
║  A01(3) A02(0) A03(2) A04(4) A05(1) A06(1)             ║
║  A07(2) A08(1) A09(0) A10(1)                            ║
╚══════════════════════════════════════════════════════════╝
```

## Executive Summary

The credit payment system is **functionally correct in its happy path** but has **significant concurrency and business logic vulnerabilities** that could be exploited under concurrent or adversarial conditions. The most critical issue is a **race condition in credit deduction** (`deductCredit()`) that could allow double-spending or negative balances under concurrent requests. The system also lacks idempotency guarantees for financial operations, uses in-memory rate limiting that doesn't survive restarts, and has no CSRF protection on state-changing endpoints.

**Positive findings:** Authentication is properly enforced on all endpoints. Admin authorization checks are present on all admin routes. The n8n callback uses timing-safe comparison for secrets. Prisma ORM prevents SQL injection. Password hashing uses bcryptjs. No secrets were found in git history. No `eval()`, `dangerouslySetInnerHTML`, or raw SQL queries were detected.

**GO/NO-GO Recommendation:** ⚠️ **CONDITIONAL GO** — The HIGH findings (#1, #2) should be fixed before production deployment. MEDIUM findings should be addressed within the first sprint after launch.

---

## Scope

| File | Lines | Role |
|---|---|---|
| `src/lib/credits.ts` | 436 | Core credit logic, quota, topup approval/rejection |
| `src/lib/zod-schemas/credits.ts` | 24 | Input validation schemas |
| `src/lib/auth.ts` | 97 | Authentication, JWT, rate limiting |
| `src/app/api/credit/balance/route.ts` | 22 | Balance endpoint |
| `src/app/api/credit/transactions/route.ts` | 59 | Transaction history |
| `src/app/api/topup/qris/route.ts` | 75 | QRIS topup submission |
| `src/app/api/topup/requests/route.ts` | 61 | User topup request listing |
| `src/app/api/admin/topup-requests/route.ts` | 72 | Admin topup listing |
| `src/app/api/admin/topup/[id]/approve/route.ts` | 43 | Admin approve |
| `src/app/api/admin/topup/[id]/reject/route.ts` | 56 | Admin reject |
| `src/app/api/upload/route.ts` | 193 | Upload with credit deduction |
| `src/app/api/n8n/callback/route.ts` | 83 | n8n callback (out of scope but reviewed) |
| `src/proxy.ts` | 48 | Middleware route protection |
| `prisma/schema.prisma` | 109 | Data models |
| `next.config.ts` | 25 | Security headers |

---

## Detailed Findings

---

### 🔴 HIGH-01: Race Condition in Credit Deduction (Non-Atomic)

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS** | 7.1 — AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:H |
| **CWE** | CWE-362 (Race Condition / TOCTOU) |
| **OWASP** | A01: Broken Access Control, A04: Insecure Design |
| **File** | `src/lib/credits.ts:64-195` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
The `deductCredit()` function performs credit deduction through **three separate, sequential database operations** (quota reset → quota deduction → paid credit deduction) without wrapping them in a single atomic transaction. Each step uses `prisma.user.updateMany()` followed by `prisma.user.findUnique()` to read the new balance. Between these operations, a concurrent request can interleave and create inconsistent state.

**Exploit Scenario:**
1. User has 0 daily quota used and 5 credits balance.
2. Attacker sends 2 concurrent upload requests simultaneously.
3. Both requests reach `deductCredit()` at the same time.
4. Request A: `updateMany` resets quota → `updateMany` deducts quota (dailyQuotaUsed=1)
5. Request B: `updateMany` resets quota (dailyQuotaUsed=0 again!) → `updateMany` deducts quota (dailyQuotaUsed=1)
6. Both requests succeed using quota, but user effectively got 2 screenings from 1 quota slot.
7. Repeated rapidly, this exhausts quota + credits faster than intended.

**Impact:** Double-spending of credits, quota bypass, potential negative balance.

**Fix Applied:**
Wrapped the entire `deductCredit()` flow in `prisma.$transaction()` to ensure atomicity.

```typescript
// ❌ BEFORE: Sequential non-atomic operations
const resetResult = await prisma.user.updateMany({ ... });
const quotaResult = await prisma.user.updateMany({ ... });
const creditResult = await prisma.user.updateMany({ ... });

// ✅ AFTER: Single atomic transaction
const result = await prisma.$transaction(async (tx) => {
  // All operations use tx instead of prisma
  // Read-then-write within same transaction context
});
```

---

### 🔴 HIGH-02: No Idempotency on Upload / Credit Deduction

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS** | 7.1 — AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:H |
| **CWE** | CWE-362 (Race Condition), CWE-479 (Signal Handling) |
| **OWASP** | A04: Insecure Design |
| **API Security** | API6: Unrestricted Access to Hostile Business Flows |
| **File** | `src/app/api/upload/route.ts:12-193` |
| **Status** | 📋 ISSUE FILED (requires architectural decision) |

**Description:**
The upload endpoint has no idempotency key mechanism. If a client sends a POST request, the server deducts credits and begins processing, but the HTTP response is lost (network timeout, proxy timeout, etc.), the client may retry the request. The retry will trigger a **second credit deduction** for the same candidate screening.

**Exploit Scenario:**
1. User submits upload → server deducts 1 credit, starts processing.
2. Network timeout occurs before response reaches client.
3. Client auto-retries → server deducts another credit for the same file.
4. User is double-charged.

**Impact:** Financial loss for users, trust erosion.

**Recommended Fix:**
Implement idempotency keys via an `Idempotency-Key` header or a client-generated request ID:

```typescript
// Store idempotency key with transaction
const idempotencyKey = req.headers.get('Idempotency-Key') || uuidv4();

// Check if this request was already processed
const existing = await prisma.transaction.findFirst({
  where: {
    userId: session.user.id,
    metadata: { contains: idempotencyKey },
    type: 'deduct_screening',
  },
});
if (existing) {
  return NextResponse.json({ candidateId: existing.metadata.candidateId, status: 'already_processing' });
}
```

---

### 🔴 HIGH-03: SQLite Concurrent Write Limitations for Financial System

| Field | Value |
|---|---|
| **Severity** | HIGH (production only) |
| **CVSS** | 7.5 — AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H |
| **CWE** | CWE-362 (Race Condition), CWE-400 (Resource Exhaustion) |
| **OWASP** | A08: Software and Data Integrity |
| **File** | `prisma/schema.prisma:6-8` (datasource), `docker-compose.yml`, `Dockerfile` |
| **Status** | RESOLVED (migrated to PostgreSQL) |

**Description:**
The system previously used SQLite via `better-sqlite3`, which serialized all write operations behind a single-writer lock. That created avoidable contention under concurrent credit operations.

- Write operations queue behind each other
- Under load, `SQLITE_BUSY` errors cause transaction failures
- The `updateMany` + `findUnique` pattern in `deductCredit` relies on sequential execution, which SQLite enforces — but at the cost of throughput
- `$transaction()` calls in Prisma with SQLite use interactive transactions that hold the write lock for the entire duration

**Current state:** The application now uses PostgreSQL for both local Docker and runtime deployment paths, removing the file-backed SQLite bottleneck from the active architecture.

**Recommended Fix:**
Migrate to PostgreSQL for production deployment:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
PostgreSQL supports row-level locking (`SELECT ... FOR UPDATE`), concurrent writes, and proper transaction isolation levels required for financial operations.

---

### 🟡 MEDIUM-01: Quota Refund Can Underflow Below Zero

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 5.3 — AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:L |
| **CWE** | CWE-191 (Integer Underflow) |
| **OWASP** | A04: Insecure Design |
| **File** | `src/app/api/upload/route.ts:156-173` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
When the n8n screening service fails and the credit source was `quota`, the refund logic decrements `dailyQuotaUsed` without checking that it's greater than 0:

```typescript
data: { dailyQuotaUsed: { decrement: 1 } }
```

If multiple refunds happen concurrently, or if a refund is triggered after the quota has already been used by another request, `dailyQuotaUsed` can go negative. A negative `dailyQuotaUsed` means `DAILY_QUOTA_LIMIT - dailyQuotaUsed` yields more than 5 remaining quota slots.

**Exploit Scenario:**
1. User uses 5 quota slots (dailyQuotaUsed=5).
2. User pays 1 credit for 6th screening, but it uses quota due to race condition.
3. n8n fails on the 6th screening → refund decrements dailyQuotaUsed to 4.
4. User now has 1 extra quota slot they shouldn't have.

**Fix Applied:**
Added a floor check to prevent `dailyQuotaUsed` from going below 0:

```typescript
// ✅ AFTER: Conditional decrement
await tx.user.updateMany({
  where: {
    id: session.user.id,
    dailyQuotaUsed: { gt: 0 },
  },
  data: { dailyQuotaUsed: { decrement: 1 } },
});
```

---

### 🟡 MEDIUM-02: In-Memory Rate Limiting Not Cluster-Safe

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 5.3 — AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N |
| **CWE** | CWE-770 (Allocation of Resources Without Limits) |
| **OWASP** | A07: Identification and Authentication Failures |
| **File** | `src/lib/auth.ts:6-31` |
| **Status** | 📋 ISSUE FILED |

**Description:**
Login rate limiting uses an in-memory `Map<string, { count: number; lockedUntil: number }>()`. This has three problems:

1. **Not persistent:** Server restart clears all rate limits.
2. **Not shared:** In multi-instance/serverless deployment, each instance has its own counter. An attacker can distribute login attempts across instances.
3. **Memory leak potential:** If the map grows unbounded (unique email addresses), it could consume memory.

**Impact:** Brute-force attacks are trivially bypassed by distributing requests across server instances or waiting for a restart.

**Recommended Fix:**
Use Redis or the database for rate limiting:
```typescript
// Redis-based rate limiting
const key = `ratelimit:login:${email}`;
const attempts = await redis.incr(key);
if (attempts === 1) await redis.expire(key, 900); // 15 min window
if (attempts > MAX_ATTEMPTS) return false;
```

---

### 🟡 MEDIUM-03: No CSRF Protection on State-Changing Endpoints

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 4.3 — AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N |
| **CWE** | CWE-352 (Cross-Site Request Forgery) |
| **OWASP** | A01: Broken Access Control |
| **Files** | All POST endpoints: upload, topup/qris, admin/topup/[id]/approve, admin/topup/[id]/reject |
| **Status** | 📋 ISSUE FILED |

**Description:**
No CSRF token validation is implemented on any state-changing endpoint. The system relies on NextAuth's session cookie, which defaults to `SameSite: Lax`. This provides partial protection:

- `SameSite: Lax` blocks cross-site POST from forms (most CSRF attacks)
- `SameSite: Lax` does NOT block same-site AJAX calls (if attacker controls a subdomain)
- API endpoints called via `fetch()` from the same origin are not protected

**Affected Endpoints:**
- `POST /api/upload` — Credit deduction + file upload
- `POST /api/topup/qris` — Topup request submission
- `POST /api/admin/topup/[id]/approve` — Admin approval
- `POST /api/admin/topup/[id]/reject` — Admin rejection

**Mitigating Factors:**
- NextAuth `SameSite: Lax` cookie (partial protection)
- JSON content-type requirement (blocks simple form-based CSRF)
- All endpoints require authentication (attacker needs active session)

**Recommended Fix:**
Implement double-submit cookie pattern or origin validation:
```typescript
// Origin validation (simpler approach)
const origin = req.headers.get('Origin');
const allowedOrigins = [process.env.APP_URL];
if (origin && !allowedOrigins.includes(origin)) {
  return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
}
```

---

### 🟡 MEDIUM-04: JWT `isAdmin` Claim Not Refreshed from Database

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 5.9 — AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:H/A:N |
| **CWE** | CWE-285 (Improper Authorization), CWE-613 (Insufficient Session Expiration) |
| **OWASP** | A07: Identification and Authentication Failures |
| **File** | `src/lib/auth.ts:82-96` |
| **Status** | 📋 ISSUE FILED |

**Description:**
The `isAdmin` flag is embedded in the JWT token at login time and never refreshed from the database during the session. This means:

1. If an admin revokes a user's admin privileges, the user retains admin access until their JWT expires.
2. If a user's account is deleted or disabled, the JWT remains valid.
3. If a new admin is promoted, they must re-login to access admin features.

**Exploit Scenario:**
1. Admin A detects that Admin B's account is compromised.
2. Admin A sets `isAdmin = false` for Admin B in the database.
3. Attacker controlling Admin B's session continues to access admin endpoints until JWT expires.

**Impact:** Delayed privilege revocation creates a window for unauthorized admin access.

**Recommended Fix:**
Validate `isAdmin` against the database on each request for admin endpoints:
```typescript
// In admin route handlers:
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { isAdmin: true },
});
if (!user?.isAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### 🟡 MEDIUM-05: No Rate Limiting on Credit Operations

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 5.3 — AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L |
| **CWE** | CWE-770 (Resource Exhaustion) |
| **OWASP** | A04: Insecure Design |
| **API Security** | API4: Unrestricted Resource Consumption |
| **Files** | `src/app/api/upload/route.ts`, `src/app/api/topup/qris/route.ts` |
| **Status** | 📋 ISSUE FILED |

**Description:**
Credit-related endpoints have no rate limiting. An authenticated user can:
- Submit unlimited upload requests in rapid succession (amplifying race condition exploits)
- Submit unlimited topup requests (though the "existing pending" check partially mitigates this)
- Trigger expensive database operations repeatedly

**Impact:** Resource exhaustion, amplification of race condition vulnerabilities, potential DoS.

**Recommended Fix:**
Implement per-user rate limiting using middleware or a rate-limiting library:
```typescript
// Example: 10 uploads per minute per user
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
```

---

### 🟡 MEDIUM-06: proofImageUrl Accepts Arbitrary URLs (SSRF / Tracking Risk)

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 4.3 — AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:N/A:N |
| **CWE** | CWE-918 (Server-Side Request Forgiciency), CWE-200 (Information Exposure) |
| **OWASP** | A10: Server-Side Request Forgery |
| **File** | `src/lib/zod-schemas/credits.ts:12`, `src/app/api/topup/qris/route.ts:56` |
| **Status** | 📋 ISSUE FILED |

**Description:**
The `proofImageUrl` field accepts any valid URL from the user. While the URL is not fetched server-side (it's stored and displayed to admins), it creates two risks:

1. **Tracking pixel:** A malicious user submits a URL to their own server with tracking parameters. When an admin views the topup request list, the admin's browser loads the image, revealing the admin's IP address, browser fingerprint, and viewing time.
2. **Internal network probing:** If the admin's browser is on an internal network, URLs like `http://192.168.1.1/admin` could probe internal resources.

**Impact:** Admin deanonymization, internal network reconnaissance.

**Recommended Fix:**
- Proxy proof images through the application server
- Or restrict to known CDN domains
- Or add `referrerPolicy="no-referrer"` and `loading="lazy"` to `<img>` tags in the admin UI

---

### 🟡 MEDIUM-07: Transaction Type Enum Cast Without Validation

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 4.3 — AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N |
| **CWE** | CWE-20 (Improper Input Validation) |
| **OWASP** | A03: Injection |
| **File** | `src/app/api/credit/transactions/route.ts:22` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
The `type` query parameter is cast to `TransactionType` without validation:
```typescript
whereClause.type = type as TransactionType;
```
An attacker can pass arbitrary strings. While Prisma will likely reject invalid enum values at the database layer, this could cause unhandled errors or unexpected behavior.

**Fix Applied:**
Added enum validation before the cast:
```typescript
const VALID_TYPES = ['topup_qris', 'topup_stripe', 'deduct_screening', 'admin_adjustment', 'daily_quota', 'refund'] as const;
if (type && type !== 'all' && !VALID_TYPES.includes(type as any)) {
  return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
}
```

---

### 🔵 LOW-01: File Extension Not Sanitized

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 3.1 — AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N |
| **CWE** | CWE-434 (Unrestricted Upload) |
| **OWASP** | A03: Injection |
| **File** | `src/app/api/upload/route.ts:72` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
The file extension is extracted from the user-provided filename without sanitization:
```typescript
const fileExtension = file.name.split(".").pop();
const fileName = `${uuidv4()}.${fileExtension}`;
```

While the UUID prefix prevents path traversal, the extension could be:
- An executable type (`.php`, `.jsp`, `.exe`) — dangerous if uploads dir is ever served
- Contains special characters (spaces, unicode) — could break downstream tools
- Missing entirely (filename has no dot) — results in full filename as "extension"

**Fix Applied:**
Allowlist of safe extensions:
```typescript
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
const fileExtension = file.name.split(".").pop()?.toLowerCase() || '';
if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
  return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
}
```

---

### 🔵 LOW-02: Error Messages Leak Internal Business Logic

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 3.1 — AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N |
| **CWE** | CWE-209 (Information Exposure Through Error Message) |
| **OWASP** | A05: Security Misconfiguration |
| **Files** | `src/app/api/admin/topup/[id]/approve/route.ts:28-36`, `src/app/api/admin/topup/[id]/reject/route.ts:39-49` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
Internal error messages from `credits.ts` are passed directly to API responses:
```typescript
if (message.includes('not found')) {
  return NextResponse.json({ error: message }, { status: 404 });
}
if (message.includes('Cannot approve') || message.includes('not pending')) {
  return NextResponse.json({ error: message }, { status: 409 });
}
```

Messages like `"Cannot approve rejected topup request"` reveal internal state machine logic to potential attackers.

**Fix Applied:**
Replaced with generic error messages that preserve HTTP status codes.

---

### 🔵 LOW-03: Status Enum Cast With `as any`

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 2.7 — AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N |
| **CWE** | CWE-20 (Improper Input Validation) |
| **OWASP** | A03: Injection |
| **Files** | `src/app/api/topup/requests/route.ts:21`, `src/app/api/admin/topup-requests/route.ts:30` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
Status query parameters are cast using `as any`, bypassing TypeScript's type safety:
```typescript
whereClause.status = status as any;
```

**Fix Applied:**
Added enum validation similar to the transaction type fix.

---

### 🔵 LOW-04: Topup Request ID Not Validated as CUID Format

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 2.7 — AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:N |
| **CWE** | CWE-20 (Improper Input Validation) |
| **OWASP** | A03: Injection |
| **Files** | `src/app/api/admin/topup/[id]/approve/route.ts:15`, `src/app/api/admin/topup/[id]/reject/route.ts:20` |
| **Status** | 🔧 FIX APPLIED |

**Description:**
The `topupId` from URL params is passed directly to database queries without format validation. While Prisma parameterizes queries (preventing SQL injection), malformed IDs cause unnecessary database queries.

**Fix Applied:**
Added CUID format validation:
```typescript
const CUID_REGEX = /^c[^\s-]{8,}$/i;
if (!CUID_REGEX.test(topupId)) {
  return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
}
```

---

### 🔵 LOW-05: No Request Body Size Limit

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 3.7 — AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L |
| **CWE** | CWE-400 (Uncontrolled Resource Consumption) |
| **OWASP** | A04: Insecure Design |
| **API Security** | API4: Unrestricted Resource Consumption |
| **Files** | All POST endpoints |
| **Status** | 📋 ISSUE FILED |

**Description:**
No API endpoint limits the size of incoming request bodies. An attacker could send extremely large JSON payloads to exhaust server memory or cause denial of service.

**Mitigating Factors:**
- Next.js has a default 1MB body limit for API routes (configurable)
- File uploads use FormData which has separate limits

**Recommended Fix:**
Explicitly configure body size limits in Next.js config per route:
```typescript
export const config = {
  api: { bodyParser: { sizeLimit: '500kb' } },
};
```

---

### ⚪ INFO-01: Security Headers Only in Production Mode

| Field | Value |
|---|---|
| **Severity** | INFO |
| **CWE** | N/A |
| **OWASP** | A05: Security Misconfiguration |
| **File** | `next.config.ts:17` |
| **Status** | ℹ️ ACCEPTABLE |

**Description:**
Security headers (CSP, HSTS, X-Frame-Options, etc.) are only applied when `NODE_ENV === 'production'`. This is standard practice for development but should be documented.

**Mitigating:** Ensure `NODE_ENV=production` is set in all deployment environments.

---

### ⚪ INFO-02: Transitive Dependency Vulnerabilities (npm audit)

| Field | Value |
|---|---|
| **Severity** | INFO |
| **CWE** | CWE-1395 (Dependency on Vulnerable Component) |
| **OWASP** | A06: Vulnerable and Outdated Components |
| **File** | `package.json`, `package-lock.json` |
| **Status** | ℹ️ MONITORING |

**Description:**
`npm audit` reports 6 moderate vulnerabilities, all in transitive dependencies:

| Package | Severity | Issue | Fix Available |
|---|---|---|---|
| `@hono/node-server` <1.19.13 | moderate | Middleware bypass via repeated slashes | Breaking change (prisma downgrade) |
| `postcss` <8.5.10 | moderate | XSS via unescaped `</style>` in CSS stringify | Breaking change (next downgrade) |

**Assessment:**
- `@hono/node-server` — Only used by Prisma's dev server, not in production runtime. **Not exploitable.**
- `postcss` — Used by Next.js build pipeline, not runtime. The XSS requires attacker-controlled CSS input, which this application doesn't accept. **Not exploitable in current context.**

**Recommendation:** Monitor for upstream fixes. No immediate action required.

---

## OWASP Top 10 (2021) Coverage Summary

| Category | Findings | Status |
|---|---|---|
| **A01: Broken Access Control** | HIGH-01 (race condition), MEDIUM-03 (CSRF) | Partial — auth checks present, concurrency gaps |
| **A02: Cryptographic Failures** | None | ✅ PASS — bcrypt, timing-safe compare, no hardcoded secrets |
| **A03: Injection** | MEDIUM-07, LOW-01, LOW-03, LOW-04 | ✅ PASS — Prisma ORM prevents SQLi, fixes applied for validation |
| **A04: Insecure Design** | HIGH-02 (no idempotency), MEDIUM-01, MEDIUM-05, LOW-05 | ⚠️ Gaps in financial operation design |
| **A05: Security Misconfiguration** | LOW-02, INFO-01 | ✅ Mostly PASS — security headers, error handling improved |
| **A06: Vulnerable Components** | INFO-02 | ✅ PASS — no exploitable runtime vulnerabilities |
| **A07: Authentication Failures** | MEDIUM-02 (rate limiting), MEDIUM-04 (JWT stale) | ⚠️ Partial — auth works but resilience gaps |
| **A08: Software and Data Integrity** | HIGH-03 (SQLite, historical) | ✅ RESOLVED via PostgreSQL migration |
| **A09: Logging and Monitoring** | None | ✅ PASS — auth events logged, no sensitive data in logs |
| **A10: SSRF** | MEDIUM-06 (proofImageUrl) | ⚠️ Low risk but should be addressed |

---

## PCI DSS Relevance Assessment

While this system uses credits (not direct card payments), the QRIS topup flow handles payment proof and financial transactions:

| Requirement | Status | Notes |
|---|---|---|
| Req 1: Network security controls | N/A | Application-level audit only |
| Req 2: Secure configurations | ✅ | No default credentials in code, .env in .gitignore |
| Req 3: Protect stored data | ⚠️ | Credit balances stored without encryption at rest |
| Req 4: Protect transmitted data | ✅ | HTTPS enforced via HSTS header |
| Req 5: Protect from malware | N/A | Infrastructure-level control |
| Req 6: Develop secure systems | ⚠️ | Findings in this report need remediation |
| Req 7: Restrict access by business need | ✅ | Admin/user separation enforced |
| Req 8: Identify and authenticate | ✅ | NextAuth with bcrypt, JWT sessions |
| Req 9: Restrict physical access | N/A | Infrastructure-level control |
| Req 10: Log and monitor | ⚠️ | Transaction audit trail exists, but no alerting |
| Req 11: Test security regularly | 📋 | This audit is the first security review |
| Req 12: Support info security with policies | N/A | Organizational control |

---

## Scans Not Performed (Out of Scope)

The following checks were **not performed** in this audit and should be covered separately:

| Check | Reason | Recommended Tool |
|---|---|---|
| Dynamic Application Security Testing (DAST) | Requires running application | OWASP ZAP, Burp Suite |
| Penetration testing | Requires authorized engagement | Manual pentest |
| Network-level security | Infrastructure scope | Cloud provider security review |
| Container/Docker security | No Dockerfile in scope | Trivy, Snyk Container |
| CI/CD pipeline security | No CI config in scope | GitHub Actions security review |
| Third-party API security (n8n) | External system | n8n security review |
| Browser-side security (React) | Frontend scope separate | React security audit |
| Webhook signature validation (n8n outbound) | Not in credit system scope | Manual review |

---

## Remediation Priority

| Priority | Finding | Effort | Timeline |
|---|---|---|---|
| **P0** | HIGH-01: Race condition in deductCredit | S | Fix applied this PR |
| **P0** | MEDIUM-01: Quota refund underflow | S | Fix applied this PR |
| **P0** | MEDIUM-07: Transaction type validation | S | Fix applied this PR |
| **P1** | HIGH-02: Upload idempotency | M | Next sprint |
| **P1** | MEDIUM-04: JWT isAdmin refresh | M | Next sprint |
| **P1** | MEDIUM-05: Rate limiting on credit ops | M | Next sprint |
| **P2** | HIGH-03: SQLite → PostgreSQL | L | Resolved |
| **P2** | MEDIUM-02: Redis-based rate limiting | M | Before production launch |
| **P2** | MEDIUM-03: CSRF protection | M | Before production launch |
| **P3** | MEDIUM-06: proofImageUrl SSRF | S | Backlog |
| **P3** | LOW-05: Body size limits | S | Backlog |
| **P3** | INFO-02: Dependency monitoring | S | Backlog |

*S = Small (< 4h), M = Medium (1-3 days), L = Large (1+ week)*

---

## Conclusion

The credit payment system has a solid foundation: authentication is properly enforced, SQL injection is prevented by Prisma ORM, passwords are hashed with bcrypt, and the n8n callback uses timing-safe secret comparison. The audit trail via the `Transaction` model is a good design choice.

However, the **concurrency handling in financial operations is the primary risk**. The `deductCredit()` function's non-atomic design creates a race condition window that could be exploited for double-spending. This fix has been applied in this PR. The remaining architectural issues (idempotency, CSRF, JWT refresh) should be addressed before production launch.

**Overall Risk Rating:** ⚠️ **MEDIUM** — Safe for staging/QA with applied fixes. Address P0-P1 items before production deployment.

