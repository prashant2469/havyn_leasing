-- AIReplyDraft existed in the Prisma schema but had no prior migration (shadow DB replay).
-- Must run before 20260502130000_leasing_automation_workflow_foundation, which references this table.

CREATE TYPE "AIReplyDraftStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED', 'SENT', 'SUPERSEDED');

CREATE TABLE "AIReplyDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "suggestedChannel" "MessageChannel" NOT NULL DEFAULT 'IN_APP',
    "contextNote" TEXT,
    "automationConfidence" DOUBLE PRECISION,
    "status" "AIReplyDraftStatus" NOT NULL DEFAULT 'SUGGESTED',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sentMessageId" TEXT,
    "modelId" TEXT,
    "promptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIReplyDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIReplyDraft_sentMessageId_key" ON "AIReplyDraft"("sentMessageId");
CREATE INDEX "AIReplyDraft_organizationId_idx" ON "AIReplyDraft"("organizationId");
CREATE INDEX "AIReplyDraft_leadId_idx" ON "AIReplyDraft"("leadId");
CREATE INDEX "AIReplyDraft_conversationId_status_idx" ON "AIReplyDraft"("conversationId", "status");

ALTER TABLE "AIReplyDraft"
ADD CONSTRAINT "AIReplyDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIReplyDraft"
ADD CONSTRAINT "AIReplyDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIReplyDraft"
ADD CONSTRAINT "AIReplyDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIReplyDraft"
ADD CONSTRAINT "AIReplyDraft_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIReplyDraft"
ADD CONSTRAINT "AIReplyDraft_sentMessageId_fkey" FOREIGN KEY ("sentMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
