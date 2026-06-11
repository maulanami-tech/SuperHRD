<!--
Sync Impact Report
Version change: 1.0.0 → 2.0.0 (MAJOR - security & QA overhaul)
Modified principles:
  - IV. Security by Default → expanded with OWASP-aligned controls
Added sections:
  - VII. Defense in Depth
  - VIII. Audit & Observability
  - Security Controls (OWASP-aligned matrix)
  - QA Strategy (test pyramid + acceptance criteria)
  - Incident Response
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ compatible
  - .specify/templates/spec-template.md ✅ compatible
  - .specify/templates/tasks-template.md ✅ compatible
Follow-up TODOs: None
-->

# SuperHRD Constitution

## Core Principles

### I. App Router First

Every feature MUST use Next.js App Router conventions. API routes live under
`src/app/api/`. Pages use server components by default; client components
only when interactivity requires it. No Pages Router patterns
(getServerSideProps, getStaticProps).

**Rationale**: App Router provides streaming, nested layouts, and server
actions — critical for the dashboard UX and n8n callback handling.

### II. Type Safety

All code MUST be TypeScript with strict mode. Zod schemas validate ALL
external inputs (API requests, file uploads, form data, n8n callbacks).
Prisma types flow through to components — no `any` types, no manual type
assertions unless documented with `// SAFETY:` comment.

**Rationale**: Credit system and payment flows are financial operations.
Type errors can cause balance corruption.

### III. Atomic Operations

All database mutations that affect balance, quota, or payment status MUST
use Prisma transactions or conditional `updateMany` with WHERE clauses.
Operations MUST be idempotent — retrying an approval or deduction MUST NOT
create duplicates or corrupt state.

**Rationale**: Race conditions in credit deduction can leak free screenings
or lose payments. The QRIS approval flow requires idempotency for admin
retries.

### IV. Security by Default

All security controls below are NON-NEGOTIABLE. Violations block merge.

#### Authentication & Session

- NextAuth.js v5 with JWT sessions; session token in httpOnly cookie
- Rate limiting on login: 5 attempts per email, 15-minute lockout
- Passwords hashed with bcrypt (cost factor ≥ 10)
- Session invalidation on password change (if password change is added)
- No "remember me" longer than 7 days

#### Authorization

- Every API route MUST verify `session.user.id` server-side
- Admin routes MUST verify `session.user.isAdmin` server-side
- Users MUST NOT access other users' data (candidates, credits, topups)
- n8n callback MUST validate shared secret via timing-safe comparison

#### Input Validation & Sanitization

- ALL API inputs validated with Zod before processing
- File uploads: validate MIME type, magic bytes, and size (≤ 10MB)
- File names sanitized — UUID-based storage, original name preserved in DB only
- Reject path traversal patterns in any user-supplied string (`../`, `..\\`)

#### Output & Error Handling

- API errors return generic messages to client; log details server-side
- Never expose stack traces, SQL errors, or internal paths in responses
- Use HTTP status codes correctly: 401 (unauth), 403 (forbidden), 402 (payment), 409 (conflict), 422 (validation), 500 (server)

#### Transport & Headers

- HTTPS enforced in production (Next.js `secure` cookie flag)
- Set `X-Content-Type-Options: nosniff` on all responses
- Set `X-Frame-Options: DENY` or `SAMEORIGIN`
- Set `Strict-Transport-Security` in production
- Content Security Policy: restrict script/style sources

#### Secrets Management

- No secrets in client-side code, git history, or error logs
- Environment variables documented in `.env.example` with placeholder values
- Secrets rotated if accidentally committed (invalidate old, generate new)

**Rationale**: HR data (CVs, candidate info) is sensitive. Payment operations
require audit trails. A single XSS or IDOR could expose all candidate PII.

### V. Indonesian-First UX

All user-facing text MUST be in Bahasa Indonesia. Date displays use WIB
timezone (Asia/Jakarta). Currency formatting uses `toLocaleString('id-ID')`.
Error messages are user-friendly Indonesian text, not raw technical errors.

