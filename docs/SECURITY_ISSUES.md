# Security Issues — Ready to File

These issues were identified during the credit payment system security audit (2026-06-11).
Fixes for 7 findings have been committed. The following require architectural decisions
and should be filed as GitHub issues.

---

## Issue 1: Implement upload endpoint idempotency

**Labels:** `security`, `high-priority`, `credit-system`
**Priority:** P1 — Next sprint

### Description
The `POST /api/upload` endpoint lacks idempotency protection. If a client retries
after a network timeout (credit already deducted but response lost), the user is
double-charged.

### Acceptance Criteria
- [ ] Accept `Idempotency-Key` header (or generate client request ID)
- [ ] Store idempotency key with the transaction record
- [ ] Return cached response for duplicate requests within a time window (e.g., 24h)
- [ ] Document idempotency contract in API docs

### Reference
- Security audit: `docs/SECURITY_AUDIT.md` — HIGH-02
- CWE-362, OWASP A04: Insecure Design

---

## Issue 2: Migrate from SQLite to PostgreSQL for production

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

## Issue 3: Implement distributed rate limiting for authentication

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

## Issue 4: Add CSRF protection to state-changing API endpoints

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

## Issue 5: Validate JWT isAdmin claim against database on admin requests

**Labels:** `security`, `authorization`, `medium-priority`
**Priority:** P1 — Next sprint

### Description
The `isAdmin` flag is embedded in the JWT at login time and never refreshed.
If an admin revokes a user's admin status, the change does not take effect until
the JWT expires. This creates a window for unauthorized admin access.

### Acceptance Criteria
- [ ] Add database lookup for `isAdmin` in all admin route handlers
- [ ] Or add a middleware that validates `isAdmin` from DB on `/admin/*` and `/api/admin/*` routes
- [ ] Consider: shorter JWT expiration + refresh token rotation
- [ ] Add test: admin revocation takes effect immediately

### Reference
- Security audit: `docs/SECURITY_AUDIT.md` — MEDIUM-04
- CWE-285, OWASP A07: Authentication Failures

---

## Issue 6: Sanitize proofImageUrl to prevent admin tracking/SSRF

**Labels:** `security`, `low-priority`
**Priority:** P3 — Backlog

### Description
The `proofImageUrl` field in topup requests accepts any URL. When admins view the
topup list, the admin's browser loads the image, potentially revealing the admin's
IP address and browser fingerprint to a malicious user who submitted a tracking URL.

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
