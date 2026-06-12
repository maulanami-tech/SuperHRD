# SuperHRD — AI-Powered CV Screening Dashboard

## Tech Stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Prisma v7 + SQLite
- NextAuth.js v5
- Tailwind CSS v4 + shadcn/ui
- Zod v4

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate deploy  # Run migrations
npx prisma db seed   # Seed database
```

## Project Structure

```text
src/
  app/
    api/           # API routes (App Router)
    (dashboard)/   # Dashboard pages
    login/         # Auth pages
  lib/
    auth.ts        # NextAuth config
    credits.ts     # Credit system logic
    validations.ts # Zod schemas
  components/      # UI components
prisma/
  schema.prisma    # Database schema
```

## Default Credentials

- Email: `hrd@superhrd.com`
- Password: admin123
