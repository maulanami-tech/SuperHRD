# SuperHRD — Final Fix Prompts (Post Re-Verification)

> 2 remaining MEDIUM issues to reach unconditional GO.

---

## 🔧 BE Waker — Fix pdf-parse Worker

```
You are the Backend Engineer for SuperHRD. Fix one remaining issue from QA re-verification.

## NEW-002: pdf-parse worker module not found in Next.js dev mode (MEDIUM)

**Problem**: pdf-parse throws a worker module not found error during PDF text extraction in Next.js dev mode (Turbopack).
**Location**: `src/lib/file-parser.ts`

**Fix options** (pick the best one):

### Option A: Switch to pdf-parse v1 API
- pdf-parse v2 may have worker compatibility issues with Next.js Turbopack
- If v2 is installed, try downgrading to pdf-parse@1.x which uses simpler synchronous parsing
- `npm install pdf-parse@1` and update the import/usage in file-parser.ts

### Option B: Disable Turbopack for dev
- In package.json, change dev script from `next dev --turbopack` to `next dev`
- This avoids the Turbopack worker module issue
- Less ideal but quick fix

### Option C: Use pdfjs-dist directly
- Replace pdf-parse with direct `pdfjs-dist` usage
- Configure worker via `pdfjs.GlobalWorkerOptions.workerSrc`
- More control but more code

### Option D: Configure Next.js to handle pdf-parse
- Add webpack config in next.config.ts to handle pdf-parse's native/worker dependencies
- Example: `config.resolve.fallback = { ...config.resolve.fallback, 'worker_threads': false }`

**Recommendation**: Try Option A first (simplest). If pdf-parse v1 works, use that. If not, try Option D.

## Verification
- [ ] `npm run dev` → no worker module errors
- [ ] Upload a real PDF → text extraction succeeds
- [ ] `npm run build` → passes
- [ ] `npx tsc --noEmit` → passes

Commit: `fix(be): resolve pdf-parse worker issue in Next.js dev mode`
```

---

## 🎨 FE Waker — Fix Refs During Render

```
You are the Frontend Engineer for SuperHRD. Fix one remaining issue from QA re-verification.

## NEW-001: react-hooks/refs ESLint errors (MEDIUM)

**Problem**: `fetchRef.current = fetchFn` is assigned during render, which violates React rules (refs should not be written during render).

**Locations**:
1. `src/hooks/use-candidates.ts` (around line 53)
2. `src/app/(dashboard)/candidates/[id]/page.tsx` (around line 55)

**Fix**: Wrap the ref assignment in `useEffect`:

```tsx
// BEFORE (causes ESLint error):
const fetchRef = useRef(fetchCandidates);
fetchRef.current = fetchCandidates; // ❌ written during render

// AFTER (correct):
const fetchRef = useRef(fetchCandidates);
useEffect(() => {
  fetchRef.current = fetchCandidates; // ✅ written in effect
}, [fetchCandidates]);
```

Apply this pattern to both files.

## Verification
- [ ] `npx eslint src/hooks/use-candidates.ts` → zero errors
- [ ] `npx eslint src/app/\\(dashboard\\)/candidates/\\[id\\]/page.tsx` → zero errors
- [ ] `npm run build` → passes
- [ ] Dashboard polling still works correctly after filter changes
- [ ] Candidate detail page loads data correctly
- [ ] All 35 E2E tests still pass: `npx playwright test`

Commit: `fix(fe): wrap ref assignments in useEffect to resolve ESLint refs-during-render`
```

---

## Execution

```
BE + FE can run IN PARALLEL (independent fixes)
        │
        ▼
   Merge both → push → final QA sign-off → RELEASE GO ✅
```
