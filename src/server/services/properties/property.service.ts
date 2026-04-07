import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type { CreatePropertyInput, CreateUnitInput } from "@/server/validation/property";

export async function listUnitsForOrg(ctx: OrgContext) {
  return prisma.unit.findMany({
    where: { property: { organizationId: ctx.organizationId } },
    orderBy: [{ property: { name: "asc" } }, { unitNumber: "asc" }],
    include: { property: { select: { id: true, name: true } } },
  });
}

export async function listProperties(ctx: OrgContext) {
  return prisma.property.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { units: true } },
    },
  });
}

export async function getPropertyById(ctx: OrgContext, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: ctx.organizationId },
    include: {
      units: { orderBy: { unitNumber: "asc" } },
    },
  });
  return property;
}

export async function createProperty(ctx: OrgContext, input: CreatePropertyInput) {
  const property = await prisma.property.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name,
      street: input.street,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country ?? "US",
      status: input.status,
    },
  });

  await recordActivity({
    ctx,
    verb: "property.created",
    entityType: "Property",
    entityId: property.id,
    payloadAfter: { name: property.name, city: property.city },
  });

  return property;
}

export async function createUnit(ctx: OrgContext, input: CreateUnitInput) {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, organizationId: ctx.organizationId },
  });
  if (!property) throw new Error("Property not found");

  const unit = await prisma.unit.create({
    data: {
      propertyId: input.propertyId,
      unitNumber: input.unitNumber,
      beds: input.beds,
      baths: input.baths,
      sqft: input.sqft,
    },
  });

  await recordActivity({
    ctx,
    verb: "unit.created",
    entityType: "Unit",
    entityId: unit.id,
    metadata: { propertyId: property.id, unitNumber: unit.unitNumber },
  });

  return unit;
}
