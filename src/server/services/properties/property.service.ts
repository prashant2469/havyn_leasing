import { Prisma } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import type {
  CreatePropertyInput,
  CreateUnitInput,
  UpdatePropertyInput,
  UpdateUnitInput,
} from "@/server/validation/property";

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
      units: { select: { id: true, status: true } },
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
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      parkingType: input.parkingType ?? null,
      parkingSpaces: input.parkingSpaces ?? null,
      laundryType: input.laundryType ?? null,
      yearBuilt: input.yearBuilt ?? null,
      propertyType: input.propertyType ?? null,
      neighborhood: input.neighborhood ?? null,
      transitNotes: input.transitNotes ?? null,
      schoolDistrict: input.schoolDistrict ?? null,
      petRules: (input.petRules ?? {}) as Prisma.InputJsonValue,
      amenities: (input.amenities ?? []) as Prisma.InputJsonValue,
      utilityNotes: input.utilityNotes ?? null,
      leaseTerms: (input.leaseTerms ?? {}) as Prisma.InputJsonValue,
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

export async function updateProperty(ctx: OrgContext, input: UpdatePropertyInput) {
  const existing = await prisma.property.findFirst({
    where: { id: input.id, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Property not found");

  const property = await prisma.property.update({
    where: { id: input.id },
    data: {
      name: input.name,
      street: input.street,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      status: input.status,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      parkingType: input.parkingType ?? null,
      parkingSpaces: input.parkingSpaces ?? null,
      laundryType: input.laundryType ?? null,
      yearBuilt: input.yearBuilt ?? null,
      propertyType: input.propertyType ?? null,
      neighborhood: input.neighborhood ?? null,
      transitNotes: input.transitNotes ?? null,
      schoolDistrict: input.schoolDistrict ?? null,
      petRules:
        input.petRules !== undefined
          ? (input.petRules as Prisma.InputJsonValue)
          : existing.petRules === null
            ? Prisma.JsonNull
            : (existing.petRules as Prisma.InputJsonValue),
      amenities:
        input.amenities !== undefined
          ? (input.amenities as Prisma.InputJsonValue)
          : existing.amenities === null
            ? Prisma.JsonNull
            : (existing.amenities as Prisma.InputJsonValue),
      utilityNotes: input.utilityNotes ?? null,
      leaseTerms:
        input.leaseTerms !== undefined
          ? (input.leaseTerms as Prisma.InputJsonValue)
          : existing.leaseTerms === null
            ? Prisma.JsonNull
            : (existing.leaseTerms as Prisma.InputJsonValue),
      showingSchedule:
        input.showingSchedule !== undefined
          ? (input.showingSchedule as Prisma.InputJsonValue)
          : existing.showingSchedule === null
            ? Prisma.JsonNull
            : (existing.showingSchedule as Prisma.InputJsonValue),
    },
  });

  await recordActivity({
    ctx,
    verb: "property.updated",
    entityType: "Property",
    entityId: property.id,
    payloadBefore: { name: existing.name, status: existing.status },
    payloadAfter: { name: property.name, status: property.status },
  });

  return property;
}

export async function deleteProperty(ctx: OrgContext, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: ctx.organizationId },
    include: { _count: { select: { units: true } } },
  });
  if (!property) throw new Error("Property not found");
  if (property._count.units > 0) {
    throw new Error("Delete all units before deleting this property.");
  }

  await prisma.property.delete({
    where: { id: propertyId },
  });

  await recordActivity({
    ctx,
    verb: "property.deleted",
    entityType: "Property",
    entityId: propertyId,
    payloadBefore: { name: property.name },
  });
}

export async function updateUnit(ctx: OrgContext, input: UpdateUnitInput) {
  const unit = await prisma.unit.findFirst({
    where: {
      id: input.id,
      propertyId: input.propertyId,
      property: { organizationId: ctx.organizationId },
    },
  });
  if (!unit) throw new Error("Unit not found");

  const updated = await prisma.unit.update({
    where: { id: input.id },
    data: {
      unitNumber: input.unitNumber,
      beds: input.beds ?? null,
      baths: input.baths ?? null,
      sqft: input.sqft ?? null,
      status: input.status,
    },
  });

  await recordActivity({
    ctx,
    verb: "unit.updated",
    entityType: "Unit",
    entityId: updated.id,
    metadata: { propertyId: input.propertyId },
  });

  return updated;
}
