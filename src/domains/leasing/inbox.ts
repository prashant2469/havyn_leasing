import { LeadInboxStage } from "@prisma/client";

export const inboxQueueOrder: LeadInboxStage[] = [
  LeadInboxStage.NEW_LEADS,
  LeadInboxStage.AWAITING_RESPONSE,
  LeadInboxStage.TOUR_SCHEDULED,
  LeadInboxStage.APPLICATION_STARTED,
  LeadInboxStage.NEEDS_HUMAN_REVIEW,
  LeadInboxStage.COLD_LEADS,
];

export const inboxStageLabel: Record<LeadInboxStage, string> = {
  NEW_LEADS: "New leads",
  AWAITING_RESPONSE: "Awaiting response",
  TOUR_SCHEDULED: "Tour scheduled",
  APPLICATION_STARTED: "Application started",
  NEEDS_HUMAN_REVIEW: "Needs human review",
  COLD_LEADS: "Cold leads",
};
