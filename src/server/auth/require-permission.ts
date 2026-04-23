import { MembershipRole } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { hasPermission, type Permission } from "@/server/auth/permissions";

export class ForbiddenError extends Error {
  readonly role: MembershipRole;
  readonly permission: Permission;

  constructor(role: MembershipRole, permission: Permission) {
    super(`Forbidden: missing permission "${permission}" for role "${role}".`);
    this.name = "ForbiddenError";
    this.role = role;
    this.permission = permission;
  }
}

export async function requirePermission(
  ctx: OrgContext,
  permission: Permission,
): Promise<void> {
  if (!hasPermission(ctx.role, permission)) {
    throw new ForbiddenError(ctx.role, permission);
  }
}
