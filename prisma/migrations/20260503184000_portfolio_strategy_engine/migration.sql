-- CreateEnum
CREATE TYPE "LeadStrategyBucket" AS ENUM (
  'TOUR_READY',
  'PROMISING_INCOMPLETE',
  'PORTFOLIO_CANDIDATE',
  'NURTURE',
  'WEAK_HOLD',
  'HUMAN_REQUIRED'
);

-- CreateEnum
CREATE TYPE "RecommendationIntent" AS ENUM (
  'ALTERNATIVE',
  'UPGRADE',
  'DOWNGRADE',
  'NEARBY'
);

-- AlterTable
ALTER TABLE "LeadStrengthSignal"
ADD COLUMN "strategyBucket" "LeadStrategyBucket" NOT NULL DEFAULT 'NURTURE',
ADD COLUMN "primaryListingFitScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PropertyRecommendation"
ADD COLUMN "tourReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recommendationIntent" "RecommendationIntent" NOT NULL DEFAULT 'ALTERNATIVE',
ADD COLUMN "sharedAt" TIMESTAMP(3),
ADD COLUMN "prospectResponseAt" TIMESTAMP(3);
