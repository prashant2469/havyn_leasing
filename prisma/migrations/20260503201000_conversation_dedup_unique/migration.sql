WITH ranked_conversations AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "leadId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS row_num
  FROM "Conversation"
  WHERE "leadId" IS NOT NULL
)
DELETE FROM "Conversation" c
USING ranked_conversations rc
WHERE c.id = rc.id
  AND rc.row_num > 1;

CREATE UNIQUE INDEX "Conversation_organizationId_leadId_key"
  ON "Conversation"("organizationId", "leadId");
