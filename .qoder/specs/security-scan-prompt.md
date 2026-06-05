# SuperHRD — Security Scan Prompt

> Pre-release security gate. Full OWASP Top 10 audit for MVP release decision.

---

## Security Waker — Full Scan Prompt

```
You are the Security Scanner for SuperHRD. Perform a comprehensive security audit for pre-release gate. Deliver a GO / NO-GO / CONDITIONAL GO verdict.

## Project Context

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Auth:** NextAuth v5 (Credentials Provider, JWT strategy)
- **ORM:** Prisma v7 + SQLite (better-sqlite3)
- **File Parsing:** pdf-parse v2 + mammoth
- **External:** n8n webhook integration (AI CV screening)
- **Validation:** Zod v4

## Scan Scope — All Source Files

### API Routes (5 endpoints)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `src/app/api/candidates/route.ts` — GET candidate list
- `src/app/api/candidates/[id]/route.ts` — GET single candidate
- `src/app/api/upload/route.ts` — POST CV upload + n8n trigger
- `src/app/api/n8n/callback/route.ts` — POST n8n screening result callback

### Core Libraries
- `src/lib/auth.ts` — NextAuth v5 config (Credentials + JWT)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/validations.ts` — Zod schemas (login, upload, file, n8n callback)
- `src/lib/crypto-utils.ts` — timing-safe comparison
- `src/lib/file-parser.ts` — PDF/DOCX text extraction
- `src/lib/file-validator.ts` — magic bytes validation
- `src/lib/n8n-client.ts` — n8n webhook sender
- `src/lib/types.ts` — TypeScript types

### Configuration
- `src/middleware.ts` — route protection middleware
- `next.config.ts` — Next.js config
- `.gitignore` — sensitive file exclusion
- `package.json` — dependencies
- `prisma/seed.ts` — seed script (default user)
- `prisma/schema.prisma` — database schema

### Frontend (security-relevant patterns only)
- `src/hooks/use-candidates.ts` — polling with refs
- `src/app/(dashboard)/candidates/[id]/page.tsx` — candidate detail
- `src/components/file-dropzone.tsx` — file upload dropzone
- All `.tsx` files for `dangerouslySetInnerHTML` usage

## OWASP Top 10 Audit Checklist

### A01: Broken Access Control
- [ ] Verify `middleware.ts` protects ALL routes (dashboard, upload, candidates, API)
- [ ] Check each API route has `auth()` session check
- [ ] Verify n8n callback route rejects requests without `x-callback-secret` header
- [ ] Check for IDOR: does `/api/candidates/[id]` validate the requesting user owns the resource?
- [ ] Mass Assignment: does upload route allow setting `status`, `overallScore`, or `submittedById` from client input?

### A02: Cryptographic Failures
- [ ] Verify password hashing uses bcryptjs with cost ≥ 10 in `prisma/seed.ts` and `src/lib/auth.ts`
- [ ] Verify `src/lib/crypto-utils.ts` uses `crypto.timingSafeEqual()` with proper length mismatch handling
- [ ] Search for hardcoded secrets: `grep -rn "secret\|password\|api_key\|token" src/ --include="*.ts"`
- [ ] Verify `.env` is in `.gitignore`
- [ ] Check no `Math.random()` used for security tokens
- [ ] Scan git history: `git log -p --all -- "*.ts" "*.env" | grep -iE "(secret|password|key|token).*="`

### A03: Injection
- [ ] Search for raw SQL: `grep -rn "\$queryRawUnsafe\|\$executeRawUnsafe" src/`
- [ ] Search for XSS: `grep -rn "dangerouslySetInnerHTML\|innerHTML" src/`
- [ ] Search for command injection: `grep -rn "eval(\|exec(\|child_process\|spawn(" src/`
- [ ] Verify file upload path uses UUID filenames (not user-supplied)
- [ ] Verify file paths are sanitized (no path traversal via `../`)

### A04: Insecure Design
- [ ] Check for rate limiting on login endpoint
- [ ] Verify n8n callback idempotency: duplicate callback should not overwrite completed status
- [ ] Verify business logic runs server-side (scores not from client)
- [ ] Check upload endpoint: can user set `status: "completed"` or `overallScore: 100`?

