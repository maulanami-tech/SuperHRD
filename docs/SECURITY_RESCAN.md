# Security Re-Scan Report: Credit Payment System (Post-P1 Fixes)

```
╔════════════════════════════════════════════════════════════════╗
║  SECURITY RE-SCAN REPORT                                       ║
║  Project: SuperHRD — Credit Payment System                     ║
║  Branch:  security/credit-payment-system-audit                 ║
║  Date:    2026-06-12                                           ║
║  Auditor: Hekel (Security Scan Specialist)                     ║
║  Previous Scan: 2026-06-11 (17 findings)                       ║
╠════════════════════════════════════════════════════════════════╣
║  Verdict: ⚠️ WARN — P1 fixes applied correctly                 ║
║  but idempotency implementation introduces new issues          ║
║                                                                ║
║  🔴 CRITICAL: 0  🟠 HIGH: 2   🟡 MEDIUM: 7                  ║
║  🔵 LOW: 6       ⚪ INFO: 2                                    ║
║                                                                ║
║  Previous fixes verified: 7/7 ✅                               ║
║  Regressions detected:    4 (all in idempotency feature)       ║
║  New findings:            2                                    ║
║  Remaining from original: 7                                    ║
╚════════════════════════════════════════════════════════════════╝
```

## Executive Summary

This re-scan verifies the P1 security fixes from the 2026-06-11 audit and scans for regressions. **All 7 original fixes are correctly applied and verified.** The admin DB re-validation for `isAdmin` is now consistently applied to all 3 admin API routes. The `deductCredit()` race condition fix using `prisma.$transaction()` is sound.

However, the **idempotency implementation (HIGH-02 fix) introduces 4 regressions** that need attention:
1. Hardcoded wrong quota limit (10 instead of 5) in cached response
2. Credit source derivation in cached response is unreliable
3. Idempotency lookup is not user-scoped (cross-user data leak)
4. Auto-generated idempotency keys provide no protection for clients that don't send the header

Additionally, the `rejectTopup()` function retains a TOCTOU pattern from the original code that could cause unnecessary error responses under concurrent admin actions.

**Overall Assessment:** The system is **safer than before** the P1 fixes. The race condition in `deductCredit()` is eliminated. The admin authorization pattern now provides real-time privilege revocation. However, the idempotency implementation needs refinement before it provides reliable double-charge protection.

---

## Part 1: Fix Verification

### ✅ HIGH-01: Race Condition in deductCredit — VERIFIED FIXED

**File:** `src/lib/credits.ts:64-180`
**Change:** Entire `deductCredit()` function now wrapped in `prisma.$transaction(async (tx) => { ... })`
**Verification:**
- All database reads use `tx.user.findUnique()` (line 76, 110, 145)
- All database writes use `tx.user.update()` (line 94, 105, 140)
- Transaction records created via `tx.transaction.create()` (line 119, 154)
- Quota reset + deduction + credit check are sequential within a single transaction
- Read-then-write pattern is safe within the current PostgreSQL-backed transaction flow

**Status:** ✅ Correctly fixed. No residual race condition in the deduction flow.

---

### ✅ MEDIUM-01: Quota Refund Underflow — VERIFIED FIXED

**File:** `src/app/api/upload/route.ts:188-216`
**Change:** `updateMany` with `dailyQuotaUsed: { gt: 0 }` guard replaces bare `decrement: 1`
**Verification:**
- `updateMany` WHERE clause: `{ id: session.user.id, dailyQuotaUsed: { gt: 0 } }` (line 190-193)
- `restoreResult.count > 0` check before creating refund transaction record (line 203)
- Prevents `dailyQuotaUsed` from going below 0 under any circumstance

**Status:** ✅ Correctly fixed. Underflow is impossible.

---

### ✅ MEDIUM-04: JWT isAdmin Refresh — VERIFIED FIXED

**Files:**
- `src/app/api/admin/topup/[id]/approve/route.ts:19-26`
- `src/app/api/admin/topup/[id]/reject/route.ts:23-31`
- `src/app/api/admin/topup-requests/route.ts:13-21`

**Change:** All 3 admin API routes now re-validate `isAdmin` from database on every request.
**Verification:**
- Each route performs `prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })`
- Returns `403 Forbidden` if `!user?.isAdmin`
- No admin route relies solely on the JWT-cached `isAdmin` claim
- Auth check is properly separated: 401 for unauthenticated, 403 for non-admin

