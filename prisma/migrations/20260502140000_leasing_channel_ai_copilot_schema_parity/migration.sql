-- Align DB with Prisma schema: listing channels, inbox/qualification, Message/Conversation/Lead/Tour
-- extensions, and AI Copilot V3 tables (previously only in schema / db push).

-- --- Enums ---
CREATE TYPE "ListingChannelType" AS ENUM (
  'WEBSITE',
  'ZILLOW',
  'FACEBOOK_MARKETPLACE',
  'EMAIL',
  'SMS',
  'MANUAL',
  'OTHER'
);

CREATE TYPE "ChannelPublishStatus" AS ENUM (
  'NOT_CONNECTED',
  'PENDING',
  'LIVE',
  'ERROR',
  'PAUSED'
);

CREATE TYPE "ChannelPublishState" AS ENUM (
  'DRAFT',
  'QUEUED',
  'PUBLISHED',
  'PAUSED',
  'UNPUBLISHED',
  'SYNC_ERROR'
);

CREATE TYPE "ConversationReplyMode" AS ENUM (
  'IN_CHANNEL_REPLY',
  'REDIRECT_TO_OWNED_CHANNEL',
  'MANUAL_ONLY'
);

CREATE TYPE "ChannelSyncStatus" AS ENUM (
  'IDLE',
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE "ChannelSyncOperation" AS ENUM (
  'PUBLISH',
  'UPDATE',
  'UNPUBLISH',
  'RETRY',
  'INGEST_TEST'
);

CREATE TYPE "LeadInboxStage" AS ENUM (
  'NEW_INQUIRY',
  'NEW_LEADS',
  'AWAITING_RESPONSE',
  'TOUR_SCHEDULED',
  'APPLICATION_STARTED',
  'NEEDS_HUMAN_REVIEW',
  'COLD_LEADS'
);

CREATE TYPE "QualificationSource" AS ENUM ('MANUAL', 'AI_EXTRACTED', 'IMPORTED');

CREATE TYPE "AIActionType" AS ENUM (
  'DRAFT_REPLY',
  'CONVERSATION_SUMMARY',
  'SUGGESTED_NEXT_ACTION',
  'QUALIFICATION_EXTRACT',
  'ESCALATION_FLAG'
);

CREATE TYPE "AIActionStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'DISMISSED'
);

CREATE TYPE "AIUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "AISuggestedActionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

CREATE TYPE "AIEscalationReason" AS ENUM (
  'POLICY_EXCEPTION',
  'UPSET_LEAD',
  'UNCLEAR_INTENT',
  'UNSUPPORTED_CHANNEL_REPLY',
  'LOW_CONFIDENCE',
  'COMPLEX_SITUATION',
  'URGENT_RESPONSE_NEEDED'
);

CREATE TYPE "AIEscalationStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'FALSE_POSITIVE'
);

CREATE TYPE "LeadPriorityTier" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW', 'COLD');

-- --- Extend existing enums ---
ALTER TYPE "MessageChannel" ADD VALUE IF NOT EXISTS 'OTHER';
ALTER TYPE "MessageAuthorType" ADD VALUE IF NOT EXISTS 'AI';
ALTER TYPE "CommunicationEventType" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "CommunicationEventType" ADD VALUE IF NOT EXISTS 'UNDELIVERED';

-- --- Property (touring schedule JSON) ---
ALTER TABLE "Property"
ADD COLUMN "showingSchedule" JSONB NOT NULL DEFAULT '{}';

-- --- Lead (inbox + attribution + automation flags) ---
ALTER TABLE "Lead"
ADD COLUMN "listingId" TEXT,
ADD COLUMN "sourceChannelType" "ListingChannelType",
ADD COLUMN "sourceChannelRefId" TEXT,
ADD COLUMN "sourceAttribution" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "firstResponseAt" TIMESTAMP(3),
ADD COLUMN "lastResponseAt" TIMESTAMP(3),
ADD COLUMN "tourBookedAt" TIMESTAMP(3),
ADD COLUMN "applicationStartedAt" TIMESTAMP(3),
ADD COLUMN "convertedAt" TIMESTAMP(3),
ADD COLUMN "inboxStage" "LeadInboxStage" NOT NULL DEFAULT 'NEW_INQUIRY',
ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "automationPaused" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Lead_listingId_idx" ON "Lead"("listingId");
CREATE INDEX "Lead_organizationId_inboxStage_idx" ON "Lead"("organizationId", "inboxStage");
CREATE INDEX "Lead_sourceChannelType_idx" ON "Lead"("sourceChannelType");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --- Conversation (V2 channel envelope) ---
ALTER TABLE "Conversation"
ADD COLUMN "listingId" TEXT,
ADD COLUMN "channelType" "ListingChannelType",
ADD COLUMN "replyMode" "ConversationReplyMode" NOT NULL DEFAULT 'MANUAL_ONLY',
ADD COLUMN "externalThreadId" TEXT,
ADD COLUMN "externalConversationRef" TEXT,
ADD COLUMN "sourceMetadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");
CREATE INDEX "Conversation_channelType_idx" ON "Conversation"("channelType");

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --- Message (AI + channel metadata) ---
ALTER TABLE "Message"
ADD COLUMN "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "channelMetadata" JSONB NOT NULL DEFAULT '{}';

