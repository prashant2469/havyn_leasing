import { MembershipRole } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";

/**
 * Resolves an org context for background jobs (Inngest): attributes actions to the first OWNER/ADMIN
 * in the org so audit trails stay valid. Not for end-user impersonation.
 */
export async function getAutomationOrgContext(organizationId: string): Promise<OrgContext> {
  const preferred = await prisma.membership.findFirst({
    where: {
      organizationId,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
    },
    orderBy: { createdAt: "asc" },
  });
  const membership =
    preferred ??
    (await prisma.membership.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    }));

  if (!membership) {
    throw new Error(`No membership found for organization ${organizationId}; cannot run automation.`);
  }

  return { organizationId, userId: membership.userId };
}
