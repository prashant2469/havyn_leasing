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
  sessionUserId: string | null;
};

function logAuthContextWarning(message: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") return;
  console.warn(`[auth-context] ${message}`, data);
}

async function persistActiveOrgCookieSafely(organizationId: string) {
  try {
    const jar = await cookies();
    jar.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (error) {
    logAuthContextWarning("unable to persist active org cookie in this render context", {
      organizationId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

async function resolveSessionIdentityFromAuth(): Promise<ResolvedSessionIdentity> {
  const session = await auth();
  const sessionUserId = session?.user?.id?.trim() || null;
  const email = session?.user?.email?.trim() || null;

  // Prefer a stable DB lookup by email for OAuth/JWT sessions.
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (byEmail?.id) {
      return { userId: byEmail.id, email, sessionUserId };
    }
  }

  // Fallback: use session user id only when it maps to a DB user.
  if (sessionUserId) {
    const byId = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });
    if (byId?.id) {
      return { userId: byId.id, email, sessionUserId };
    }
  }

  return { userId: null, email, sessionUserId };
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
      sessionUserId: identity.sessionUserId,
      hasEmail: Boolean(identity.email),
    });
  }

  return memberships;
}

async function findMembershipBySessionUserId(sessionUserId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId: sessionUserId },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  });

  if (memberships.length > 0) {
    logAuthContextWarning("using session user id fallback for org membership", {
      sessionUserId,
    });
  }

  return memberships;
}

async function resolveMembershipsFromAuth() {
  const identity = await resolveSessionIdentityFromAuth();
  let memberships = await listMembershipsForResolvedIdentity(identity);

  // Final fallback for legacy sessions where token user id is the DB user id.
  if (memberships.length === 0 && identity.sessionUserId && identity.sessionUserId !== identity.userId) {
    memberships = await findMembershipBySessionUserId(identity.sessionUserId);
    if (memberships.length > 0) {
      return { userId: identity.sessionUserId, memberships };
    }
  }

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

  if (fromCookie !== picked.organizationId) {
    await persistActiveOrgCookieSafely(picked.organizationId);
  }

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
