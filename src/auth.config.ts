import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

/**
 * JWT/session signing. Required in production — set `AUTH_SECRET` (e.g. `openssl rand -base64 32`).
 * Development-only fallback so local runs work without editing `.env` first.
 */
function resolveAuthSecret(): string | undefined {
  const fromEnv =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "havyn-dev-auth-secret-not-for-production-use-32chars-min";
  }
  return undefined;
}

/**
 * Edge-safe fragment (no Prisma). Used by middleware. Full config with adapter lives in auth.ts.
 */
export default {
  secret: resolveAuthSecret(),
  providers: [
    ...(googleId && googleSecret
      ? [Google({ clientId: googleId, clientSecret: googleSecret })]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
} satisfies NextAuthConfig;
