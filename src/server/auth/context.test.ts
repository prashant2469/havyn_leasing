import { MembershipRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    membership: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/db/client", () => ({
  prisma: prismaMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), getAll: vi.fn(() => []) })),
}));

import { getSessionUserId } from "./context";

describe("auth bootstrap membership", () => {
  beforeEach(() => {
    authMock.mockReset();
    prismaMock.user.findFirst.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.membership.count.mockReset();
    prismaMock.membership.create.mockReset();
    prismaMock.membership.findUnique.mockReset();
    prismaMock.organization.findFirst.mockReset();
    prismaMock.organization.count.mockReset();
    prismaMock.organization.create.mockReset();
  });

  it("does not auto-create owner membership in non-empty orgs", async () => {
    authMock.mockResolvedValue({ user: { email: "new@company.com" } });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.organization.findFirst.mockResolvedValue(null);
    prismaMock.organization.count.mockResolvedValue(1);

    const userId = await getSessionUserId();

    expect(userId).toBeNull();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.membership.create).not.toHaveBeenCalled();
  });

  it("promotes first signer to owner when an org has zero memberships", async () => {
    authMock.mockResolvedValue({ user: { email: "existing@company.com" } });
    prismaMock.user.findFirst.mockResolvedValue({ id: "user_1" });
    prismaMock.membership.count.mockResolvedValue(0);
    prismaMock.organization.findFirst.mockResolvedValue({ id: "org_empty" });

    const userId = await getSessionUserId();

    expect(userId).toBe("user_1");
    expect(prismaMock.membership.create).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        organizationId: "org_empty",
        role: MembershipRole.OWNER,
      },
    });
  });
});
