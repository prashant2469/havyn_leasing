import { Prisma, PropertyFactCategory } from "@prisma/client";

import { propertyFactCategoryLabel, propertyFactDefaultQuestions } from "@/domains/knowledge-base/categories";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import type {
  CreatePropertyFactInput,
  DeletePropertyFactInput,
  UpdatePropertyFactInput,
} from "@/server/validation/property-fact";

function normalizeQuestion(v: string) {
  return v.trim().toLowerCase();
}

async function getOrgProperty(ctx: OrgContext, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: ctx.organizationId },
  });
  if (!property) throw new Error("Property not found");
  return property;
}

async function getOrgUnit(ctx: OrgContext, unitId: string, propertyId: string) {
  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      propertyId,
      property: { organizationId: ctx.organizationId },
    },
  });
  if (!unit) throw new Error("Unit not found for this property");
  return unit;
}

export async function listFactsForProperty(ctx: OrgContext, propertyId: string) {
  await getOrgProperty(ctx, propertyId);
  return prisma.propertyFact.findMany({
    where: { organizationId: ctx.organizationId, propertyId },
    include: { unit: { select: { id: true, unitNumber: true } } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function listFactsForUnit(ctx: OrgContext, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { organizationId: ctx.organizationId } },
    select: { id: true, propertyId: true },
  });
  if (!unit) throw new Error("Unit not found");
  return prisma.propertyFact.findMany({
    where: {
      organizationId: ctx.organizationId,
      propertyId: unit.propertyId,
      OR: [{ unitId: null }, { unitId: unitId }],
    },
    include: { unit: { select: { id: true, unitNumber: true } } },
    orderBy: [{ unitId: "desc" }, { category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createPropertyFact(ctx: OrgContext, input: CreatePropertyFactInput) {
  await getOrgProperty(ctx, input.propertyId);
  if (input.unitId) await getOrgUnit(ctx, input.unitId, input.propertyId);

  const created = await prisma.propertyFact.create({
    data: {
      organizationId: ctx.organizationId,
      propertyId: input.propertyId,
      unitId: input.unitId ?? null,
      category: input.category,
      question: input.question.trim(),
      answer: input.answer.trim(),
      isPublic: input.isPublic,
      sortOrder: input.sortOrder,
    },
    include: { unit: { select: { id: true, unitNumber: true } } },
  });

  await logActivity({
    ctx,
    verb: "property_fact.created",
    entityType: "PropertyFact",
    entityId: created.id,
    metadata: {
      propertyId: input.propertyId,
      unitId: input.unitId ?? null,
      category: input.category,
    } as Prisma.InputJsonValue,
  });

  return created;
}

export async function updatePropertyFact(ctx: OrgContext, input: UpdatePropertyFactInput) {
  const existing = await prisma.propertyFact.findFirst({
    where: { id: input.id, propertyId: input.propertyId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Property fact not found");
  await getOrgProperty(ctx, input.propertyId);
  if (input.unitId) await getOrgUnit(ctx, input.unitId, input.propertyId);

  const updated = await prisma.propertyFact.update({
    where: { id: input.id },
    data: {
      unitId: input.unitId !== undefined ? input.unitId : undefined,
      category: input.category,
      question: input.question !== undefined ? input.question?.trim() : undefined,
      answer: input.answer !== undefined ? input.answer?.trim() : undefined,
      isPublic: input.isPublic,
      sortOrder: input.sortOrder,
    },
    include: { unit: { select: { id: true, unitNumber: true } } },
  });

  await logActivity({
    ctx,
    verb: "property_fact.updated",
    entityType: "PropertyFact",
    entityId: updated.id,
    payloadBefore: {
      category: existing.category,
      question: existing.question,
      answer: existing.answer,
      isPublic: existing.isPublic,
      sortOrder: existing.sortOrder,
      unitId: existing.unitId,
    } as Prisma.InputJsonValue,
    payloadAfter: {
      category: updated.category,
      question: updated.question,
      answer: updated.answer,
      isPublic: updated.isPublic,
      sortOrder: updated.sortOrder,
      unitId: updated.unitId,
    } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function deletePropertyFact(ctx: OrgContext, input: DeletePropertyFactInput) {
  const existing = await prisma.propertyFact.findFirst({
    where: { id: input.id, propertyId: input.propertyId, organizationId: ctx.organizationId },
  });
  if (!existing) throw new Error("Property fact not found");

  await prisma.propertyFact.delete({ where: { id: input.id } });

  await logActivity({
    ctx,
    verb: "property_fact.deleted",
    entityType: "PropertyFact",
    entityId: input.id,
    payloadBefore: {
      question: existing.question,
      category: existing.category,
      unitId: existing.unitId,
    } as Prisma.InputJsonValue,
  });
}

export async function seedDefaultPropertyFacts(
  ctx: OrgContext,
  propertyId: string,
  options?: { overwriteEmptyAnswers?: boolean },
) {
  await getOrgProperty(ctx, propertyId);
  const existing = await prisma.propertyFact.findMany({
    where: { organizationId: ctx.organizationId, propertyId, unitId: null },
    select: { id: true, category: true, question: true, answer: true },
  });
  const existingByKey = new Map(
    existing.map((f) => [`${f.category}::${normalizeQuestion(f.question)}`, f]),
  );
  let createdCount = 0;
  let updatedCount = 0;

  for (const [category, questions] of Object.entries(
    propertyFactDefaultQuestions,
  ) as Array<[PropertyFactCategory, string[]]>) {
    for (const question of questions) {
      const key = `${category}::${normalizeQuestion(question)}`;
      const matched = existingByKey.get(key);
      if (!matched) {
        await prisma.propertyFact.create({
          data: {
            organizationId: ctx.organizationId,
            propertyId,
            unitId: null,
            category,
            question,
            answer: "",
            isPublic: true,
            sortOrder: 0,
          },
        });
        createdCount += 1;
        continue;
      }
      if (options?.overwriteEmptyAnswers && !matched.answer.trim()) {
        await prisma.propertyFact.update({
          where: { id: matched.id },
          data: { question },
        });
        updatedCount += 1;
      }
    }
  }

  await logActivity({
    ctx,
    verb: "property_fact.seeded_defaults",
    entityType: "Property",
    entityId: propertyId,
    metadata: { createdCount, updatedCount } as Prisma.InputJsonValue,
  });

  return { createdCount, updatedCount };
}

export async function importStructuredPropertyFacts(
  ctx: OrgContext,
  propertyId: string,
  options?: { overwriteExistingQuestions?: boolean },
) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: ctx.organizationId },
  });
  if (!property) throw new Error("Property not found");

  const petRules =
    property.petRules && typeof property.petRules === "object" && !Array.isArray(property.petRules)
      ? (property.petRules as Record<string, unknown>)
      : {};
  const leaseTerms =
    property.leaseTerms &&
    typeof property.leaseTerms === "object" &&
    !Array.isArray(property.leaseTerms)
      ? (property.leaseTerms as Record<string, unknown>)
      : {};
  const amenities = Array.isArray(property.amenities)
    ? property.amenities.map((a) => String(a))
    : [];

  const facts: Array<{ category: PropertyFactCategory; question: string; answer: string }> = [];
  if (property.parkingType || property.parkingSpaces != null) {
    facts.push({
      category: PropertyFactCategory.PARKING,
      question: "What parking options are available?",
      answer: [property.parkingType, property.parkingSpaces != null ? `${property.parkingSpaces} spaces` : null]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (property.laundryType) {
    facts.push({
      category: PropertyFactCategory.AMENITIES,
      question: "What laundry setup is available?",
      answer: property.laundryType,
    });
  }
  if (property.utilityNotes?.trim()) {
    facts.push({
      category: PropertyFactCategory.UTILITIES,
      question: "How are utilities handled?",
      answer: property.utilityNotes.trim(),
    });
  }
  if (amenities.length > 0) {
    facts.push({
      category: PropertyFactCategory.AMENITIES,
      question: "What amenities are available?",
      answer: amenities.join(", "),
    });
  }
  if (
    leaseTerms.minMonths != null ||
    leaseTerms.maxMonths != null ||
    leaseTerms.preferredMonths != null
  ) {
    facts.push({
      category: PropertyFactCategory.LEASE_TERMS,
      question: "What lease terms are available?",
      answer: [
        leaseTerms.minMonths != null ? `Min ${leaseTerms.minMonths} months` : null,
        leaseTerms.maxMonths != null ? `Max ${leaseTerms.maxMonths} months` : null,
        leaseTerms.preferredMonths != null ? `Preferred ${leaseTerms.preferredMonths} months` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  const dogs = petRules.dogs === true ? "Dogs allowed" : petRules.dogs === false ? "Dogs not allowed" : null;
  const cats = petRules.cats === true ? "Cats allowed" : petRules.cats === false ? "Cats not allowed" : null;
  const maxWeight =
    typeof petRules.maxWeight === "number" ? `Max weight ${petRules.maxWeight} lbs` : null;
  const deposit = typeof petRules.deposit === "number" ? `Deposit $${petRules.deposit}` : null;
  const monthlyFee =
    typeof petRules.monthlyFee === "number" ? `Monthly pet fee $${petRules.monthlyFee}` : null;
  const petSummary = [dogs, cats, maxWeight, deposit, monthlyFee].filter(Boolean).join(" · ");
  if (petSummary) {
    facts.push({
      category: PropertyFactCategory.PET_POLICY,
      question: "What is the pet policy?",
      answer: petSummary,
    });
  }

  const existing = await prisma.propertyFact.findMany({
    where: { organizationId: ctx.organizationId, propertyId, unitId: null },
    select: { id: true, category: true, question: true },
  });
  const existingMap = new Map(
    existing.map((f) => [`${f.category}::${normalizeQuestion(f.question)}`, f]),
  );

  let createdCount = 0;
  let updatedCount = 0;
  for (const fact of facts) {
    if (!fact.answer.trim()) continue;
    const key = `${fact.category}::${normalizeQuestion(fact.question)}`;
    const matched = existingMap.get(key);
    if (!matched) {
      await prisma.propertyFact.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId,
          category: fact.category,
          question: fact.question,
          answer: fact.answer,
          isPublic: true,
          sortOrder: 0,
        },
      });
      createdCount += 1;
      continue;
    }
    if (options?.overwriteExistingQuestions) {
      await prisma.propertyFact.update({
        where: { id: matched.id },
        data: { answer: fact.answer },
      });
      updatedCount += 1;
    }
  }

  await logActivity({
    ctx,
    verb: "property_fact.imported_structured",
    entityType: "Property",
    entityId: propertyId,
    metadata: { createdCount, updatedCount } as Prisma.InputJsonValue,
  });

  return { createdCount, updatedCount };
}

export async function getFactsForAI(
  ctx: OrgContext,
  input: { propertyId: string; unitId?: string | null; maxFacts?: number },
) {
  await getOrgProperty(ctx, input.propertyId);
  if (input.unitId) await getOrgUnit(ctx, input.unitId, input.propertyId);

  const rows = await prisma.propertyFact.findMany({
    where: {
      organizationId: ctx.organizationId,
      propertyId: input.propertyId,
      isPublic: true,
      answer: { not: "" },
      OR: [{ unitId: null }, ...(input.unitId ? [{ unitId: input.unitId }] : [])],
    },
    include: { unit: { select: { id: true, unitNumber: true } } },
    orderBy: [{ unitId: "desc" }, { category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: input.maxFacts ?? 30,
  });

  const facts = rows.map((r) => ({
    id: r.id,
    category: r.category,
    categoryLabel: propertyFactCategoryLabel[r.category],
    question: r.question,
    answer: r.answer,
    scopeLabel: r.unit ? `Unit ${r.unit.unitNumber}` : "Property",
  }));

  const promptBlock =
    facts.length === 0
      ? ""
      : `Property facts (verified):\n${facts
          .map((f) => `- [${f.scopeLabel} • ${f.categoryLabel}] ${f.question}: ${f.answer}`)
          .join("\n")}`;

  return { facts, promptBlock };
}
