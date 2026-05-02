-- AlterEnum
ALTER TYPE "CommunicationEventType" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "CommunicationEventType" ADD VALUE IF NOT EXISTS 'UNDELIVERED';

-- CreateEnum
CREATE TYPE "SmsConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT');

-- CreateTable
CREATE TABLE "SmsConsent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "status" "SmsConsentStatus" NOT NULL DEFAULT 'OPTED_IN',
  "optOutAt" TIMESTAMP(3),
  "optOutKeyword" TEXT,
  "optInAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmsConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsConsent_organizationId_phone_key" ON "SmsConsent"("organizationId", "phone");
CREATE INDEX "SmsConsent_phone_idx" ON "SmsConsent"("phone");

-- AddForeignKey
ALTER TABLE "SmsConsent"
ADD CONSTRAINT "SmsConsent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
