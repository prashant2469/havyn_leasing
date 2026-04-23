import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

/**
 * JWT/session signing key. Reads AUTH_SECRET or NEXTAUTH_SECRET from the
 * environment. Falls back to a built-in value so the app always starts
 * (override with a real random secret in production for maximum security).
 */
function resolveAuthSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "havyn-default-auth-secret-replace-me-in-production-32ch"
  );
}

/**
 * Edge-safe config (no Prisma). Used by middleware for JWT validation and by
 * auth.ts as the base config. The Credentials provider stub is required so the
 * middleware NextAuth instance recognises JWTs minted by credentials sign-in.
 */
export default {
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: () => null,
    }),
    ...(googleId && googleSecret
      ? [Google({ clientId: googleId, clientSecret: googleSecret })]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
} satisfies NextAuthConfig;