-- --- Tour (listing link) ---
ALTER TABLE "Tour"
ADD COLUMN "listingId" TEXT;

CREATE INDEX "Tour_listingId_idx" ON "Tour"("listingId");

ALTER TABLE "Tour"
ADD CONSTRAINT "Tour_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --- Listing hub: photos + channels ---
CREATE TABLE "ListingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingPhoto_listingId_sortOrder_idx" ON "ListingPhoto"("listingId", "sortOrder");

ALTER TABLE "ListingPhoto"
ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ListingChannel" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "channelType" "ListingChannelType" NOT NULL,
    "publishStatus" "ChannelPublishStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "publishState" "ChannelPublishState" NOT NULL DEFAULT 'DRAFT',
    "externalListingId" TEXT,
    "replyModeDefault" "ConversationReplyMode" NOT NULL DEFAULT 'MANUAL_ONLY',
    "lastSyncedAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "lastUnpublishedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingChannel_listingId_channelType_key" ON "ListingChannel"("listingId", "channelType");
CREATE INDEX "ListingChannel_listingId_idx" ON "ListingChannel"("listingId");
CREATE INDEX "ListingChannel_publishState_idx" ON "ListingChannel"("publishState");

ALTER TABLE "ListingChannel"
ADD CONSTRAINT "ListingChannel_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ListingChannelSync" (
    "id" TEXT NOT NULL,
    "listingChannelId" TEXT NOT NULL,
    "operation" "ChannelSyncOperation" NOT NULL DEFAULT 'PUBLISH',
    "status" "ChannelSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "requestPayload" JSONB NOT NULL DEFAULT '{}',
    "resultPayload" JSONB NOT NULL DEFAULT '{}',
    "requestedByUserId" TEXT,

    CONSTRAINT "ListingChannelSync_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingChannelSync_listingChannelId_startedAt_idx" ON "ListingChannelSync"("listingChannelId", "startedAt");
CREATE INDEX "ListingChannelSync_requestedByUserId_idx" ON "ListingChannelSync"("requestedByUserId");

ALTER TABLE "ListingChannelSync"
ADD CONSTRAINT "ListingChannelSync_listingChannelId_fkey" FOREIGN KEY ("listingChannelId") REFERENCES "ListingChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingChannelSync"
ADD CONSTRAINT "ListingChannelSync_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --- Contact identity + qualification ---
CREATE TABLE "ContactChannelIdentity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channelType" "ListingChannelType" NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "externalId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactChannelIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactChannelIdentity_leadId_channelType_handle_key" ON "ContactChannelIdentity"("leadId", "channelType", "handle");
CREATE INDEX "ContactChannelIdentity_leadId_idx" ON "ContactChannelIdentity"("leadId");
CREATE INDEX "ContactChannelIdentity_channelType_handle_idx" ON "ContactChannelIdentity"("channelType", "handle");

ALTER TABLE "ContactChannelIdentity"
ADD CONSTRAINT "ContactChannelIdentity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QualificationAnswer" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" "QualificationSource" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualificationAnswer_leadId_key_key" ON "QualificationAnswer"("leadId", "key");
CREATE INDEX "QualificationAnswer_leadId_idx" ON "QualificationAnswer"("leadId");

ALTER TABLE "QualificationAnswer"
ADD CONSTRAINT "QualificationAnswer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- Human handoff + AI actions (seed uses these) ---
CREATE TABLE "HumanHandoffEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanHandoffEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HumanHandoffEvent_organizationId_createdAt_idx" ON "HumanHandoffEvent"("organizationId", "createdAt");
CREATE INDEX "HumanHandoffEvent_leadId_idx" ON "HumanHandoffEvent"("leadId");

ALTER TABLE "HumanHandoffEvent"
ADD CONSTRAINT "HumanHandoffEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HumanHandoffEvent"
ADD CONSTRAINT "HumanHandoffEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HumanHandoffEvent"
ADD CONSTRAINT "HumanHandoffEvent_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HumanHandoffEvent"
ADD CONSTRAINT "HumanHandoffEvent_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AIAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conversationId" TEXT,
    "type" "AIActionType" NOT NULL,
    "status" "AIActionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "content" JSONB NOT NULL DEFAULT '{}',
    "modelId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIAction_organizationId_status_idx" ON "AIAction"("organizationId", "status");
CREATE INDEX "AIAction_leadId_idx" ON "AIAction"("leadId");
CREATE INDEX "AIAction_conversationId_idx" ON "AIAction"("conversationId");

ALTER TABLE "AIAction"
ADD CONSTRAINT "AIAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAction"
ADD CONSTRAINT "AIAction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAction"
ADD CONSTRAINT "AIAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIAction"
ADD CONSTRAINT "AIAction_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --- V3 structured AI (schema parity; optional at runtime) ---
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "currentIntent" TEXT,
    "urgency" "AIUrgency" NOT NULL DEFAULT 'NORMAL',
    "qualificationGaps" JSONB NOT NULL DEFAULT '[]',
    "recommendedNextStep" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "modelId" TEXT,
    "promptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationSummary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationSummary_organizationId_idx" ON "ConversationSummary"("organizationId");
CREATE INDEX "ConversationSummary_leadId_idx" ON "ConversationSummary"("leadId");
CREATE INDEX "ConversationSummary_conversationId_generatedAt_idx" ON "ConversationSummary"("conversationId", "generatedAt");

ALTER TABLE "ConversationSummary"
ADD CONSTRAINT "ConversationSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationSummary"
ADD CONSTRAINT "ConversationSummary_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationSummary"
ADD CONSTRAINT "ConversationSummary_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AISuggestedAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conversationId" TEXT,
    "actionType" "AISuggestedActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "AISuggestedActionStatus" NOT NULL DEFAULT 'PENDING',
    "actionedByUserId" TEXT,
    "actionedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISuggestedAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AISuggestedAction_organizationId_idx" ON "AISuggestedAction"("organizationId");
CREATE INDEX "AISuggestedAction_leadId_idx" ON "AISuggestedAction"("leadId");
CREATE INDEX "AISuggestedAction_status_idx" ON "AISuggestedAction"("status");

ALTER TABLE "AISuggestedAction"
ADD CONSTRAINT "AISuggestedAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AISuggestedAction"
ADD CONSTRAINT "AISuggestedAction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AISuggestedAction"
ADD CONSTRAINT "AISuggestedAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AISuggestedAction"
ADD CONSTRAINT "AISuggestedAction_actionedByUserId_fkey" FOREIGN KEY ("actionedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AIEscalationFlag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conversationId" TEXT,
    "reason" "AIEscalationReason" NOT NULL,
    "notes" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "status" "AIEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIEscalationFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIEscalationFlag_organizationId_status_idx" ON "AIEscalationFlag"("organizationId", "status");
CREATE INDEX "AIEscalationFlag_leadId_idx" ON "AIEscalationFlag"("leadId");

ALTER TABLE "AIEscalationFlag"
ADD CONSTRAINT "AIEscalationFlag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIEscalationFlag"
ADD CONSTRAINT "AIEscalationFlag_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIEscalationFlag"
ADD CONSTRAINT "AIEscalationFlag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIEscalationFlag"
ADD CONSTRAINT "AIEscalationFlag_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeadPrioritySignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "priorityTier" "LeadPriorityTier" NOT NULL DEFAULT 'NORMAL',
    "signals" JSONB NOT NULL DEFAULT '[]',
    "scoreRaw" DOUBLE PRECISION,
    "isHotLead" BOOLEAN NOT NULL DEFAULT false,
    "isAtRisk" BOOLEAN NOT NULL DEFAULT false,
    "needsImmediateResponse" BOOLEAN NOT NULL DEFAULT false,
    "isQualifiedForTour" BOOLEAN NOT NULL DEFAULT false,
    "modelId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadPrioritySignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadPrioritySignal_leadId_key" ON "LeadPrioritySignal"("leadId");
CREATE INDEX "LeadPrioritySignal_organizationId_priorityTier_idx" ON "LeadPrioritySignal"("organizationId", "priorityTier");

ALTER TABLE "LeadPrioritySignal"
ADD CONSTRAINT "LeadPrioritySignal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadPrioritySignal"
ADD CONSTRAINT "LeadPrioritySignal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
