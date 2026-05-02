-- V3 AI: enum used by AISuggestedAction; phase2 migration previously ALTERed this type
-- before it existed on a fresh shadow DB. Create the full enum here so later migrations are valid.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AISuggestedActionType') THEN
    CREATE TYPE "AISuggestedActionType" AS ENUM (
      'REPLY_NOW',
      'ASK_QUALIFICATION',
      'OFFER_TOUR_TIMES',
      'SHARE_RECOMMENDATIONS',
      'SCHEDULE_RECOMMENDED_TOUR',
      'SEND_APPLICATION_INVITE',
      'HAND_OFF_TO_HUMAN',
      'FOLLOW_UP_24H',
      'MARK_QUALIFIED',
      'OTHER'
    );
  ELSE
    -- Upgrade path: older DBs may have created the enum without recommendation tour values.
    ALTER TYPE "AISuggestedActionType" ADD VALUE IF NOT EXISTS 'SHARE_RECOMMENDATIONS';
    ALTER TYPE "AISuggestedActionType" ADD VALUE IF NOT EXISTS 'SCHEDULE_RECOMMENDED_TOUR';
  END IF;
END $$;
