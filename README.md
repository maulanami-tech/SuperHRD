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
| Database | PostgreSQL |
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

4. **Seed the database** (creates the initial admin user):
   ```bash
   npx prisma db seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) and log in with the admin credentials configured for your environment.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_DB` | Local Docker PostgreSQL database name | `superhrd` |
| `POSTGRES_USER` | Local Docker PostgreSQL username | `superhrd` |
| `POSTGRES_PASSWORD` | Local Docker PostgreSQL password | `superhrd_dev_password` |
| `POSTGRES_PORT` | Local Docker PostgreSQL host port | `5432` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://superhrd:superhrd_dev_password@localhost:5432/superhrd?schema=public` |
| `NEXTAUTH_SECRET` | Secret for JWT signing (generate a random string) | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Trust forwarded host values for Auth.js callbacks | `true` |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |
| `N8N_WEBHOOK_URL` | n8n webhook endpoint for CV screening | `https://your-n8n.com/webhook/cv-screening` |
| `N8N_CALLBACK_SECRET` | Shared secret for n8n callback authentication | `your-shared-secret` |
| `APP_URL` | Public URL of this app (used for callback URL) | `http://localhost:3000` |
| `MIDTRANS_MERCHANT_ID` | Midtrans merchant ID | `Gxxxxxxxxx` |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key | `SB-Mid-client-...` |
| `MIDTRANS_SERVER_KEY` | Midtrans server key used by server-side charge and webhook verification | `SB-Mid-server-...` |
| `MIDTRANS_IS_PRODUCTION` | Use Midtrans production API when `true`; sandbox when `false` | `false` |
| `MIDTRANS_NOTIFICATION_URL` | Optional public webhook override for Midtrans payment notifications | `https://your-app.com/api/payments/midtrans/notification` |
| `TOPUP_EXPIRY_MINUTES` | Optional QRIS top-up expiry in minutes | `30` |

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
      payments/midtrans/    # POST - Midtrans QRIS payment notification
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
| `npm run test:e2e:dev` | Run the full local/dev Playwright suite with DB-backed auth setup |
| `npm run test:e2e:prod` | Run the production-safe Playwright suite against `PLAYWRIGHT_BASE_URL` or `SUPERHRD_E2E_BASE_URL` |
| `npm run test:e2e:prod:smoke` | Run the Cloudflare-aware production smoke test through Brave CDP |
| `npm run test:e2e:prod:batch-zip` | Run the explicit production batch ZIP upload test |
| `npm run docker:up` | Build and run app + PostgreSQL with Docker Compose |
| `npm run docker:down` | Stop Docker Compose services |

Production E2E uses `SUPERHRD_E2E_EMAIL` and `SUPERHRD_E2E_PASSWORD`. The
Playwright production config excludes destructive regression/upload tests and
does not write to the database during auth setup. The batch ZIP production test
is intentionally separate because it creates upload data in production.

## Midtrans QRIS Payments

Top-up payments use Midtrans Core API QRIS. Users create a QRIS payment from the Top Up page; credits are added only after Midtrans sends a verified `settlement` notification to:

```text
https://your-app.com/api/payments/midtrans/notification
```

For local or SIT testing, use sandbox keys and keep `MIDTRANS_IS_PRODUCTION=false`. In production, set the production merchant keys and make sure the notification URL is reachable over public HTTPS. If the app is behind Cloudflare Tunnel, allow this webhook path to pass through without browser challenge.

## Docker Debug and Deploy

For the default internal debug stack, start PostgreSQL and the app together:

```bash
docker compose up --build --force-recreate
```

The compose stack will:

- start PostgreSQL with a named volume
- wait for PostgreSQL health before starting the app
- run `prisma migrate deploy` automatically before `npm run start`
- persist uploaded files in a named uploads volume

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
