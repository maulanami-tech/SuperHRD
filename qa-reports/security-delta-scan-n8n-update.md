# Security Delta Scan — n8n Multipart Update + CSP Fix

**Date:** 2026-06-06
**Scanner:** Hekel (Security Waker)
**Mode:** READ-ONLY (Auditor)
**Branch:** master
**Baseline:** Commit `8baa18c` (all 8 findings FIXED, verdict GO)
**Delta:** 3 commits + staged changes (439d025, 8e518b5, staged next.config.ts)

```
╔══════════════════════════════════════════════════════╗
║  SECURITY DELTA SCAN                                 ║
║  Scope: n8n multipart rewrite + CSP relaxation       ║
║  Verdict: ⚠️ CONDITIONAL GO                          ║
╠══════════════════════════════════════════════════════╣
║  New: 🔴 0  🟠 0  🔵 1 MEDIUM  🔷 1 LOW            ║
║  Regressions: 0   Dead code: 0   Secret leaks: 0    ║
║  Regression Controls: 8/8 INTACT                     ║
╚══════════════════════════════════════════════════════╝
```

---

## Change Summary

| Commit | Description | Files | Risk Level |
|---|---|---|---|
| `439d025` | n8n integration → multipart/form-data PDF + posisi/kriteria/prompt | 13 | HIGH (new attack surface) |
| `8e518b5` | Bug fixes: Zod messages, remove @types/pdf-parse, login server action | 5 | MEDIUM |
| staged | CSP: added `'unsafe-inline'` to `script-src` | 1 | MEDIUM (CSP relaxation) |
| unstaged | e2e spec updates | — | LOW (not security-relevant) |

---

## New Findings

---

### SEV-NEW-001: Missing Max Length on Upload Schema Fields (MEDIUM)

| Field | Value |
|---|---|
| **OWASP** | A04: Insecure Design |
| **CVSS** | 5.3 — `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L` |
| **Location** | `src/lib/validations.ts:8-14` |
| **Introduced by** | Commit `439d025` |
| **Status** | OPEN |

**Description:**
The `uploadSchema` was extended with three new required fields (`posisi`, `kriteria`, `prompt`) but only `.min(1)` is enforced — no `.max()` limits exist on any of the five string fields. An authenticated user can submit arbitrarily long strings (megabytes of text) that will be:
1. Stored in SQLite (unbounded row growth)
2. Sent to n8n as multipart form fields (large payload to external service)
3. Returned in API responses to all clients polling the candidate list

**Evidence:**
```typescript
// validations.ts:8-14
export const uploadSchema = z.object({
  name: z.string().min(1, "Candidate name is required"),      // ← No .max()
  email: z.email().optional(),
  posisi: z.string().min(1, "Position is required"),          // ← No .max()
  kriteria: z.string().min(1, "Evaluation criteria is required"), // ← No .max()
  prompt: z.string().min(1, "Prompt is required"),            // ← No .max()
});
```

**Impact:**
- **Storage DoS:** SQLite rows with multi-MB text fields degrade query performance
- **n8n payload inflation:** Entire kriteria/prompt text sent to external webhook — could hit n8n payload limits or cost
- **Response inflation:** Candidate list API returns posisi/kriteria/prompt in every candidate object; 100 candidates with 1MB kriteria = 100MB response
- **Pre-existing:** `name` also lacks `.max()` — but this is a pre-existing pattern, not introduced by this delta

**Fix:**
```typescript
export const uploadSchema = z.object({
  name: z.string().min(1, "Candidate name is required").max(200),
  email: z.email().optional(),
  posisi: z.string().min(1, "Position is required").max(200),
  kriteria: z.string().min(1, "Evaluation criteria is required").max(5000),
  prompt: z.string().min(1, "Prompt is required").max(5000),
});
```

**Mitigating factor:** Requires authentication (middleware blocks unauthenticated access). Single-role app (HR staff), reducing adversarial motivation.

---

### SEV-NEW-002: CSP script-src Relaxed to 'unsafe-inline' (LOW)

| Field | Value |
|---|---|
| **OWASP** | A05: Security Misconfiguration |
| **CVSS** | 3.7 — `AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N` |
| **Location** | `next.config.ts:11` |
| **Introduced by** | Staged change (next.config.ts) |
| **Status** | OPEN |

**Description:**
The Content-Security-Policy `script-src` directive was changed from `'self'` to `'self' 'unsafe-inline'`. This allows any inline `<script>` on the page to execute, weakening the defense-in-depth against XSS attacks.

