# Security Issues — Status Update

**Last Updated:** 2026-06-12

## ✅ Resolved (P1 Fixes Applied)

- **Issue 1: Upload endpoint idempotency** - RESOLVED via `idempotencyKey` field and cached response
- **Architectural: JWT admin validation** - RESOLVED via real-time DB query on admin requests

## ✅ Resolved (Re-Scan Regression Fixes)

- **REG-01: Hardcoded quota limit** - RESOLVED: replaced `10` with `DAILY_QUOTA_LIMIT` constant
- **REG-02: Unreliable credit source** - RESOLVED: `creditSource` stored on Candidate model, read from DB in cache
- **REG-03: Unscoped idempotency (IDOR)** - RESOLVED: lookup scoped to `submittedById: session.user.id`

## 🔄 Remaining Open Issues

These issues remain open from the original audit (2026-06-11) and re-scan (2026-06-12).
They require architectural decisions and should be filed as GitHub issues.

---

## Issue 1: Migrate from SQLite to PostgreSQL for production

**Labels:** `security`, `infrastructure`, `high-priority`
**Priority:** P2 — Before production launch

### Description
SQLite's single-writer lock is insufficient for concurrent financial transactions.
Under production load, `SQLITE_BUSY` errors will cause transaction failures.
The `deductCredit()` function and `approveTopup()` both require concurrent write
safety with row-level locking.

### Acceptance Criteria
- [ ] Switch Prisma datasource to `postgresql`
- [ ] Update connection string and environment variables
- [ ] Add database migration scripts
- [ ] Verify all `$transaction()` calls work with PostgreSQL isolation levels
- [ ] Add `SELECT ... FOR UPDATE` for critical balance reads if needed
- [ ] Deploy and test with concurrent load

### Reference
- Security audit: `docs/SECURITY_AUDIT.md` — HIGH-03
- CWE-362, OWASP A08: Software and Data Integrity

---

## Issue 2: Implement distributed rate limiting for authentication

**Labels:** `security`, `authentication`, `medium-priority`
**Priority:** P2 — Before production launch

### Description
Login rate limiting uses an in-memory `Map` in `src/lib/auth.ts`. This does not
persist across server restarts and does not share state across multiple instances
(serverless/multi-region deployment). An attacker can bypass rate limits by
distributing requests across instances.

### Acceptance Criteria
- [ ] Replace in-memory `Map` with Redis-backed rate limiter
- [ ] Apply rate limiting per-email and per-IP
- [ ] Add rate limit headers to responses (`X-RateLimit-Remaining`)
- [ ] Add alerting when rate limits are triggered
- [ ] Consider: also rate-limit credit operations (upload, topup)

### Reference
- Security audit: `docs/SECURITY_AUDIT.md` — MEDIUM-02, MEDIUM-05
- CWE-770, OWASP A07: Authentication Failures

---

## Issue 3: Add CSRF protection to state-changing API endpoints

**Labels:** `security`, `csrf`, `medium-priority`
**Priority:** P2 — Before production launch

### Description
No CSRF token validation exists on POST endpoints. While NextAuth's `SameSite: Lax`
cookie provides partial protection, same-origin AJAX calls and subdomain takeover
scenarios are not mitigated.

### Affected Endpoints
- `POST /api/upload`
- `POST /api/topup/qris`
- `POST /api/admin/topup/[id]/approve`
- `POST /api/admin/topup/[id]/reject`

### Acceptance Criteria
- [ ] Implement origin validation middleware (check `Origin` header against `APP_URL`)
- [ ] Or implement double-submit cookie CSRF pattern
- [ ] Add CSRF tests for all state-changing endpoints
- [ ] Document CSRF policy in API docs

### Reference
- Security audit: `docs/SECURITY_AUDIT.md` — MEDIUM-03
- CWE-352, OWASP A01: Broken Access Control

---

## Issue 4: Sanitize proofImageUrl to prevent admin tracking/SSRF

**Labels:** `security`, `low-priority`
**Priority:** P3 — Backlog

### Description
The `proofImageUrl` field in topup requests accepts any URL. When admins view the
topup list, the admin's browser loads the image, potentially revealing the admin's
IP address and browser fingerprint to a malicious user who submitted a tracking URL.

**Partial mitigation:** Admin UI renders as `<a>` link (not `<img>`) with `rel="noopener noreferrer"`, but the admin's browser still requests the URL on click.

### Options
1. Proxy images through the application server (strip headers, cache)
2. Restrict to known CDN domains
3. Add `referrerPolicy="no-referrer"` and disable auto-loading (require click to view)

### Acceptance Criteria
- [ ] Choose and implement one of the mitigation options above
- [ ] Add URL domain allowlist if option 2 is chosen
- [ ] Update admin UI to safely render proof images

### Reference
- Security audit: `docs/SECURITY_AUDIT.md` — MEDIUM-06
- CWE-918, OWASP A10: SSRF

---

## Issue 5: Require explicit Idempotency-Key header for upload endpoint

**Labels:** `security`, `credit-system`, `medium-priority`
**Priority:** P1 — Next sprint

### Description
The upload endpoint auto-generates an idempotency key (`auto-${uuidv4()}`) when the
client doesn't send an `Idempotency-Key` header. This means retries without an
explicit header never match the cache and the user is double-charged.

### Options
1. **Require the header:** Return `400` if `Idempotency-Key` is missing, with docs
2. **Content-based fallback:** Use SHA-256 of file content + user ID as fallback key

### Acceptance Criteria
- [ ] Remove `auto-${uuidv4()}` fallback or replace with content hash
- [ ] Document `Idempotency-Key` requirement in API docs
- [ ] Add frontend integration to always send the header
- [ ] Add test: retry without header returns appropriate error or uses content hash

### Reference
- Security re-scan: `docs/SECURITY_RESCAN.md` — REG-04
- CWE-362, OWASP A04: Insecure Design
