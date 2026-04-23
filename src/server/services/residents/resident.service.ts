import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type { CreateResidentInput } from "@/server/validation/resident";

export async function listResidents(ctx: OrgContext) {
  return prisma.resident.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function createResident(ctx: OrgContext, input: CreateResidentInput) {
  const resident = await prisma.resident.create({
    data: {
      organizationId: ctx.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
    },
  });

  await recordActivity({
    ctx,
    verb: "resident.created",
    entityType: "Resident",
    entityId: resident.id,
    payloadAfter: { name: `${resident.firstName} ${resident.lastName}` },
  });

  return resident;
}

export async function findResidentByEmail(ctx: OrgContext, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return prisma.resident.findFirst({
    where: { organizationId: ctx.organizationId, email: { equals: normalized, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });
}