**Evidence:**
```typescript
// next.config.ts:11 — before:
value: "default-src 'self'; script-src 'self'; ..."
// next.config.ts:11 — after:
value: "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
```

**Impact:**
- If any XSS sink exists (or is introduced in the future), `'unsafe-inline'` removes the CSP safety net
- An attacker who can inject HTML (e.g., via a future `dangerouslySetInnerHTML`) could execute arbitrary scripts
- All existing user-generated content is rendered via React JSX (auto-escaped), so no current XSS sink exists

**Likely cause:** Next.js 16 server actions inject inline `<script>` tags for action bootstrapping. Without `'unsafe-inline'`, the browser console shows CSP violations and server actions may fail.

**Mitigating factors:**
- Zero `dangerouslySetInnerHTML` in the entire codebase (confirmed via grep)
- All user data rendered through React JSX auto-escaping
- All other CSP directives remain intact: `default-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `font-src 'self'`
- `unsafe-eval` is NOT present (no eval-based XSS vector)

**Recommended fix (when Next.js supports it):**
Replace `'unsafe-inline'` with nonce-based CSP:
```typescript
// Future: when Next.js supports per-request CSP nonces
value: "default-src 'self'; script-src 'self' 'nonce-{RANDOM}'; ..."
```

Until Next.js provides nonce support, `'unsafe-inline'` is an accepted trade-off for server action functionality.

---

## New Attack Surface Analysis

### n8n-client.ts — Multipart Rewrite ✅ SAFE

| Check | Result |
|---|---|
| Internal data leakage in multipart body | ✅ No session tokens, user IDs, or secrets sent to n8n |
| callbackUrl removed from payload | ✅ No longer exposes internal callback endpoint |
| fileName header injection | ✅ WHATWG FormData properly escapes Content-Disposition filename |
| Webhook URL from env (not user input) | ✅ `process.env.N8N_WEBHOOK_URL` — SSRF not possible |
| Error messages safe | ✅ Only status code + statusText exposed, no response body |
| No Content-Type override | ✅ Fetch auto-sets multipart boundary (correct pattern) |

**One observation (non-blocking):** `N8N_WEBHOOK_URL` is not validated for `https://` scheme. If misconfigured as `http://`, the PDF and form data would be sent in plaintext. This is a configuration concern, not a code vulnerability.

### Server Action — loginUser ✅ SAFE

| Check | Result |
|---|---|
| Generic error message | ✅ "Invalid credentials" for all AuthError types |
| No username enumeration | ✅ Same response for unknown email and wrong password |
| Rate limiting enforced | ✅ Rate limit runs inside `authorize()` in `auth.ts` |
| Password not logged | ✅ No logging in `actions.ts`; `auth.ts` logs email only |
| CSRF protection | ✅ Next.js server actions have built-in CSRF via origin check |
| Unexpected error handling | ✅ Non-AuthError re-thrown → login page catches with generic toast |

### Login Page — Server Action Migration ✅ SAFE

| Check | Result |
|---|---|
| Error message consistency | ✅ "Invalid email or password" for auth errors, "Something went wrong" for unexpected |
| Password input type | ✅ `type="password"`, `autoComplete="current-password"` |
| Client-side validation | ✅ Zod schema via react-hook-form before server call |

### File Pipeline — PDF-Only ✅ SAFE

| Check | Result |
|---|---|
| file-validator.ts | ✅ PDF-only magic bytes `[0x25, 0x50, 0x44, 0x46]`, all others rejected |
| fileSchema | ✅ Only `application/pdf` accepted |
| file-dropzone.tsx | ✅ Client-side `accept` restricted to PDF |
| file-parser.ts removal | ✅ No residual imports (grep confirmed clean) |
| mammoth/pdf-parse deps | ✅ Removed from package.json |

### Upload Route — New Fields ✅ SAFE (with SEV-NEW-001 caveat)

| Check | Result |
|---|---|
| Zod validation on all fields | ✅ posisi/kriteria/prompt validated via uploadSchema |
| Validated data used for DB insert | ✅ `candidateValidation.data.*` (not raw formData) |
| Mass assignment prevention | ✅ All server-controlled values (status, submittedById, n8nRunId) |
| File buffer passed safely | ✅ `Buffer.from(arrayBuffer)` → no path traversal |
| Original fileName to n8n | ✅ WHATWG FormData escapes multipart headers |

---

## Regression Check — Previously Fixed Controls

