import { cookies } from "next/headers";
import { MembershipRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/server/db/client";

import { ACTIVE_ORG_COOKIE } from "./constants";

export type OrgContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class DevAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevAuthError";
  }
}

type ResolvedSessionIdentity = {
  userId: string | null;
  email: string | null;
};

function logAuthContextWarning(message: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") return;
  console.warn(`[auth-context] ${message}`, data);
}

async function ensureUserMembershipByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true },
  });

  if (user) {
    const membershipCount = await prisma.membership.count({
      where: { userId: user.id },
    });
    if (membershipCount > 0) return user.id;
    return null;
  }

  const organizationCount = await prisma.organization.count();
  if (organizationCount > 0) {
    return null;
  }

  const createdUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0] ?? normalizedEmail,
    },
    select: { id: true },
  });

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
      userId: createdUser.id,
      organizationId: org.id,
      role: MembershipRole.OWNER,
    },
  });

  return createdUser.id;
}

async function resolveSessionIdentityFromAuth(): Promise<ResolvedSessionIdentity> {
  const session = await auth();
  const email = session?.user?.email?.trim() || null;
  if (!email) return { userId: null, email: null };

  const userId = await ensureUserMembershipByEmail(email);
  return { userId, email };
}

async function resolveSessionUserIdFromAuth() {
  const resolved = await resolveSessionIdentityFromAuth();
  return resolved.userId;
}

async function listMembershipsForResolvedIdentity(identity: ResolvedSessionIdentity) {
  if (!identity.userId) return [];

  const memberships = await prisma.membership.findMany({
    where: { userId: identity.userId },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  });

  if (memberships.length === 0) {
    logAuthContextWarning("authenticated user has no org memberships", {
      resolvedUserId: identity.userId,
      hasEmail: Boolean(identity.email),
    });
  }

  return memberships;
}

async function resolveMembershipsFromAuth() {
  const identity = await resolveSessionIdentityFromAuth();
  const memberships = await listMembershipsForResolvedIdentity(identity);
  return { userId: identity.userId, memberships };
}

/**
 * Resolves the signed-in user and active organization (cookie + membership).
 * In development, `DEV_ORGANIZATION_ID` + `DEV_USER_ID` bypass session when both are set and valid.
 */
export async function requireOrgContext(): Promise<OrgContext> {
  if (process.env.NODE_ENV === "development") {
    const devOrg = process.env.DEV_ORGANIZATION_ID?.trim();
    const devUser = process.env.DEV_USER_ID?.trim();
    if (devOrg && devUser) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId: devUser, organizationId: devOrg },
        },
        select: { role: true },
      });
      if (membership) {
        return { organizationId: devOrg, userId: devUser, role: membership.role };
      }
    }
  }

  const { userId, memberships } = await resolveMembershipsFromAuth();
  if (!userId) {
    throw new DevAuthError("Not signed in.");
  }

  if (memberships.length === 0) {
    throw new DevAuthError("Your account has no organization memberships.");
  }

  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_ORG_COOKIE)?.value?.trim();
  const picked =
    (fromCookie ? memberships.find((m) => m.organizationId === fromCookie) : null) ??
    memberships[0]!;

  return { organizationId: picked.organizationId, userId, role: picked.role };
}

export async function tryOrgContext(): Promise<OrgContext | null> {
  try {
    return await requireOrgContext();
  } catch {
    return null;
  }
}

/** Session user id if signed in (no org resolution). */
export async function getSessionUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === "development") {
    const devUser = process.env.DEV_USER_ID?.trim();
    const devOrg = process.env.DEV_ORGANIZATION_ID?.trim();
    if (devOrg && devUser) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId: devUser, organizationId: devOrg },
        },
      });
      if (membership) return devUser;
    }
  }
  return await resolveSessionUserIdFromAuth();
}

export type MembershipOrgOption = { organizationId: string; name: string };

/** All orgs the current user belongs to (for switcher). */
export async function listSessionMembershipOrgs(): Promise<MembershipOrgOption[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const rows = await prisma.membership.findMany({
    where: { userId },
    include: { organization: { select: { name: true } } },
    orderBy: { organization: { name: "asc" } },
  });

  return rows.map((m) => ({
    organizationId: m.organizationId,
    name: m.organization.name,
  }));
}
