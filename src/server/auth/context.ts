import { cookies } from "next/headers";

import { auth } from "@/auth";
import { prisma } from "@/server/db/client";

import { ACTIVE_ORG_COOKIE } from "./constants";

export type OrgContext = {
  organizationId: string;
  userId: string;
};

export class DevAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevAuthError";
  }
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
      });
      if (membership) {
        return { organizationId: devOrg, userId: devUser };
      }
    }
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new DevAuthError("Not signed in.");
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  });

  if (memberships.length === 0) {
    throw new DevAuthError("Your account has no organization memberships.");
  }

  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_ORG_COOKIE)?.value?.trim();
  const picked =
    (fromCookie ? memberships.find((m) => m.organizationId === fromCookie) : null) ??
    memberships[0]!;

  return { organizationId: picked.organizationId, userId };
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
  const session = await auth();
  return session?.user?.id ?? null;
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