| ID | Control | Status | Evidence |
|---|---|---|---|
| SEV-001 | IDOR ownership filter | ✅ **INTACT** | `[id]/route.ts:19` — `submittedById: session.user.id` in findUnique; `candidates/route.ts:17` — same in findMany |
| SEV-002 | Security headers (6 total) | ✅ **INTACT** | `next.config.ts:4-12` — X-Frame-Options DENY, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP all present |
| SEV-003 | Rate limiting (5/15min) | ✅ **INTACT** | `auth.ts:6-8` — Map + MAX_ATTEMPTS=5 + LOCK_DURATION=15min; check at line 48 before bcrypt |
| SEV-004 | TOCTOU transaction | ✅ **INTACT** | `callback/route.ts:27` — `prisma.$transaction(async (tx) => { ... })` wraps read-check-write |
| SEV-005 | npm audit (0 high/critical) | ✅ **INTACT** | `npm audit`: 0 critical, 0 high, 6 moderate (unchanged from baseline) |
| SEV-006 | Seed randomBytes + env | ✅ **INTACT** | `seed.ts:11` — `process.env.SEED_ADMIN_PASSWORD ?? randomBytes(16).toString("hex")` |
| SEV-007 | Score bounds min/max | ✅ **INTACT** | `validations.ts:26` — `overallScore: z.number().min(0).max(100)`; criteria scores same |
| SEV-008 | Auth logging [AUTH] prefix | ✅ **INTACT** | `auth.ts:49,59,66,72` — console.warn/info with `[AUTH]` prefix, email only, no passwords |

**Result: 8/8 controls intact. Zero regressions.**

---

## Dependency Audit

```
npm audit results:
  Critical: 0
  High:     0
  Moderate: 6 (unchanged from baseline)
  Low:      0
```

No new vulnerabilities introduced. All 6 moderates remain the same build-time/dev-only dependencies assessed as non-exploitable in production (PostCSS, @hono/node-server).

---

## Secret Scan

```
grep -rn "password|secret|token|api_key|apikey" src/ --include="*.ts" --include="*.tsx" -i
```

**Result: Clean.** All matches are known-safe patterns:
- `password` in auth.ts — credential field names, never values logged
- `secret` in callback/route.ts — env var reference (`process.env.N8N_CALLBACK_SECRET`)
- `token` in middleware.ts — cookie name references (`authjs.session-token`)
- `token` in auth.ts — JWT callback parameter names

No hardcoded secret values found.

---

## Dead Code Check

```
grep -rn "file-parser" src/
```

**Result: Clean.** No residual imports of the deleted `file-parser.ts`. The `pdf-parse` and `mammoth` dependencies have been removed from `package.json`.

---

## Summary Table

| # | Finding | Severity | OWASP | CVSS | Introduced By | Status |
|---|---|---|---|---|---|---|
| SEV-NEW-001 | Missing max length on upload schema fields | 🔵 MEDIUM | A04 | 5.3 | `439d025` | OPEN |
| SEV-NEW-002 | CSP script-src 'unsafe-inline' relaxation | 🔷 LOW | A05 | 3.7 | staged | OPEN |

---

## Fix Priority

| Priority | Finding | Effort | Risk if Deferred |
|---|---|---|---|
| 1 | SEV-NEW-001: Add `.max()` to upload schema | 5 min | Storage/response DoS by authenticated users |
| 2 | SEV-NEW-002: Monitor Next.js nonce support | Ongoing | Theoretical XSS if future code introduces unsafe HTML rendering |

---

## Verdict Rationale

### ⚠️ CONDITIONAL GO

**Justification:**
- Zero regressions — all 8 previously fixed controls remain intact
- Zero CRITICAL or HIGH findings introduced
- 1 MEDIUM finding (SEV-NEW-001) is a 5-minute fix with clear remediation
- 1 LOW finding (SEV-NEW-002) is a framework-driven trade-off with low exploitability
- n8n multipart rewrite is clean — no data leakage, no injection vectors
- Server action login migration preserves all security properties (rate limiting, generic errors, CSRF)
- PDF-only file pipeline is properly hardened end-to-end
- Dependency audit unchanged (0 critical, 0 high)
- Secret scan clean, dead code scan clean

**Condition for full GO:**
1. Add `.max()` limits to `uploadSchema` fields (SEV-NEW-001) before merging

---

*Delta scan report generated by Hekel — Security Scanning Expert*
*Method: Static code review of delta changes + regression verification of all prior controls*
*Baseline: commit 8baa18c (GO verdict, all findings FIXED)*
