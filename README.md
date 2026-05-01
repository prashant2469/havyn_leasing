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

## Vercel / production

Prisma requires Postgres connection strings (Supabase URL alone is not enough):

- `DATABASE_URL` — pooled connection string from Supabase (**Project Settings → Database**)
- `DIRECT_URL` — direct connection string (same screen; used for migrations / some Prisma flows)

Optional but required if anyone has connected Google Calendar in that database:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

Also set `NEXT_PUBLIC_APP_URL` to your production site URL (e.g. `https://havyn-leasing.vercel.app`).
