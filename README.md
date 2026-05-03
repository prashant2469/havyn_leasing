# Havyn Leasing

Operational leasing platform built with Next.js App Router, Prisma, and Supabase Auth.

## Local Development

Run one bootstrap command from a fresh clone:

```bash
npm run setup
```

That command links the repo to Vercel, pulls development environment variables into `.env.local`, installs dependencies, and applies migrations.

Then start the app:

```bash
npm run dev
```

## Auth Model

- Login supports:
  - Invited email/password accounts through Supabase
  - Google OAuth through Supabase
- Required runtime values are managed through Vercel project environment variables.

## Vercel / Production

This repo is designed to use Vercel as the env source of truth:

- Supabase / Postgres variables are provisioned through Marketplace integration.
- Upstash KV variables are provisioned through Marketplace integration.
- App-specific keys (Twilio, Resend, OpenAI, Google OAuth) are set once in Vercel env settings.

For local refreshes after env changes:

```bash
npx vercel env pull .env.local --environment=development --yes
```
