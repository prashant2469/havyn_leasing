import { prisma } from "@/server/db/client";

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
 * v1 dev stub: real auth replaces this. Never trust client-sent org IDs without membership checks.
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const organizationId = process.env.DEV_ORGANIZATION_ID?.trim();
  const userId = process.env.DEV_USER_ID?.trim();

  if (!organizationId || !userId) {
    throw new DevAuthError(
      "Set DEV_ORGANIZATION_ID and DEV_USER_ID in .env (run `npm run db:migrate` then `npm run db:seed`).",
    );
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });

  if (!membership) {
    throw new DevAuthError("No membership for DEV_USER_ID in DEV_ORGANIZATION_ID.");
  }

  return { organizationId, userId };
}

export async function tryOrgContext(): Promise<OrgContext | null> {
  try {
    return await requireOrgContext();
  } catch {
    return null;
  }
}
