-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('SUGGESTED', 'SHARED_WITH_PROSPECT', 'PROSPECT_INTERESTED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "AISuggestedActionType" ADD VALUE IF NOT EXISTS 'SHARE_RECOMMENDATIONS';
ALTER TYPE "AISuggestedActionType" ADD VALUE IF NOT EXISTS 'SCHEDULE_RECOMMENDED_TOUR';

-- AlterTable Property
ALTER TABLE "Property"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "parkingType" TEXT,
ADD COLUMN "parkingSpaces" INTEGER,
ADD COLUMN "laundryType" TEXT,
ADD COLUMN "yearBuilt" INTEGER,
ADD COLUMN "propertyType" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "transitNotes" TEXT,
ADD COLUMN "schoolDistrict" TEXT,
ADD COLUMN "petRules" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "amenities" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "utilityNotes" TEXT,
ADD COLUMN "leaseTerms" JSONB NOT NULL DEFAULT '{}';

-- AlterTable Tour
ALTER TABLE "Tour"
ADD COLUMN "propertyId" TEXT,
ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "rescheduledFrom" TEXT;

-- CreateTable GoogleCalendarConnection
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable PropertyRecommendation
CREATE TABLE "PropertyRecommendation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "status" "RecommendationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyRecommendation_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "GoogleCalendarConnection_organizationId_userId_key" ON "GoogleCalendarConnection"("organizationId", "userId");
CREATE INDEX "GoogleCalendarConnection_organizationId_idx" ON "GoogleCalendarConnection"("organizationId");
CREATE UNIQUE INDEX "PropertyRecommendation_leadId_listingId_key" ON "PropertyRecommendation"("leadId", "listingId");
CREATE INDEX "PropertyRecommendation_leadId_score_idx" ON "PropertyRecommendation"("leadId", "score");
CREATE INDEX "Tour_propertyId_idx" ON "Tour"("propertyId");

-- Foreign keys
ALTER TABLE "Tour"
ADD CONSTRAINT "Tour_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GoogleCalendarConnection"
ADD CONSTRAINT "GoogleCalendarConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoogleCalendarConnection"
ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyRecommendation"
ADD CONSTRAINT "PropertyRecommendation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyRecommendation"
ADD CONSTRAINT "PropertyRecommendation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