**Rationale**: Target users are Indonesian HR teams. WIB is the business
timezone for quota resets and reporting.

### VI. Offline-Capable Database

SQLite via better-sqlite3 is the production database. No features that
require PostgreSQL/MySQL-specific syntax (JSON operators, array types, CTEs).
Schema changes MUST be backward-compatible migrations that SQLite supports.

**Rationale**: Single-server deployment, zero external dependencies, easy
backup (copy file). Trade-off: no concurrent writes, no JSON queries —
acceptable for internal HR tool.

### VII. Defense in Depth

Every layer MUST assume the layers above it can fail.

- **Client-side validation** is UX convenience, NOT security
- **Server-side Zod validation** is the actual security gate
- **Database constraints** (unique, foreign key, check) are the final safety net
- **Rate limiting** applies to all state-changing API routes, not just login
- **Idempotency keys** for payment operations prevent double-charge on retry

**Rationale**: A user can bypass client JS. A misconfigured API route can
skip Zod. Defense in depth ensures no single point of failure.

### VIII. Audit & Observability

Every state-changing operation MUST produce an audit trail.

- **Transaction model** records all credit movements with `creditDelta`,
  `balanceAfter`, and `metadata` JSON for forensics
- **Structured logging**: use `console.info/warn/error` with context
  (`[AUTH]`, `[CREDIT]`, `[UPLOAD]`, `[N8N]`) — no bare `console.log`
- **Error context**: log `userId`, `candidateId`, `topupId` on failures
- **No PII in logs**: email OK for auth logs, but NEVER log passwords,
  CV content, or payment proof URLs

**Rationale**: When money or data is involved, "what happened?" must be
answerable from logs alone. Compliance audits require traceability.

## Security Controls Matrix

| Control | Where | Enforcement |
| ------- | ------- | ------------- |
| Auth check | Every API route | `auth()` → 401 if null |
| Admin check | `/api/admin/*` | `session.user.isAdmin` → 403 |
| Owner check | `/api/candidates/*`, `/api/credit/*` | `where: { submittedById: userId }` |
| Rate limit | Login | `loginAttempts` Map in `auth.ts` |
| Rate limit | Upload | Per-user credit/quota system |
| Timing-safe compare | n8n callback | `crypto.timingSafeEqual` |
| Magic bytes | File upload | `validateFileMagicBytes()` |
| Zod validation | All inputs | `schema.safeParse()` |
| SQL injection | All queries | Prisma parameterized queries |
| XSS | All output | React auto-escaping + CSP headers |
| CSRF | State mutations | NextAuth CSRF token + SameSite cookie |
| Path traversal | File storage | UUID filenames, no user-supplied paths |

## QA Strategy

### Test Pyramid

```text
         ┌─────────┐
         │  E2E    │  ← 5-10 critical user journeys (Playwright)
         │ (slow)  │     Auth, upload→screening, topup→approval
         ├─────────┤
         │Integration│  ← API route tests (Playwright API)
         │ (medium) │     Auth guards, validation, credit flow
         ├─────────┤
         │  Unit   │  ← Business logic (future: Vitest/Jest)
         │ (fast)  │     credits.ts, candidate-status.ts, validators
         └─────────┘
```

### Mandatory Test Coverage

Before merge, the following MUST have passing tests:

| Area | Test Type | Files |
| ---- | --------- | ----- |
| Auth flow | E2E | `e2e/auth.spec.ts` |
| API auth guards | E2E | `e2e/api-routes.spec.ts` |
| Upload → screening | E2E | `e2e/upload.spec.ts` |
| Dashboard ops | E2E | `e2e/dashboard.spec.ts` |
| Credit deduction | Manual + E2E | Checklist in `docs/TESTING.md` |
| Admin approval | Manual + E2E | Checklist in `docs/TESTING.md` |
| n8n callback | API test | `e2e/api-routes.spec.ts` |

