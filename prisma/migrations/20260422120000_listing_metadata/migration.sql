-- AlterTable
ALTER TABLE "Listing"
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
