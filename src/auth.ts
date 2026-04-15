import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { prisma } from "@/server/db/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
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
