-- Listing hub: init migration predates Listing; later migrations ALTER Listing.
-- This migration creates Listing (and enum) so the chain applies cleanly on a shadow DB.

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'RENTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "bedrooms" DOUBLE PRECISION,
    "bathrooms" DOUBLE PRECISION,
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "petPolicy" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "offMarketAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_organizationId_status_idx" ON "Listing"("organizationId", "status");
CREATE INDEX "Listing_unitId_idx" ON "Listing"("unitId");

-- AddForeignKey
ALTER TABLE "Listing"
ADD CONSTRAINT "Listing_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Listing"
ADD CONSTRAINT "Listing_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
