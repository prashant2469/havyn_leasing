import { PrismaAdapter } from "@auth/prisma-adapter";
import { MembershipRole } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { prisma } from "@/server/db/client";

const DEFAULT_LOGIN_EMAIL = "havynrecruiting@gmail.com";
const DEFAULT_LOGIN_PASSWORD = "test123";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(authConfig.providers ?? []),
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
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = (user?.email ?? profile?.email)?.trim();
      if (!email) return false;
      const u = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { memberships: { take: 1 } },
      });
      return !!(u && u.memberships.length > 0);
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
