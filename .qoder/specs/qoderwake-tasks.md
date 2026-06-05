# SuperHRD — QoderWake Task Delivery

> **Project Spec**: `.qoder/specs/SuperHRD_MVP_Project_task-2ce.md`
> **Project Root**: `/home/dsi-maulana/Pribadi/SuperHRD`
> **Execution Order**: BE first → FE second → QA last (sequential, each depends on the previous)

---

## 🔧 Waker 1: Backend Engineer (BE)

**Role**: Full-stack backend — project scaffolding, database, API routes, auth, n8n integration.

### Task Prompt (copy-paste to your BE Waker):

```
You are the Backend Engineer for the SuperHRD project.
Read the full project spec at `.qoder/specs/SuperHRD_MVP_Project_task-2ce.md` before starting.

## Tech Stack
- Next.js 15 (App Router) with TypeScript
- Prisma + SQLite
- NextAuth.js v5 (Credentials Provider)
- Zod for validation
- pdf-parse + mammoth for file parsing

## Your Responsibilities

### Phase 1: Project Scaffolding
1. Scaffold a new Next.js 15 project with TypeScript, Tailwind CSS, App Router, and src/ directory structure. Use `create-next-app` (use a temp directory like /tmp/superhrd then move files to project root since npm disallows capital letters in project name).
2. Install all dependencies:
   - prisma, @prisma/client
   - next-auth@beta (v5)
   - zod
   - pdf-parse, mammoth
   - bcryptjs, @types/bcryptjs
   - uuid, @types/uuid
3. Initialize Prisma with SQLite (`npx prisma init --datasource-provider sqlite`)
4. Write the Prisma schema:

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Candidate {
  id            String            @id @default(cuid())
  name          String
  email         String?
  fileName      String
  filePath      String
  status        String            @default("pending") // pending | processing | completed | failed
  overallScore  Float?
  n8nRunId      String?           @unique
  submittedBy   String
  submittedById String
  submittedByUser User            @relation(fields: [submittedById], references: [id])
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  screeningResult ScreeningResult?
}

model ScreeningResult {
  id           String   @id @default(cuid())
  candidateId  String   @unique
  candidate    Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  overallScore Float
  summary      String
  criteria     String   // JSON string: [{name: string, score: number, notes: string}]
  rawResponse  String?
  scoredAt     DateTime @default(now())
}
```

5. Run `npx prisma migrate dev --name init`
6. Create a seed script at `prisma/seed.ts`:
   - Hash password "admin123" with bcryptjs
   - Create default user: { name: "HRD Admin", email: "hrd@superhrd.com", passwordHash }
7. Add `"prisma": { "seed": "npx tsx prisma/seed.ts" }` to package.json
8. Run `npx prisma db seed`
9. Create `src/lib/prisma.ts` — singleton Prisma client
10. Create `src/lib/db.ts` — re-export prisma client

### Phase 2: Authentication
1. Create `src/lib/auth.ts` — NextAuth v5 configuration:
   - CredentialsProvider: validate email + password against DB using bcrypt
   - Session strategy: JWT
   - Callbacks: include user ID in session