**Status:** ✅ Correctly fixed across all 3 admin routes. Privilege revocation is immediate.

---

### ✅ MEDIUM-07: Transaction Type Enum Validation — VERIFIED FIXED

**File:** `src/app/api/credit/transactions/route.ts:19-28`
**Change:** `VALID_TYPES` const array with explicit validation before Prisma query
**Verification:**
- `VALID_TYPES` includes all 6 enum values (line 19)
- Invalid types return `400 Bad Request` before reaching Prisma (line 24-26)
- `type as TransactionType` cast only occurs after validation passes (line 27)

**Status:** ✅ Correctly fixed.

---

### ✅ LOW-01: File Extension Allowlist — VERIFIED FIXED

**File:** `src/app/api/upload/route.ts:97-104`
**Change:** `ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx']` with case-insensitive check
**Verification:**
- Extension extracted and lowercased (line 98)
- Allowlist validation before file write (line 99-103)
- Error message lists allowed types (line 101)

**Status:** ✅ Correctly fixed.

---

### ✅ LOW-02: Generic Error Messages — VERIFIED FIXED

**Files:**
- `src/app/api/admin/topup/[id]/approve/route.ts:43-58`
- `src/app/api/admin/topup/[id]/reject/route.ts:56-71`

**Change:** Internal error messages replaced with generic responses
**Verification:**
- `error: any` replaced with `error: unknown` (proper TypeScript)
- `message.includes()` checks still used for routing but response messages are generic
- No internal state names (e.g., "rejected", "expired") leak to clients

**Status:** ✅ Correctly fixed.

---

### ✅ LOW-03 & LOW-04: Enum & CUID Validation — VERIFIED FIXED

**Files:**
- `src/app/api/topup/requests/route.ts:18-27` (status enum)
- `src/app/api/admin/topup-requests/route.ts:28-46` (status enum)
- `src/app/api/admin/topup/[id]/approve/route.ts:30-32` (CUID)
- `src/app/api/admin/topup/[id]/reject/route.ts:34-37` (CUID)

**Status:** ✅ Correctly fixed in all locations.

---

## Part 2: Regressions Detected

### 🔴 REG-01: Hardcoded Wrong Quota Limit in Idempotency Cache Response

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **CVSS** | 7.5 — AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N |
| **CWE** | CWE-682 (Incorrect Calculation) |
| **OWASP** | A04: Insecure Design |
| **File** | `src/app/api/upload/route.ts:39` |
| **Introduced By** | HIGH-02 idempotency fix |

**Description:**
The cached idempotency response hardcodes `10` as the quota limit instead of using the `DAILY_QUOTA_LIMIT` constant (which is `5`):

```typescript
// src/app/api/upload/route.ts:39
remainingQuota: user ? Math.max(0, 10 - user.dailyQuotaUsed) : 0,
```

**Impact:** Users who hit the idempotency cache receive incorrect `remainingQuota` values. With `dailyQuotaUsed=0`, the response reports 10 remaining instead of 5. This is a data integrity bug in the API response.

**Fix:**
```typescript
// Import and use the constant
import { DAILY_QUOTA_LIMIT } from '@/lib/credits';
// ...
remainingQuota: user ? Math.max(0, DAILY_QUOTA_LIMIT - user.dailyQuotaUsed) : 0,
```

---

### 🟡 REG-02: Unreliable Credit Source Derivation in Cached Response

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 5.3 — AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N |
| **CWE** | CWE-682 (Incorrect Calculation) |
| **OWASP** | A04: Insecure Design |
| **File** | `src/app/api/upload/route.ts:29-40` |
| **Introduced By** | HIGH-02 idempotency fix |

**Description:**
The cached response tries to reconstruct the credit source from current user state:

```typescript
// src/app/api/upload/route.ts:29-40
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { dailyQuotaUsed: true },
});

return NextResponse.json({
  candidateId: existingCandidate.id,
  status: existingCandidate.status,
  cached: true,
  creditUsed: user && user.dailyQuotaUsed > 0 ? 'quota' : 'paid',  // ← WRONG
  remainingQuota: user ? Math.max(0, 10 - user.dailyQuotaUsed) : 0, // ← REG-01
});
```

The `dailyQuotaUsed > 0` check does NOT tell us whether the cached screening used quota or paid credits. If the user has done screenings since the original cached request, `dailyQuotaUsed` could be >0 even though the cached screening used paid credits.

