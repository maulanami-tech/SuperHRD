# SuperHRD - AI-Powered CV Screening MVP

## Project Brief

| Field | Detail |
|---|---|
| **Name** | SuperHRD |
| **Tagline** | AI-powered CV screening dashboard for internal HR teams |
| **Goal** | HRD uploads candidate CVs, AI (via n8n) scores them automatically, HRD reviews ranked results |
| **Users** | Internal HRD only (single role, 1-5 users) |
| **Flow** | UI Upload → n8n Webhook → AI Screening → Callback → Dashboard Report |

**In Scope:** Login, CV upload (PDF/DOCX), n8n webhook integration, screening dashboard, candidate detail  
**Out of Scope:** Multi-tenant, RBAC, candidate communication, ATS features, SSO, cloud deployment

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Full-stack, API routes included, single deploy target |
| Language | **TypeScript** | Type safety |
| Styling | **Tailwind CSS + shadcn/ui** | Rapid UI development |
| Auth | **NextAuth.js v5** | Simple credential login |
| ORM | **Prisma** | Type-safe queries, easy DB migration later |
| Database | **SQLite** | Zero-ops, perfect for MVP |
| File Parsing | **pdf-parse + mammoth** | PDF/DOCX text extraction |
| Tables | **@tanstack/react-table** | Sortable/filterable dashboard |
| Validation | **Zod** | Schema validation |

## Architecture Flow

```
User uploads CV → POST /api/upload → Save file + Extract text
  → POST to n8n webhook (with runId, cvText, callbackUrl)
  → Update status: "processing"
  → n8n processes (AI scoring)
  → n8n calls POST /api/n8n/callback (with scores)
  → Store ScreeningResult + Update Candidate status: "completed"
  → Dashboard auto-refresh shows results
```

## Database Schema

- **User**: id, name, email, passwordHash
- **Candidate**: id, name, email, fileName, filePath, status (pending/processing/completed/failed), overallScore, n8nRunId, submittedBy, timestamps
- **ScreeningResult**: id, candidateId, overallScore, summary, criteria (JSON string: [{name, score, notes}]), rawResponse, scoredAt

## Pages

| Route | Purpose |
|---|---|
| `/login` | Email + password login |
| `/dashboard` | Candidates table with scores, status badges, search/filter |
| `/upload` | Drag-and-drop CV upload |
| `/candidates/[id]` | Candidate detail with scoring breakdown |

## API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/upload` | Accept CV, store, call n8n webhook |
| GET | `/api/candidates` | List all candidates with screening data |
| GET | `/api/candidates/[id]` | Single candidate with results |
| POST | `/api/n8n/callback` | Receive n8n screening result (secured with shared secret) |

## Implementation Tasks

### Task 1: Scaffold Project
- `create-next-app` with TypeScript + Tailwind + App Router
- Install dependencies (prisma, next-auth, zod, shadcn/ui, etc.)
- Initialize Prisma + SQLite, write schema, migrate
- Seed default HRD user

### Task 2: Authentication
- Configure NextAuth (CredentialsProvider)
- Build login page
- Add middleware for route protection
- Build dashboard shell layout (sidebar + header)

### Task 3: CV Upload + n8n Integration
- Build upload page with drag-and-drop UI
- Create POST /api/upload (multipart handling, file storage, n8n webhook call)
- Create file parser (PDF/DOCX text extraction)
- Create POST /api/n8n/callback (receive results, update DB)
- n8n client utility with correlation ID (n8nRunId)

### Task 4: Dashboard + Candidate Detail
- Build candidates table (TanStack Table) with score badges
- Dashboard page with search/filter
- Candidate detail page with scoring breakdown
- Add polling/auto-refresh for status updates

### Task 5: Polish
- Loading states, error handling, empty states
- Toast notifications
- Mobile responsiveness
- .gitignore updates

## Key Decisions

- **No separate backend**: Next.js API routes handle everything
- **Text extraction before n8n**: Send text, not binary files (smaller payloads)
- **Callback pattern**: n8n calls back when done (no polling n8n)
- **Correlation ID**: UUID links upload to callback result
- **Local file storage**: `./uploads/` for MVP, S3 later if needed

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="random-secret"
NEXTAUTH_URL="http://localhost:3000"
N8N_WEBHOOK_URL="https://your-n8n.com/webhook/cv-screening"
N8N_CALLBACK_SECRET="shared-secret-with-n8n"
APP_URL="http://localhost:3000"
```

## Verification

- Run `npm run dev` → app loads at localhost:3000
- Login with seeded credentials → redirects to dashboard
- Upload a CV → status shows "processing"
- n8n callback fires → status updates to "completed" with scores
- Dashboard shows candidate with overall score
- Click candidate → detail page shows criteria breakdown
