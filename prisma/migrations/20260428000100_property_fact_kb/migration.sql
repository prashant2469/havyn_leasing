-- CreateEnum
CREATE TYPE "PropertyFactCategory" AS ENUM (
  'GENERAL',
  'FEES_AND_COSTS',
  'PET_POLICY',
  'PARKING',
  'UTILITIES',
  'AMENITIES',
  'LEASE_TERMS',
  'MOVE_IN',
  'MAINTENANCE',
  'RULES_AND_POLICIES',
  'NEIGHBORHOOD',
  'CUSTOM'
);

-- CreateTable
CREATE TABLE "PropertyFact" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "category" "PropertyFactCategory" NOT NULL DEFAULT 'GENERAL',
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyFact_organizationId_propertyId_idx" ON "PropertyFact"("organizationId", "propertyId");
CREATE INDEX "PropertyFact_propertyId_category_idx" ON "PropertyFact"("propertyId", "category");
CREATE INDEX "PropertyFact_unitId_category_idx" ON "PropertyFact"("unitId", "category");

-- AddForeignKey
ALTER TABLE "PropertyFact"
ADD CONSTRAINT "PropertyFact_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyFact"
ADD CONSTRAINT "PropertyFact_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyFact"
ADD CONSTRAINT "PropertyFact_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