**Fix:** Store the credit source on the candidate record during creation:
```typescript
// prisma/schema.prisma — add field to Candidate model
creditSource  String?   // "quota" or "paid"

// Then in cached response:
creditUsed: existingCandidate.creditSource || 'unknown',
```

---

### 🟡 REG-03: Idempotency Lookup Not Scoped to Current User (IDOR)

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 5.3 — AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N |
| **CWE** | CWE-639 (Authorization Bypass Through User-Controlled Key / IDOR) |
| **OWASP** | A01: Broken Access Control |
| **File** | `src/app/api/upload/route.ts:22-26` |
| **Introduced By** | HIGH-02 idempotency fix |

**Description:**
The idempotency lookup uses `prisma.candidate.findUnique({ where: { idempotencyKey } })` without filtering by the current user's ID. If User A knows the idempotency key from User B's request (e.g., by observing the `Idempotency-Key` header value), User A can retrieve User B's candidate data:

```typescript
// src/app/api/upload/route.ts:22-26
const existingCandidate = await prisma.candidate.findUnique({
  where: { idempotencyKey },
  include: { screeningResult: true },  // ← Returns other user's screening data!
});
```

The `idempotencyKey` is a UUID (hard to guess), but if the client sends it as a predictable header or logs it, cross-user access becomes possible.

**Exploit Scenario:**
1. User B submits upload with `Idempotency-Key: abc-123`.
2. Attacker (User A) intercepts or guesses this key.
3. User A sends POST `/api/upload` with `Idempotency-Key: abc-123`.
4. User A receives User B's candidate ID, status, and potentially screening results.

**Fix:**
```typescript
const existingCandidate = await prisma.candidate.findFirst({
  where: {
    idempotencyKey,
    submittedById: session.user.id,  // ← Scope to current user
  },
  include: { screeningResult: true },
});
```

---

### 🔵 REG-04: Auto-Generated Idempotency Keys Provide No Protection

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 3.7 — AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N |
| **CWE** | CWE-362 (Race Condition) |
| **OWASP** | A04: Insecure Design |
| **File** | `src/app/api/upload/route.ts:19` |
| **Introduced By** | HIGH-02 idempotency fix |

**Description:**
When no `Idempotency-Key` header is provided, a unique key is auto-generated:

```typescript
const idempotencyKey = req.headers.get('idempotency-key') || `auto-${uuidv4()}`;
```

Since a new UUID is generated on every request, retries without an explicit `Idempotency-Key` header will never match the cached record. The idempotency protection is **only active when clients explicitly send the header**.

**Impact:** The majority of clients (standard browsers, basic API consumers) will not send an `Idempotency-Key` header and remain vulnerable to double-charging on retries.

**Recommended Fix:**
Two options:
1. **Document the requirement:** Make `Idempotency-Key` a required header for the upload endpoint and return `400` if missing.
2. **Content-based deduplication:** Use a hash of the uploaded file content + user ID as a fallback key when no header is provided:
```typescript
import { createHash } from 'crypto';
const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
const idempotencyKey = req.headers.get('idempotency-key')
  || `${session.user.id}-${fileHash}`;
```

---

## Part 3: New Findings (Not in Original Audit)

### 🟡 NEW-01: TOCTOU in rejectTopup Pre-Check

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **CVSS** | 4.3 — AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:L/A:N |
| **CWE** | CWE-367 (TOCTOU Race Condition) |
| **OWASP** | A04: Insecure Design |
| **File** | `src/lib/credits.ts:345-398` |
| **Status** | Pre-existing (existed before P1 fixes) |

**Description:**
The `rejectTopup()` function reads the topup status **outside** the `$transaction()` block for early-return checks (lines 353-373), then performs the conditional `updateMany` **inside** the transaction (lines 376-396). Between the pre-check read and the transactional write, the status could change.

```typescript
// Pre-check: reads outside transaction
const topup = await prisma.topupRequest.findUnique({
  where: { id: topupId },
  select: { id: true, status: true },
});

if (topup.status === 'approved') {
  throw new Error('Cannot reject approved topup request');  // ← Could be stale
}

// Later: conditional update inside transaction
const result = await prisma.$transaction(async (tx) => {
  const updateResult = await tx.topupRequest.updateMany({
    where: { id: topupId, status: 'pending' },  // ← Catches the real state
    data: { status: 'rejected', ... },
  });
  if (updateResult.count === 0) {
    throw new Error('Topup request is not pending');  // ← Error, not silent
  }
});
```

