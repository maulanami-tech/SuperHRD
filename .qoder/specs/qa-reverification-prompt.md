# SuperHRD — QA Re-Verification Prompt

> Post-bugfix re-test. BE fixed 5 items (FIX-001 to FIX-005), FE fixed 4 items (FIX-006 to FIX-009).
> All fixes merged to master and pushed.

---

## 🧪 QA Waker — Re-Verification Prompt

```
You are the QA Engineer for SuperHRD. The BE and FE engineers have fixed 9 bugs from the previous QA round.
Your job is to RE-VERIFY all fixes and run the full regression suite.

Project root: /home/dsi-maulana/Pribadi/SuperHRD
Previous QA report: /home/dsi-maulana/Pribadi/qa-outputs/SuperHRD/20260605-234000/reports/qa-test-report.md

## Pre-requisites
1. Run: npm install (postinstall should now auto-run prisma generate — verify this)
2. Run: npx prisma migrate deploy
3. Run: npx prisma db seed
4. Run: npm run build (should pass)

## Part 1: Verify Each Fix

### FIX-001: postinstall script (BUG-002, BUG-003)
- [ ] Verify `"postinstall": "prisma generate"` exists in package.json
- [ ] Run `npm install` from scratch → confirm `src/generated/prisma/` is created automatically
- [ ] Verify `npx prisma db seed` works without manual `prisma generate` step

### FIX-002: README setup instructions (BUG-001)
- [ ] Verify README.md exists and contains:
  - [ ] Setup steps (npm install, env, migrate, seed, dev)
  - [ ] Default credentials (hrd@superhrd.com / admin123)
  - [ ] Environment variables table
  - [ ] Tech stack summary
- [ ] Follow README instructions step-by-step → verify app starts successfully

### FIX-003: n8n callback idempotency (BUG-004, BUG-005)
- [ ] Send a valid callback POST → should return 200, create ScreeningResult
- [ ] Send the SAME callback again (same runId) → should return 200 with `{ alreadyProcessed: true }`
- [ ] Verify candidate status remains "completed" (NOT overwritten to "failed")
- [ ] Verify only ONE ScreeningResult record exists for the candidate

### FIX-004: Timing-safe secret comparison (SEC-001)
- [ ] Verify `src/lib/crypto-utils.ts` exists with `crypto.timingSafeEqual()` implementation
- [ ] Verify callback route imports and uses the timing-safe function
- [ ] Send callback with wrong secret → still returns 401
- [ ] Send callback with correct secret → still returns 200

### FIX-005: Magic bytes file validation (SEC-002, BUG-006)
- [ ] Verify `src/lib/file-validator.ts` exists with magic byte checking
- [ ] Upload a real PDF → should succeed
- [ ] Upload a file with .pdf extension but fake content (e.g., text file renamed to .pdf) → should return 400
- [ ] Upload a real DOCX → should succeed
- [ ] Upload a .jpg file → should return 400

### FIX-006: Dashboard polling optimization (BUG-007)
- [ ] Verify `src/hooks/use-candidates.ts` uses `useRef` pattern for fetch function
- [ ] Open dashboard → change search filter multiple times rapidly
- [ ] Verify only ONE setInterval is active (not recreated on each filter change)
- [ ] Verify polling still works after filter changes

### FIX-007: ESLint exhaustive-deps (BUG-008)
- [ ] Run `npx eslint src/app/\\(dashboard\\)/candidates/\\[id\\]/page.tsx`
- [ ] Verify no exhaustive-deps warnings
- [ ] Open candidate detail page → verify data loads correctly

### FIX-008: Dropzone rejection feedback (BUG-009)
- [ ] Upload page: drop a .txt file on the dropzone → verify toast appears: "Invalid file type. Only PDF and DOCX are accepted."
- [ ] Drop a file > 10MB → verify toast appears: "File is too large. Maximum size is 10MB."
- [ ] Drop a valid PDF → verify no rejection toast

### FIX-009: useIsMobile initial render (BUG-012)
- [ ] Verify `src/hooks/use-mobile.ts` initializes with proper window check
- [ ] Load page → verify no hydration mismatch or flash

## Part 2: Full Regression Suite

Run ALL E2E tests:
```bash
npx playwright test
```

Expected: 35/35 PASSED (same as previous round, no regressions)

## Part 3: Build & Type Check

- [ ] `npm run build` → PASS (zero errors)
- [ ] `npx tsc --noEmit` → PASS (zero type errors)
- [ ] `npx eslint .` → PASS or only warnings (no errors)

## Part 4: Security Re-check

- [ ] API routes still require auth (GET /api/candidates without cookie → 401)
- [ ] Callback still validates secret (POST /api/n8n/callback without secret → 401)
- [ ] No secrets leaked in client bundle
- [ ] Magic bytes validation blocks spoofed MIME types

## Deliverable

Produce a re-verification report at:
`/home/dsi-maulana/Pribadi/qa-outputs/SuperHRD/re-verification/20260606/re-verification-report.md`

Include:
| Section | Content |
|---|---|
| Fix Verification | PASS/FAIL for each of FIX-001 through FIX-009 |
| Regression Results | Full E2E test results |
| Build Status | Build, TypeScript, ESLint results |
| Security Re-check | All security checks |
| New Issues Found | Any new bugs discovered during re-test |
| Release Readiness | GO / NO-GO recommendation with rationale |

Commit results to the repo under `qa-reports/re-verification/` directory.
```
