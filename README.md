# Havyn Leasing

Operational leasing platform built with Next.js App Router, Prisma, and Supabase Auth.

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Start local database and seed demo data:

```bash
npm run db:setup
```

3. Start the app:

```bash
npm run dev
```

## Auth Model

- Login supports:
  - Invited email/password accounts through Supabase
  - Google OAuth through Supabase
- Required env:
  - `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (for team invites and password setup emails)
