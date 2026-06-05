# SuperHRD — AI-Powered CV Screening Dashboard

AI-powered CV screening dashboard for internal HR teams. Upload candidate CVs, AI (via n8n) scores them automatically, HRD reviews ranked results.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | NextAuth.js v5 (Credentials Provider) |
| ORM | Prisma v7 |
| Database | SQLite (via better-sqlite3 adapter) |
| File Parsing | pdf-parse v2 (PDF) + mammoth (DOCX) |
| Validation | Zod v4 |
| Tables | TanStack React Table |

## Prerequisites

- Node.js 22+
- npm 10+

## Setup

1. **Install dependencies** (Prisma client is auto-generated via postinstall):
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your values (see [Environment Variables](#environment-variables) below).

3. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Seed the database** (creates the default admin user):
   ```bash
   npx prisma db seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) and log in.

## Default Credentials

| Email | Password |
|-------|----------|
| hrd@superhrd.com | admin123 |

> Change the password after first login in production.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database file path | `file:./dev.db` |
| `NEXTAUTH_SECRET` | Secret for JWT signing (generate a random string) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |
| `N8N_WEBHOOK_URL` | n8n webhook endpoint for CV screening | `https://your-n8n.com/webhook/cv-screening` |
| `N8N_CALLBACK_SECRET` | Shared secret for n8n callback authentication | `your-shared-secret` |
| `APP_URL` | Public URL of this app (used for callback URL) | `http://localhost:3000` |

## Project Structure

```
src/
  app/
    api/
      auth/[...nextauth]/   # NextAuth route handler
      upload/               # POST - CV upload + n8n webhook trigger
      candidates/           # GET - list candidates with screening results
      candidates/[id]/      # GET - single candidate detail
      n8n/callback/         # POST - n8n screening result callback
    login/                  # Login page
    dashboard/              # Dashboard with candidate table
    upload/                 # CV upload page
    candidates/[id]/        # Candidate detail page
  lib/
    auth.ts                 # NextAuth v5 configuration
    prisma.ts               # Prisma client singleton
    db.ts                   # Re-export prisma client
    validations.ts          # Zod schemas
    file-parser.ts          # PDF/DOCX text extraction
    n8n-client.ts           # n8n webhook client
  components/               # UI components (shadcn/ui based)
prisma/
  schema.prisma             # Database schema
  seed.ts                   # Seed script
  migrations/               # Database migrations
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Architecture Flow

```
User uploads CV → POST /api/upload → Save file + Extract text
  → POST to n8n webhook (with runId, cvText, callbackUrl)
  → Update status: "processing"
  → n8n processes (AI scoring)
  → n8n calls POST /api/n8n/callback (with scores)
  → Store ScreeningResult + Update Candidate status: "completed"
  → Dashboard shows results
```
