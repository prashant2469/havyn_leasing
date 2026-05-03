import { MembershipRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOrgContextMock, requirePermissionMock, revalidatePathMock, prismaMock } = vi.hoisted(() => ({
  requireOrgContextMock: vi.fn(),
  requirePermissionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/auth/context", () => ({
  requireOrgContext: requireOrgContextMock,
}));

vi.mock("@/server/auth/require-permission", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/server/db/client", () => ({
  prisma: prismaMock,
}));

import { resetTeamToOwnerOnlyAction } from "./team";

describe("resetTeamToOwnerOnlyAction", () => {
  beforeEach(() => {
    requireOrgContextMock.mockReset();
    requirePermissionMock.mockReset();
    revalidatePathMock.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("keeps current user and forces OWNER role", async () => {
    requireOrgContextMock.mockResolvedValue({
      organizationId: "org_1",
      userId: "user_1",
      role: MembershipRole.OWNER,
    });

    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const upsert = vi.fn().mockResolvedValue({});

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ membership: { deleteMany, upsert } }),
    );

    const result = await resetTeamToOwnerOnlyAction();

    expect(result.ok).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        userId: { not: "user_1" },
      },
    });
    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: "user_1",
          organizationId: "org_1",
        },
      },
      update: { role: MembershipRole.OWNER },
      create: {
        userId: "user_1",
        organizationId: "org_1",
        role: MembershipRole.OWNER,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
  });
});
