# Havyn Leasing

Operational leasing platform built with Next.js App Router, Prisma, and NextAuth.

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
  - Default credentials: `havynrecruiting@gmail.com` / `test123`
  - Google OAuth

## Vercel Deployment Auth Checklist

Set these environment variables in Vercel Project Settings:

- `DATABASE_URL`
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_GOOGLE_ID` (optional)
- `AUTH_GOOGLE_SECRET` (optional)

Google OAuth must include this callback URL:

- `https://<your-domain>/api/auth/callback/google`

On first credentials login, the app ensures this default account has an organization membership automatically.
