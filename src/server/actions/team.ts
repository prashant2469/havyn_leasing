"use server";

import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrgContext } from "@/server/auth/context";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { prisma } from "@/server/db/client";

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole),
});

const updateMemberRoleSchema = z.object({
  membershipId: z.string().cuid(),
  role: z.nativeEnum(MembershipRole),
});

const removeMemberSchema = z.object({
  membershipId: z.string().cuid(),
});

async function ensureOwnerNotRemoved(organizationId: string, priorRole: MembershipRole): Promise<void> {
  if (priorRole !== MembershipRole.OWNER) return;
  const ownerCount = await prisma.membership.count({
    where: { organizationId, role: MembershipRole.OWNER },
  });
  if (ownerCount <= 1) {
    throw new Error("Cannot remove the last owner from the organization.");
  }
}

function assertAdminRoleBoundary(
  actorRole: MembershipRole,
  currentRole: MembershipRole,
  nextRole?: MembershipRole,
): void {
  if (actorRole !== MembershipRole.ADMIN) return;
  const allowedTargetRoles = new Set([MembershipRole.MANAGER, MembershipRole.STAFF]);
  if (!allowedTargetRoles.has(currentRole)) {
    throw new Error("Admins can only manage manager or staff memberships.");
  }
  if (nextRole && !allowedTargetRoles.has(nextRole)) {
    throw new Error("Admins can only assign manager or staff roles.");
  }
}

export async function inviteTeamMemberAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.TEAM_INVITE);

    const input = inviteTeamMemberSchema.parse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      role: formData.get("role"),
    });

    if (ctx.role === MembershipRole.ADMIN && input.role !== MembershipRole.MANAGER && input.role !== MembershipRole.STAFF) {
      throw new Error("Admins can only invite manager or staff users.");
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
      select: { id: true },
    });

    const user =
      existingUser ??
      (await prisma.user.create({
        data: {
          email: input.email,
          name: input.email.split("@")[0] ?? input.email,
        },
        select: { id: true },
      }));

    const membershipExists = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: ctx.organizationId,
        },
      },
      select: { id: true },
    });

    if (membershipExists) {
      throw new Error("That user is already a member of this organization.");
    }

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: ctx.organizationId,
        role: input.role,
      },
    });

    revalidatePath("/settings");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite member";
    return { ok: false as const, message };
  }
}

export async function updateMemberRoleAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.TEAM_MANAGE_ROLES);

    const input = updateMemberRoleSchema.parse({
      membershipId: formData.get("membershipId"),
      role: formData.get("role"),
    });

    const membership = await prisma.membership.findFirst({
      where: { id: input.membershipId, organizationId: ctx.organizationId },
      select: { id: true, role: true },
    });
    if (!membership) throw new Error("Membership not found.");

    assertAdminRoleBoundary(ctx.role, membership.role, input.role);

    if (membership.role !== input.role) {
      await ensureOwnerNotRemoved(ctx.organizationId, membership.role);
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { role: input.role },
    });

    revalidatePath("/settings");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    return { ok: false as const, message };
  }
}

export async function removeMemberAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.TEAM_MANAGE_ROLES);

    const input = removeMemberSchema.parse({
      membershipId: formData.get("membershipId"),
    });

    const membership = await prisma.membership.findFirst({
      where: { id: input.membershipId, organizationId: ctx.organizationId },
      select: { id: true, role: true, userId: true },
    });
    if (!membership) throw new Error("Membership not found.");

    if (membership.userId === ctx.userId) {
      throw new Error("You cannot remove your own membership.");
    }

    assertAdminRoleBoundary(ctx.role, membership.role);
    await ensureOwnerNotRemoved(ctx.organizationId, membership.role);

    await prisma.membership.delete({ where: { id: membership.id } });

    revalidatePath("/settings");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    return { ok: false as const, message };
  }
}