**Impact:** Under concurrent admin actions:
1. Admin A reads topup as `pending` → proceeds to reject
2. Admin B approves the same topup concurrently
3. Admin A's `updateMany` finds `status: 'approved'`, `count=0`, throws error
4. No data corruption — the `updateMany` WHERE clause prevents it
5. But the error message is confusing: "Topup request is not pending" instead of a clear conflict response

**Assessment:** This is a **low-impact TOCTOU** — it cannot cause data corruption because the `updateMany` WHERE clause acts as a guard. The worst case is an unnecessary error response. The pre-check is an optimization to avoid entering the transaction for clearly invalid states.

**Recommended Fix (optional):** Remove the pre-check entirely and let the transaction handle all logic:
```typescript
export async function rejectTopup(topupId: string, adminUserId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.topupRequest.findUnique({
      where: { id: topupId },
      select: { status: true },
    });
    if (!existing) throw new Error('Topup request not found');
    if (existing.status === 'approved') throw new Error('Cannot reject approved topup request');
    if (existing.status === 'rejected') return { success: true }; // idempotent

    const updateResult = await tx.topupRequest.updateMany({
      where: { id: topupId, status: 'pending' },
      data: { status: 'rejected', processedAt: new Date(), processedBy: adminUserId, notes: reason },
    });
    if (updateResult.count === 0) throw new Error('Topup request is not pending');
    return { success: true };
  });
}
```

---

### 🟡 NEW-02: approveTopup Pre-Check Information Leakage Pattern

| Field | Value |
|---|---|
| **Severity** | LOW |
| **CVSS** | 2.7 — AV:N/AC:L/PR:H/UI:N/S:U/C:L/I:N/A:N |
| **CWE** | CWE-367 (TOCTOU) |
| **OWASP** | A04: Insecure Design |
| **File** | `src/lib/credits.ts:237-276` |
| **Status** | Pre-existing |

**Description:**
The `approveTopup()` function reads the topup outside the transaction (line 237) and uses the stale status to determine which error to throw. Under concurrent admin approval attempts, the pre-check could return "already approved" (idempotent success) while the transaction would have found the status is `rejected`.

This is the same TOCTOU pattern as NEW-01 but with a different consequence: the function may return a misleading "success" response based on stale data, then the transaction would fail. In practice, the error is caught and returned as a 500.

**Impact:** Minimal. The `updateMany` guard in the transaction (line 280-302) prevents double approval. The worst case is a confusing error response sequence.

**Status:** Low risk. The idempotency handling for `approved` status (line 254) is correctly placed and the `updateMany` WHERE clause prevents double-approval.

---

## Part 4: Remaining Findings (Unchanged)

These findings from the original audit remain open and have not been addressed in this iteration:

| ID | Severity | Finding | Status |
|---|---|---|---|
| HIGH-03 | 🟢 RESOLVED | SQLite concurrent write limitations | Resolved — migrated to PostgreSQL |
| MEDIUM-02 | 🟡 MEDIUM | In-memory rate limiting not cluster-safe | Open — needs Redis |
| MEDIUM-03 | 🟡 MEDIUM | No CSRF protection | Open — needs middleware |
| MEDIUM-05 | 🟡 MEDIUM | No rate limiting on credit operations | Open |
| MEDIUM-06 | 🟡 MEDIUM | proofImageUrl SSRF / tracking risk | Partially mitigated* |
| LOW-05 | 🔵 LOW | No request body size limits | Open |
| INFO-01 | ⚪ INFO | Security headers only in production | Acceptable |
| INFO-02 | ⚪ INFO | Transitive dependency vulnerabilities | Monitoring |

*MEDIUM-06 update: The admin UI renders `proofImageUrl` as a clickable `<a>` link (not an `<img>` tag) with `rel="noopener noreferrer"`. This reduces tracking risk since the image is not auto-loaded, but the admin's browser still makes a request to the attacker-controlled URL on click, revealing IP/fingerprint.

---

## Part 5: Updated OWASP Top 10 Coverage