2. Create `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
3. Create `src/middleware.ts` — protect all routes except `/login` and `/api/auth/**` and `/api/n8n/callback`
4. Create `auth()` helper function for server components

### Phase 3: API Routes
1. **POST /api/upload** (`src/app/api/upload/route.ts`):
   - Accept multipart form-data with file (PDF/DOCX) and candidate name/email
   - Validate with Zod (file type: pdf/docx, max size: 10MB)
   - Save file to `./uploads/` directory (create if not exists)
   - Extract text from file using pdf-parse (PDF) or mammoth (DOCX)
   - Create Candidate record with status "pending"
   - Generate UUID as n8nRunId
   - POST to N8N_WEBHOOK_URL with body: { runId: n8nRunId, cvText, candidateName, candidateEmail, callbackUrl: APP_URL + "/api/n8n/callback" }
   - Update Candidate status to "processing"
   - Return { candidateId, status: "processing" }

2. **GET /api/candidates** (`src/app/api/candidates/route.ts`):
   - Require auth (check session)
   - Return all candidates with screeningResult included, ordered by createdAt desc
   - Support query params: search (name/email), status filter

3. **GET /api/candidates/[id]** (`src/app/api/candidates/[id]/route.ts`):
   - Require auth
   - Return single candidate with screeningResult

4. **POST /api/n8n/callback** (`src/app/api/n8n/callback/route.ts`):
   - Validate header/body contains N8N_CALLBACK_SECRET
   - Receive: { runId, overallScore, summary, criteria: [{name, score, notes}], rawResponse }
   - Find candidate by n8nRunId
   - Create ScreeningResult record
   - Update Candidate: status = "completed", overallScore
   - Handle errors: update candidate status to "failed"

### Phase 4: Utility Files
1. Create `src/lib/n8n-client.ts`:
   - Function `sendToN8n({ runId, cvText, candidateName, candidateEmail, callbackUrl })` — POST to webhook
   - Use env vars: N8N_WEBHOOK_URL, APP_URL
2. Create `src/lib/file-parser.ts`:
   - Function `extractText(filePath: string, mimeType: string): Promise<string>`
   - Handle PDF (pdf-parse) and DOCX (mammoth)
3. Create `src/lib/validations.ts`:
   - Zod schemas for: upload form, n8n callback payload, login form

### Phase 5: Environment Setup
1. Create `.env.example` with all required env vars:
   ```
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="generate-a-random-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   N8N_WEBHOOK_URL="https://your-n8n.com/webhook/cv-screening"
   N8N_CALLBACK_SECRET="shared-secret-with-n8n"
   APP_URL="http://localhost:3000"
   ```
2. Copy to `.env` with actual values for local dev
3. Update `.gitignore`: add uploads/, .env, prisma/dev.db

### Deliverables Checklist
- [ ] Project scaffolds and runs with `npm run dev`
- [ ] Prisma schema migrated, seed user created
- [ ] Login API works (POST /api/auth/callback/credentials)
- [ ] All 4 API routes functional
- [ ] Middleware protects routes
- [ ] File parser handles PDF and DOCX
- [ ] n8n client sends webhook + callback receives results
```

---

## 🎨 Waker 2: Frontend Engineer (FE)

**Role**: All UI pages, components, layouts, and client-side logic.

### Task Prompt (copy-paste to your FE Waker):

```
You are the Frontend Engineer for the SuperHRD project.
Read the full project spec at `.qoder/specs/SuperHRD_MVP_Project_task-2ce.md` before starting.
The Backend Engineer has already set up the project, API routes, auth, and Prisma. Your job is UI only.

## Tech Stack
- Next.js 15 App Router + TypeScript
- Tailwind CSS + shadcn/ui components
- @tanstack/react-table for data tables
- React hook form + zod for forms

## Design System
- Clean, professional HR dashboard look
- Color scheme: slate/gray base, blue primary, green/yellow/red for score badges
- Responsive (mobile + desktop)
- Sidebar navigation layout

## Your Responsibilities

### Phase 1: shadcn/ui Setup
1. Initialize shadcn/ui: `npx shadcn@latest init` (choose New York style, Slate color, CSS variables yes)
2. Install required shadcn components:
   ```
   npx shadcn@latest add button card input label table badge dialog dropdown-menu select separator sheet sidebar skeleton sonner tabs textarea toast avatar
   ```
3. Install additional deps if not present:
   - @tanstack/react-table
   - react-hook-form, @hookform/resolvers
   - lucide-react (icons)
   - react-dropzone (file upload)

### Phase 2: App Layout (Dashboard Shell)
1. Create `src/components/app-sidebar.tsx`:
   - Sidebar with navigation: Dashboard (/dashboard), Upload (/upload)
   - App name "SuperHRD" at top
   - User info + logout button at bottom
2. Create `src/components/header.tsx`:
   - Header with page title, breadcrumb
   - Mobile menu toggle (hamburger → sheet sidebar)
3. Create `src/app/(dashboard)/layout.tsx`:
   - SidebarProvider wrapping SidebarInset
   - Include header
   - This layout wraps /dashboard and /upload pages
4. Create `src/app/page.tsx` — redirect to /dashboard if logged in, else redirect to /login

### Phase 3: Login Page
1. Create `src/app/login/page.tsx`:
   - Centered card with SuperHRD logo/title
   - Email + password form (react-hook-form + zod validation)
   - Submit calls signIn("credentials", { email, password, redirect: false })
   - On success: redirect to /dashboard
   - On error: show toast error
   - Loading state on submit button
2. Style: clean, minimal, centered on page with subtle background

### Phase 4: Dashboard Page
1. Create `src/app/(dashboard)/dashboard/page.tsx`:
   - Page title: "Candidate Screening"
   - Search input (debounced, filters by name/email)
   - Status filter dropdown (All, Pending, Processing, Completed, Failed)
   - "Upload New" button → links to /upload
2. Create `src/components/candidates-table.tsx`:
   - TanStack React Table with columns:
     | Column | Description |
     |---|---|
     | Name | Candidate name, clickable → /candidates/[id] |
     | Email | Candidate email |
     | File | File name with icon |
     | Score | Overall score as badge (green ≥80, yellow ≥60, red <60, gray if null) |
     | Status | Status badge (pending=gray, processing=blue/animated, completed=green, failed=red) |
     | Submitted | Relative time (e.g., "2 hours ago") |
   - Sortable by score, name, date
   - Row click navigates to /candidates/[id]
3. Create `src/hooks/use-candidates.ts`:
   - Custom hook that fetches GET /api/candidates
   - Supports search + status filter params
   - Auto-refresh polling every 10 seconds (for status updates from n8n)
   - Returns { candidates, isLoading, error, refetch }

### Phase 5: Upload Page
1. Create `src/app/(dashboard)/upload/page.tsx`:
   - Page title: "Upload CV"
   - Form with:
     - Candidate Name input (required)
     - Candidate Email input (optional)
     - Drag-and-drop file zone (react-dropzone)
       - Accept: .pdf, .docx
       - Max size: 10MB
       - Show file name + size after selection
       - Remove file button
     - Submit button: "Upload & Screen"
   - On submit:
     - POST multipart/form-data to /api/upload
     - Show loading spinner
     - On success: toast success + redirect to /dashboard
     - On error: toast error with message
2. Create `src/components/file-dropzone.tsx`:
   - Drag-and-drop zone with dashed border
   - File type icon (PDF/DOCX)
   - Click to browse
   - Drag hover state styling

### Phase 6: Candidate Detail Page
1. Create `src/app/(dashboard)/candidates/[id]/page.tsx`:
   - Back button → /dashboard
   - Candidate info card: name, email, file name, submitted date, status badge, overall score
   - If status "processing": show animated loading state + "AI is screening this CV..."
   - If status "completed": show screening results
   - If status "failed": show error state with retry option
2. Create `src/components/screening-results.tsx`:
   - Overall score: large number with color-coded circular indicator
   - Summary text block
   - Criteria breakdown: table or cards showing each criterion
     | Column | Description |
     |---|---|
     | Criterion | Name of the evaluation criteria |
     | Score | Score bar (0-100) with color |
     | Notes | AI-generated notes/feedback |
   - Use accordion or card layout for criteria

### Phase 7: Shared Components & States
1. Create `src/components/score-badge.tsx`:
   - Color-coded score display: green (≥80), yellow (≥60-79), red (<60), gray (no score)
2. Create `src/components/status-badge.tsx`:
   - Status pill: pending (gray), processing (blue + pulse animation), completed (green), failed (red)
3. Create `src/components/loading-skeleton.tsx`:
   - Skeleton loaders for: table rows, candidate detail card, screening results
4. Create `src/components/empty-state.tsx`:
   - Illustration + message + CTA for empty dashboard
5. Set up toast notifications using sonner (`<Toaster />` in root layout)

### Phase 8: Responsive Design
1. Sidebar collapses to sheet/drawer on mobile
2. Table: horizontal scroll or card layout on mobile
3. Upload page: full-width dropzone on mobile
4. Candidate detail: stacked layout on mobile

### Deliverables Checklist
- [ ] Login page functional with auth
- [ ] Dashboard shows candidates table with search/filter
- [ ] Upload page accepts files and submits to API
- [ ] Candidate detail shows scoring breakdown
- [ ] Auto-refresh polling works
- [ ] All loading/error/empty states implemented
- [ ] Mobile responsive
- [ ] Toast notifications working
```

---

## 🧪 Waker 3: QA Engineer (QA)

**Role**: Testing, validation, bug reporting, and quality assurance across all features.

### Task Prompt (copy-paste to your QA Waker):

```
You are the QA Engineer for the SuperHRD project.
Read the full project spec at `.qoder/specs/SuperHRD_MVP_Project_task-2ce.md` before starting.
The Backend and Frontend Engineers have built the application. Your job is to test everything, report bugs, and ensure quality.

## Tech Stack
- Next.js 15 App Router + TypeScript
- Prisma + SQLite
- Vitest or Jest for unit testing
- Playwright for E2E testing (preferred) or Cypress

## Your Responsibilities

### Phase 1: Test Infrastructure Setup
1. Install test dependencies:
   ```
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   npm install -D @playwright/test (or npx playwright install)
   ```
2. Configure Vitest in `vitest.config.ts`:
   - Environment: jsdom
   - Setup files: `src/__tests__/setup.ts` (import @testing-library/jest-dom)
   - Path aliases matching tsconfig
3. Add test scripts to package.json:
   - `"test": "vitest"`
   - `"test:unit": "vitest run"`
   - `"test:e2e": "npx playwright test"`
4. Create Playwright config `playwright.config.ts`:
   - Base URL: http://localhost:3000
   - Web server: `npm run dev`
   - Test directory: `e2e/`

### Phase 2: Unit Tests (Vitest)

#### 2.1 — File Parser Tests (`src/__tests__/lib/file-parser.test.ts`)
- [ ] Extracts text from a valid PDF file
- [ ] Extracts text from a valid DOCX file
- [ ] Throws error for unsupported file types (.txt, .jpg)
- [ ] Throws error for corrupted files
- [ ] Returns non-empty string for valid files
- Create test fixtures: place sample PDF and DOCX files in `src/__tests__/fixtures/`

#### 2.2 — Validation Schema Tests (`src/__tests__/lib/validations.test.ts`)
- [ ] Upload validation: accepts valid PDF with name
- [ ] Upload validation: rejects file > 10MB
- [ ] Upload validation: rejects unsupported file type
- [ ] Upload validation: requires candidate name
- [ ] Login validation: requires valid email format
- [ ] Login validation: requires non-empty password
- [ ] n8n callback validation: requires runId, overallScore, criteria array
- [ ] n8n callback validation: rejects missing fields

#### 2.3 — N8N Client Tests (`src/__tests__/lib/n8n-client.test.ts`)
- [ ] Sends POST request to correct webhook URL
- [ ] Includes all required fields in payload (runId, cvText, candidateName, candidateEmail, callbackUrl)
- [ ] Handles network errors gracefully
- [ ] Mock fetch and verify request structure

#### 2.4 — Auth Helper Tests (`src/__tests__/lib/auth.test.ts`)
- [ ] Authorize returns user for valid credentials
- [ ] Authorize returns null for wrong password
- [ ] Authorize returns null for non-existent user
- [ ] Session callback includes user ID

### Phase 3: API Integration Tests

#### 3.1 — Upload API (`src/__tests__/api/upload.test.ts`)
- [ ] Returns 401 when not authenticated
- [ ] Returns 400 for missing file
- [ ] Returns 400 for invalid file type
- [ ] Returns 400 for oversized file
- [ ] Returns 200 with candidateId on valid upload
- [ ] Creates Candidate record in database
- [ ] Saves file to uploads/ directory

#### 3.2 — Candidates API (`src/__tests__/api/candidates.test.ts`)
- [ ] GET /api/candidates returns 401 when not authenticated
- [ ] GET /api/candidates returns all candidates with screening data
- [ ] GET /api/candidates supports search query parameter
- [ ] GET /api/candidates supports status filter parameter
- [ ] GET /api/candidates/[id] returns candidate with screening result
- [ ] GET /api/candidates/[id] returns 404 for non-existent candidate

#### 3.3 — N8N Callback API (`src/__tests__/api/callback.test.ts`)
- [ ] Returns 401 when callback secret is missing/invalid
- [ ] Returns 200 and updates candidate on valid callback
- [ ] Creates ScreeningResult record
- [ ] Updates candidate status to "completed" with overallScore
- [ ] Returns 404 when n8nRunId doesn't match any candidate
- [ ] Handles malformed criteria JSON gracefully

### Phase 4: E2E Tests (Playwright)

#### 4.1 — Auth Flow (`e2e/auth.spec.ts`)
- [ ] Login page renders with email/password fields
- [ ] Login with valid credentials redirects to dashboard
- [ ] Login with invalid credentials shows error toast
- [ ] Unauthenticated user is redirected to /login
- [ ] Logout clears session and redirects to /login

#### 4.2 — Dashboard Flow (`e2e/dashboard.spec.ts`)
- [ ] Dashboard loads and shows candidates table
- [ ] Empty state shown when no candidates exist
- [ ] Search input filters candidates by name
- [ ] Status filter dropdown works correctly
- [ ] Clicking a candidate row navigates to detail page
- [ ] "Upload New" button navigates to /upload

#### 4.3 — Upload Flow (`e2e/upload.spec.ts`)
- [ ] Upload page renders with form fields and dropzone
- [ ] File dropzone accepts PDF files
- [ ] File dropzone accepts DOCX files
- [ ] File dropzone rejects other file types
- [ ] Submit button disabled without required fields
- [ ] Successful upload shows success toast and redirects to dashboard
- [ ] Uploaded candidate appears in dashboard with "processing" status

#### 4.4 — Candidate Detail Flow (`e2e/candidate-detail.spec.ts`)
- [ ] Detail page shows candidate info
- [ ] Processing state shows loading animation
- [ ] Completed state shows scoring breakdown with criteria
- [ ] Failed state shows error message
- [ ] Back button returns to dashboard
- [ ] Score badges display correct colors based on score value

### Phase 5: Manual Test Cases (document results)

Create a test report at `qa-test-report.md` covering:

#### 5.1 — Cross-browser Testing
- [ ] Chrome: all pages render correctly
- [ ] Firefox: all pages render correctly
- [ ] Safari: all pages render correctly (if available)

#### 5.2 — Edge Cases
- [ ] Upload very large PDF (>50 pages)
- [ ] Upload file with special characters in name
- [ ] Upload same file twice (duplicate handling)
- [ ] Rapid consecutive uploads
- [ ] Network interruption during upload
- [ ] n8n callback with extremely large criteria array
- [ ] Session expiry during active use

#### 5.3 — Security Checks
- [ ] API routes require authentication (except callback)
- [ ] n8n callback validates shared secret
- [ ] No sensitive data exposed in client-side bundle
- [ ] File upload validates type (not just extension)
- [ ] SQL injection attempts in search parameter

#### 5.4 — Performance
- [ ] Dashboard loads in <3s with 50 candidates
- [ ] File upload handles 10MB files without timeout
- [ ] Table sorting/filtering is responsive
- [ ] Auto-refresh polling doesn't cause memory leaks

### Phase 6: Bug Fix Verification
- After BE/FE fix reported bugs, re-test and verify
- Run full test suite: `npm run test:unit && npm run test:e2e`
- Report pass/fail results

### Deliverables Checklist
- [ ] Vitest configured and working
- [ ] Playwright configured and working
- [ ] All unit tests pass
- [ ] All API integration tests pass
- [ ] All E2E tests pass
- [ ] Manual test cases documented in qa-test-report.md
- [ ] No critical/high bugs remaining open
- [ ] Test coverage report generated
```

---

## Execution Order & Dependencies

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Waker 1: BE   │────▶│   Waker 2: FE   │────▶│   Waker 3: QA   │
│                 │     │                 │     │                 │
│ 1. Scaffold     │     │ 1. shadcn setup │     │ 1. Test infra   │
│ 2. Prisma + DB  │     │ 2. Layout/shell │     │ 2. Unit tests   │
│ 3. Auth config  │     │ 3. Login page   │     │ 3. API tests    │
│ 4. API routes   │     │ 4. Dashboard    │     │ 4. E2E tests    │
│ 5. n8n client   │     │ 5. Upload page  │     │ 5. Manual tests │
│ 6. Env + seed   │     │ 6. Detail page  │     │ 6. Bug verify   │
│                 │     │ 7. Components   │     │                 │
│                 │     │ 8. Responsive   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
    Run FIRST                Run SECOND               Run THIRD
   (foundation)            (needs APIs)           (needs working app)
```

> **Note**: FE depends on BE completing API routes + auth. QA depends on both BE and FE having a working app. Run them sequentially, waiting for each Waker to finish before starting the next.
