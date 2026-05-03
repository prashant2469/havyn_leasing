-- Remove legacy tables that are no longer represented in Prisma schema.
DROP TABLE IF EXISTS "PaymentAllocation" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "Charge" CASCADE;
DROP TABLE IF EXISTS "AiSuggestion" CASCADE;

-- Remove legacy enums tied to dropped tables.
DROP TYPE IF EXISTS "ChargeType";
DROP TYPE IF EXISTS "ChargeStatus";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "AiSuggestionKind";
DROP TYPE IF EXISTS "AiSuggestionStatus";

-- Idempotency: prevent duplicate provider message rows when externalId exists.
CREATE UNIQUE INDEX IF NOT EXISTS "Message_externalId_unique_nonnull"
  ON "Message"("externalId")
  WHERE "externalId" IS NOT NULL;

-- Support thread lookups for channel adapters and provider callbacks.
CREATE INDEX IF NOT EXISTS "Conversation_org_channel_thread_idx"
  ON "Conversation"("organizationId", "channelType", "externalThreadId");

-- Follow-up queue scans by due date per organization.
CREATE INDEX IF NOT EXISTS "Lead_org_nextActionAt_idx"
  ON "Lead"("organizationId", "nextActionAt");
