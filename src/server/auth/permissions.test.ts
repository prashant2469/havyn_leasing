import { MembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { Permission, hasPermission, listRolePermissions } from "./permissions";

describe("permissions matrix", () => {
  it("allows owners to invite team members", () => {
    expect(hasPermission(MembershipRole.OWNER, Permission.TEAM_INVITE)).toBe(true);
  });

  it("allows owners to manage team roles", () => {
    expect(hasPermission(MembershipRole.OWNER, Permission.TEAM_MANAGE_ROLES)).toBe(true);
  });

  it("denies manager invite access", () => {
    expect(hasPermission(MembershipRole.MANAGER, Permission.TEAM_INVITE)).toBe(false);
  });

  it("keeps staff permissions constrained", () => {
    const staffPerms = listRolePermissions(MembershipRole.STAFF);
    expect(staffPerms).toContain(Permission.LEADS_VIEW);
    expect(staffPerms).not.toContain(Permission.TEAM_INVITE);
    expect(staffPerms).not.toContain(Permission.TEAM_MANAGE_ROLES);
  });
});
