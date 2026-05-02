-- Leasing automation workflow foundation:
-- - new lead automation mode enum/column
-- - new inbound intent enum
-- - new lead strength tier enum + table
-- - draft automation confidence

CREATE TYPE "LeadAutomationMode" AS ENUM ('AUTO', 'DRAFT_REVIEW', 'MANUAL');

CREATE TYPE "InboundIntentType" AS ENUM (
  'PROPERTY_QUESTION',
  'TOUR_INTEREST',
  'TOUR_CONFIRMATION',
  'APPLICATION_QUESTION',
  'QUALIFICATION_RESPONSE',
  'GENERAL_INQUIRY',
  'COMPLAINT',
  'ACKNOWLEDGMENT',
  'SENSITIVE'
);

CREATE TYPE "LeadStrengthTier" AS ENUM ('STRONG', 'PROMISING', 'UNCERTAIN', 'WEAK', 'DISQUALIFIED');

ALTER TABLE "Lead"
ADD COLUMN "automationMode" "LeadAutomationMode" NOT NULL DEFAULT 'AUTO';

-- automationConfidence is created on AIReplyDraft in migration 20260502125500_ai_reply_draft_table_foundation

CREATE TABLE "LeadStrengthSignal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "strengthTier" "LeadStrengthTier" NOT NULL DEFAULT 'UNCERTAIN',
  "overallScore" DOUBLE PRECISION NOT NULL,
  "financialFitScore" DOUBLE PRECISION NOT NULL,
  "intentScore" DOUBLE PRECISION NOT NULL,
  "completenessScore" DOUBLE PRECISION NOT NULL,
  "budgetToRentRatio" DOUBLE PRECISION,
  "latestIntent" "InboundIntentType",
  "reasons" JSONB NOT NULL DEFAULT '[]',
  "modelId" TEXT,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadStrengthSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadStrengthSignal_leadId_key" ON "LeadStrengthSignal"("leadId");
CREATE INDEX "LeadStrengthSignal_organizationId_strengthTier_idx" ON "LeadStrengthSignal"("organizationId", "strengthTier");

ALTER TABLE "LeadStrengthSignal"
ADD CONSTRAINT "LeadStrengthSignal_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadStrengthSignal"
ADD CONSTRAINT "LeadStrengthSignal_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