### Test Quality Rules

- Tests MUST assert specific values, not just "no error"
- E2E tests MUST test the happy path AND at least one failure path
- API tests MUST verify correct HTTP status codes
- Credit-related tests MUST verify balance changes are atomic
- Tests MUST NOT depend on execution order
- Tests MUST NOT leave stale data (use unique IDs, cleanup)

### Regression Checklist

Before production deploy, manually verify:

- [ ] Login with wrong password shows error (not stack trace)
- [ ] Upload with wrong file type rejects cleanly
- [ ] Credit deduction with zero balance returns 402
- [ ] Admin approve on already-approved topup is idempotent
- [ ] n8n callback with wrong secret returns 401
- [ ] n8n callback with duplicate runId returns success (idempotent)
- [ ] Quota resets correctly at midnight WIB
- [ ] Transaction history shows all credit movements

### Performance Benchmarks

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| Login response | < 500ms | Server-side |
| Upload + parse | < 5s | Including PDF text extraction |
| Dashboard load | < 2s | Initial page load |
| Credit API | < 200ms | `GET /api/credit/balance` |
| n8n callback | < 1s | Transaction + DB write |

## Development Workflow

1. **Feature Branch**: Create branch from `master` with descriptive name
2. **Spec First**: Use `/speckit-specify` before coding non-trivial features
3. **Plan Review**: Use `/speckit-plan` to break spec into implementation tasks
4. **Implement**: Follow tasks.md, commit after each logical unit
5. **Test**: Manual verification + e2e tests for critical paths
6. **Merge**: PR to `master` after review

### Commit Convention

```text
type(scope): description

feat(credit): add Stripe payment integration
fix(auth): prevent rate limit bypass on email case mismatch
docs(readme): update setup instructions
refactor(api): extract credit logic to lib/credits.ts
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Quality Gates

### Before Merge

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Manual test of affected user flows
- [ ] No `any` types introduced without `// SAFETY:` comment
- [ ] Database migrations are reversible
- [ ] API routes return proper error responses (not raw stack traces)
- [ ] New API routes have auth guard (`auth()` check)
- [ ] New API routes have Zod validation on inputs
- [ ] No secrets in new code (no hardcoded keys, tokens, passwords)
- [ ] Error messages are Indonesian and user-friendly

### Before Production Deploy

- [ ] All quality gates above pass
- [ ] Environment variables documented in `.env.example`
- [ ] Seed script creates default admin user
- [ ] Credit system edge cases verified (zero balance, quota reset, concurrent deductions)
- [ ] E2E tests pass (`npx playwright test`)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] Audit log coverage verified for all state-changing routes
- [ ] Database backup strategy documented

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
| ----- | ----------- | ------------- | ------- |
| P0 | Data loss, payment corruption | Immediate | Credit balance mismatch |
| P1 | Service down, auth broken | < 1 hour | Login fails for all users |
| P2 | Feature broken, workaround exists | < 4 hours | Topup page blank |
| P3 | Minor issue, cosmetic | Next sprint | Wrong date format |

### Credit System Incidents

If credit balance inconsistency is detected:

1. STOP all topup approvals immediately
2. Query `Transaction` table for audit trail
3. Compare `SUM(creditDelta)` against `User.creditBalance`
4. If mismatch: manually reconcile with `admin_adjustment` transaction
5. Document root cause and prevention in incident report

## Governance

This constitution supersedes ad-hoc coding decisions. Amendments require:

1. Document the proposed change with rationale
2. Update this file with version bump (MAJOR/MINOR/PATCH)
3. Propagate changes to templates if principles affect spec/plan/tasks structure
4. Commit with message: `docs: amend constitution to vX.Y.Z (reason)`

Compliance is verified during code review. Violations MUST be justified in
plan.md's "Complexity Tracking" section.

**Version**: 2.0.0 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-11