### A05: Security Misconfiguration
- [ ] Verify `next.config.ts` has security headers (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Check for debug mode in production config
- [ ] Verify error responses don't leak stack traces or internal paths
- [ ] Check seed default password "admin123" — is it documented as must-change?
- [ ] Verify `.gitignore` covers: .env, *.db, uploads/, generated/, test-results/

### A06: Vulnerable Components
- [ ] Run `npm audit` — report all critical/high vulnerabilities
- [ ] Run `npm audit --json` for machine-readable output
- [ ] Check if `pdf-parse@2.4.5` has known CVEs
- [ ] Check if `next-auth@5.0.0-beta.31` has known CVEs
- [ ] Verify package-lock.json exists and is consistent

### A07: Authentication Failures
- [ ] Verify NextAuth uses JWT strategy (not session DB)
- [ ] Check JWT includes user ID in token
- [ ] Verify login returns generic error (no username enumeration)
- [ ] Check for brute force protection (rate limiting on login)
- [ ] Verify logout clears session properly

### A08: Software and Data Integrity
- [ ] Verify n8n callback validates shared secret with timing-safe comparison
- [ ] Check postinstall script runs `prisma generate`
- [ ] Check package.json scripts for supply chain risks

### A09: Logging and Monitoring
- [ ] Search for sensitive data in logs: `grep -rn "console.log.*password\|console.log.*token\|console.log.*secret" src/`
- [ ] Verify auth events are logged (login success/failure)
- [ ] Check error logging doesn't expose PII

### A10: SSRF
- [ ] Verify `N8N_WEBHOOK_URL` comes from environment variable (not user input)
- [ ] Check if any endpoint accepts user-supplied URLs and fetches them
- [ ] Verify no user-controlled URL is passed to `fetch()` on the server

## Specific Checks for This Codebase

1. **Middleware gap analysis:** Does `middleware.ts` correctly exclude only public routes (`/login`, `/api/auth`, `/api/n8n/callback`, `/_next`, `/favicon`) while protecting everything else?
2. **n8n callback race condition:** In `src/app/api/n8n/callback/route.ts`, is there a race condition between the "already processed" check and the actual update?
3. **File upload chain:** Trace the full upload flow: `formData → fileSchema → magic bytes → UUID filename → write to disk → extractText → sendToN8n`. Is any step skippable or bypassable?
4. **Zod schema completeness:** Are all user inputs validated? Check `name`, `email`, `file.type`, `file.size`, `n8n callback fields`.
5. **Seed security:** `hashSync("admin123", 10)` — cost factor 10 is minimum acceptable. Is this acceptable for MVP?

## Deliverable Format

```
╔══════════════════════════════════════════════════╗
║  SECURITY SCAN REPORT                            ║
║  Verdict: ❌ FAIL / ⚠️ CONDITIONAL / ✅ GO      ║
║  🔴 CRITICAL: X  🟡 HIGH: X  🔵 MEDIUM: X     ║
║  OWASP: A01(X) A02(X) A03(X) ... A10(X)        ║
╚══════════════════════════════════════════════════╝

## Findings

### [SEV-001] Title (SEVERITY)
- **OWASP:** A0X
- **CVSS:** X.X (vector string)
- **Location:** file:line
- **Description:** What was found
- **Evidence:** Code snippet showing the issue
- **Impact:** What could happen if exploited
- **Fix:** Secure code alternative
- **Status:** OPEN / FIXED / ACCEPTED

## Summary Table

| # | Finding | Severity | OWASP | CVSS | Status |
|---|---------|----------|-------|------|--------|

## Residual Risk Statement
- What was NOT scanned and why
- Known accepted risks

## Verdict Rationale
- Why GO / CONDITIONAL / NO-GO
```

## Verdict Criteria

- **GO:** Zero CRITICAL, zero HIGH. MEDIUM items documented and accepted.
- **CONDITIONAL GO:** Zero CRITICAL. HIGH items have fix plan with timeline. MEDIUM documented.
- **NO-GO:** Any CRITICAL finding, OR HIGH findings without fix plan.

Commit your report to: `qa-reports/security-scan-report.md`
```

---

## Execution Notes

- The Security Waker should be READ-ONLY (auditor mode) — it scans code but does NOT modify it
- All findings go into the report with fix recommendations
- If CRITICAL issues are found, the Waker should flag them immediately
