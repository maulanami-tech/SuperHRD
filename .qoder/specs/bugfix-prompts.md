# SuperHRD — Bug Fix Prompts (Post-QA)

> Based on QA Report: 35/35 E2E tests passed, 14 bugs found (3 CRITICAL, 2 HIGH, 4 MEDIUM, 5 LOW)
> Priority: Must-fix + Should-fix items only

---

## 🔧 BE Waker — Bug Fix Prompt

```
You are the Backend Engineer for SuperHRD. The QA team found 14 bugs. Fix the following MUST-FIX and SHOULD-FIX items:

## MUST FIX (Critical + High)

### FIX-001: Add postinstall script (BUG-002, BUG-003)
- Add `"postinstall": "prisma generate"` to package.json scripts
- This ensures `npx prisma generate` runs automatically after `npm install`

### FIX-002: Add README with setup instructions (BUG-001, BUG-002, BUG-003)
- Create README.md with complete setup steps:
  ```
  1. npm install
  2. Copy .env.example to .env
  3. npx prisma migrate deploy
  4. npx prisma db seed
  5. npm run dev
  ```
- Include: default credentials (hrd@superhrd.com / admin123), env var descriptions, tech stack summary

### FIX-003: Fix n8n callback idempotency (BUG-004, BUG-005)
Location: `src/app/api/n8n/callback/route.ts`
- Before creating ScreeningResult, check if candidate already has status "completed"
- If already completed, return `{ success: true, alreadyProcessed: true }` without error
- If ScreeningResult already exists for the candidateId, skip creation
- Only set status to "failed" for actual processing errors, NOT for duplicate callbacks
- Current bug: catch block sets `candidate.status = "failed"` even on duplicate callback unique constraint violations

### FIX-004: Use timing-safe comparison for callback secret (SEC-001)
Location: `src/app/api/n8n/callback/route.ts`
- Replace `===` comparison with `crypto.timingSafeEqual()`
- Import `crypto` from Node.js
- Convert both strings to Buffer before comparison
- Handle length mismatch gracefully

## SHOULD FIX (Medium)

### FIX-005: Add server-side file type validation via magic bytes (SEC-002, BUG-006)
Location: `src/app/api/upload/route.ts` and/or `src/lib/file-parser.ts`
- After receiving the file, read first bytes to validate actual file type:
  - PDF: starts with `%PDF` (bytes: 25 50 44 46)
  - DOCX: starts with ZIP signature `PK` (bytes: 50 4B 03 04)
- Reject files where magic bytes don't match expected type
- Return clear error message for invalid files

## Verification
After all fixes:
- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx prisma generate` runs on `npm install` (postinstall)
- [ ] Duplicate n8n callback returns success (not error)
- [ ] Wrong file type upload returns clear error
- [ ] All existing E2E tests still pass (`npx playwright test`)

Commit your changes with message: `fix: address QA bugs - idempotency, security, setup docs`
```

---

## 🎨 FE Waker — Bug Fix Prompt

```
You are the Frontend Engineer for SuperHRD. The QA team found some UI bugs. Fix the following:

## SHOULD FIX (Medium)

### FIX-006: Fix dashboard polling redundant requests (BUG-007)
Location: `src/hooks/use-candidates.ts`
- Problem: `fetchCandidates` is in polling effect dependency array. Every filter change clears and recreates the polling interval.
- Fix: Use `useRef` to store the latest `fetchCandidates` function reference
- The polling interval should only be set up once (empty deps) and call `fetchRef.current()`
- This prevents interval reset on every filter change

### FIX-007: Fix ESLint exhaustive-deps in candidate detail page (BUG-008)
Location: `src/app/(dashboard)/candidates/[id]/page.tsx`
- Problem: `useEffect` calls `fetchCandidate` but only depends on `id`
- Fix: Either include `fetchCandidate` in the dependency array OR inline the fetch logic inside the useEffect
- Make sure no stale closures occur

### FIX-008: Add dropzone rejection feedback for wrong file types (BUG-009)
Location: `src/components/file-dropzone.tsx`
- Problem: `onDropRejected` only handles `file-too-large`. Wrong file type silently fails with no feedback.
- Fix: Add handling for all rejection reasons in `onDropRejected`:
  - `file-invalid-type`: toast "Invalid file type. Only PDF and DOCX are accepted."
  - `file-too-large`: toast "File is too large. Maximum size is 10MB."
  - Default: toast "File was rejected. Please try another file."
- Use sonner toast for notifications

## NICE TO HAVE (Low)

### FIX-009: Fix useIsMobile initial render (BUG-012)
Location: `src/hooks/use-mobile.ts`
- Problem: `!!undefined` returns `false` on first render causing brief flash
- Fix: Initialize with a proper default or use `useLayoutEffect` for initial measurement

## Verification
After all fixes:
- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Dashboard filtering doesn't cause excessive re-renders
- [ ] Wrong file type shows toast notification
- [ ] All existing E2E tests still pass (`npx playwright test`)

Commit your changes with message: `fix(ui): address QA bugs - polling, deps, dropzone feedback`
```

---

## Execution Order

```
BE + FE can run IN PARALLEL (no dependencies between fixes)
        │
        ▼
   After both complete → merge to master → run QA re-verification
```
