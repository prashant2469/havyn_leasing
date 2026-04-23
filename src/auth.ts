import { MembershipRole } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { prisma } from "@/server/db/client";

const DEFAULT_LOGIN_EMAIL = "havynrecruiting@gmail.com";
const DEFAULT_LOGIN_PASSWORD = "test123";

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

function resolveAuthSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "havyn-default-auth-secret-replace-me-in-production-32ch"
  );
}

async function ensureDefaultLoginUser() {
  const normalizedEmail = DEFAULT_LOGIN_EMAIL.toLowerCase();
  const user =
    (await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, name: true, image: true },
    })) ??
    (await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: "Havyn Recruiting",
      },
      select: { id: true, email: true, name: true, image: true },
    }));

  const membershipCount = await prisma.membership.count({
    where: { userId: user.id },
  });
  if (membershipCount === 0) {
    const org =
      (await prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await prisma.organization.create({
        data: { name: "Havyn", slug: "havyn" },
        select: { id: true },
      }));

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: MembershipRole.OWNER,
      },
    });
  }

  return user;
}

/**
 * Single NextAuth instance used by route handlers AND imported by server
 * components / actions. The middleware uses a separate edge-safe instance
 * from auth.config.ts but shares the same secret + session strategy so
 * JWT tokens minted here are readable there.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        if (
          email.toLowerCase() !== DEFAULT_LOGIN_EMAIL.toLowerCase() ||
          password !== DEFAULT_LOGIN_PASSWORD
        ) {
          return null;
        }

        const user = await ensureDefaultLoginUser();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(googleId && googleSecret
      ? [Google({ clientId: googleId, clientSecret: googleSecret })]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
