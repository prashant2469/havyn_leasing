CREATE TYPE "AutomationJobType" AS ENUM ('TOUR_REMINDER', 'LEAD_FOLLOW_UP_DUE');
CREATE TYPE "AutomationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "AutomationJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "AutomationJobType" NOT NULL,
  "status" "AutomationJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "runAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationJob_status_runAt_idx" ON "AutomationJob"("status", "runAt");
CREATE INDEX "AutomationJob_organizationId_status_idx" ON "AutomationJob"("organizationId", "status");

ALTER TABLE "AutomationJob"
  ADD CONSTRAINT "AutomationJob_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