| Category | Original | After P1 Fixes | Delta |
|---|---|---|---|
| **A01: Broken Access Control** | ⚠️ HIGH-01 + MEDIUM-03 | ✅ HIGH-01 fixed, REG-03 (IDOR) new | Improved, 1 regression |
| **A02: Cryptographic Failures** | ✅ PASS | ✅ PASS | Unchanged |
| **A03: Injection** | ✅ PASS (fixes applied) | ✅ PASS | Unchanged |
| **A04: Insecure Design** | ⚠️ HIGH-02 + 3 MEDIUM | ⚠️ HIGH-02 partial, 2 regressions | Partially improved |
| **A05: Security Misconfiguration** | ✅ PASS | ✅ PASS | Unchanged |
| **A06: Vulnerable Components** | ✅ PASS | ✅ PASS | Unchanged |
| **A07: Authentication Failures** | ⚠️ MEDIUM-02 + MEDIUM-04 | ✅ MEDIUM-04 fixed | Improved |
| **A08: Software and Data Integrity** | ⚠️ HIGH-03 (SQLite) | ✅ HIGH-03 resolved via PostgreSQL | Improved |
| **A09: Logging and Monitoring** | ✅ PASS | ✅ PASS | Unchanged |
| **A10: SSRF** | ⚠️ MEDIUM-06 | ⚠️ MEDIUM-06 (mitigated) | Slightly improved |

---

## Part 6: Remediation Priority (Updated)

| Priority | Finding | Type | Effort | Action |
|---|---|---|---|---|
| **P0** | REG-01: Wrong quota limit (10→5) | Regression | S | Fix immediately |
| **P0** | REG-03: Unscoped idempotency (IDOR) | Regression | S | Fix immediately |
| **P1** | REG-02: Wrong credit source derivation | Regression | M | Next sprint |
| **P1** | REG-04: Auto-key provides no protection | Regression | M | Next sprint |
| **P1** | NEW-01: TOCTOU in rejectTopup | New | S | Next sprint |
| **P2** | HIGH-03: SQLite → PostgreSQL | Resolved | L | Completed |
| **P2** | MEDIUM-02: Redis-based rate limiting | Remaining | M | Pre-production |
| **P2** | MEDIUM-03: CSRF protection | Remaining | M | Pre-production |
| **P2** | MEDIUM-05: Rate limiting on credit ops | Remaining | M | Pre-production |
| **P3** | MEDIUM-06: proofImageUrl SSRF | Remaining | S | Backlog |
| **P3** | NEW-02: TOCTOU in approveTopup | New | S | Backlog |
| **P3** | LOW-05: Body size limits | Remaining | S | Backlog |

*S = Small (< 4h), M = Medium (1-3 days), L = Large (1+ week)*

---

## Part 7: Comparison Summary

| Metric | Original Audit | Re-Scan | Trend |
|---|---|---|---|
| Total findings | 17 | 17 | Same count, different composition |
| CRITICAL | 0 | 0 | — |
| HIGH | 3 | 2 | ↓ (HIGH-01 fixed, HIGH-02 partially fixed) |
| MEDIUM | 7 | 7 | → (MEDIUM-01,04,07 fixed; REG-02,03,NEW-01 added) |
| LOW | 5 | 6 | ↑ (4 original fixed; REG-04,NEW-02 added) |
| INFO | 2 | 2 | — |
| Fixes verified | — | 7/7 ✅ | All P1 fixes correct |
| Regressions | — | 4 | All in idempotency feature |
| New findings | — | 2 | TOCTOU patterns in topup functions |

---

## Conclusion

The P1 security fixes are **solid and correctly implemented**. The race condition in `deductCredit()` is eliminated, admin authorization is properly enforced from the database, and all input validation improvements are in place.

The primary concern is the **idempotency implementation**, which has 4 issues ranging from a simple hardcoded bug (REG-01) to an IDOR vulnerability (REG-03). REG-01 and REG-03 should be fixed immediately (P0) as they are small, targeted changes. REG-02 and REG-04 require design decisions and should be addressed in the next sprint.

**GO/NO-GO for Staging:** ✅ **GO** — System is safe for staging/QA with current fixes.

**GO/NO-GO for Production:** ⚠️ **CONDITIONAL** — Fix REG-01, REG-03 (P0) and MEDIUM-03 (CSRF) before production launch.

---

## Scans Not Performed (Out of Scope)

The following checks were **not performed** in this re-scan:

| Check | Reason | Recommended Tool |
|---|---|---|
| Dynamic testing of idempotency flow | Requires running application + concurrent test harness | OWASP ZAP, custom load test |
| Penetration testing | Requires authorized engagement | Manual pentest |
| Frontend XSS testing | React auto-escapes, separate scope | React security audit |
| Network-level security | Infrastructure scope | Cloud provider review |
| CI/CD pipeline security | No CI config in scope | GitHub Actions review |
| WebSocket/SSE security | Not used in credit system | N/A |
| Third-party service security (n8n) | External system | n8n security review |

