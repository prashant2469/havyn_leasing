import { LeadInboxStage } from "@prisma/client";

/** Left-nav order: first row merges `NEW_INQUIRY` + `NEW_LEADS` (same PM meaning: not yet contacted). */
export const COMBINED_NEW_NAV_ID = "combined_new" as const;

export type InboxNavId = typeof COMBINED_NEW_NAV_ID | LeadInboxStage;

export const inboxNavOrder: InboxNavId[] = [
  COMBINED_NEW_NAV_ID,
  LeadInboxStage.AWAITING_RESPONSE,
  LeadInboxStage.TOUR_SCHEDULED,
  LeadInboxStage.APPLICATION_STARTED,
  LeadInboxStage.NEEDS_HUMAN_REVIEW,
  LeadInboxStage.COLD_LEADS,
];

export const inboxBoardOrder: InboxNavId[] = [...inboxNavOrder];

export const stageColor: Record<InboxNavId, string> = {
  [COMBINED_NEW_NAV_ID]: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-900",
  [LeadInboxStage.NEW_INQUIRY]:
    "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-900",
  [LeadInboxStage.NEW_LEADS]:
    "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-900",
  [LeadInboxStage.AWAITING_RESPONSE]:
    "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900",
  [LeadInboxStage.TOUR_SCHEDULED]:
    "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/30 dark:border-cyan-900",
  [LeadInboxStage.APPLICATION_STARTED]:
    "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/30 dark:border-violet-900",
  [LeadInboxStage.NEEDS_HUMAN_REVIEW]:
    "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-900",
  [LeadInboxStage.COLD_LEADS]:
    "text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-300 dark:bg-slate-900/40 dark:border-slate-700",
};

/** @deprecated Prefer `inboxNavOrder` (single “New” row). Kept for code that iterates every DB stage. */
export const inboxQueueOrder: LeadInboxStage[] = [
  LeadInboxStage.NEW_INQUIRY,
  LeadInboxStage.NEW_LEADS,
  LeadInboxStage.AWAITING_RESPONSE,
  LeadInboxStage.TOUR_SCHEDULED,
  LeadInboxStage.APPLICATION_STARTED,
  LeadInboxStage.NEEDS_HUMAN_REVIEW,
  LeadInboxStage.COLD_LEADS,
];

export const inboxStageLabel: Record<LeadInboxStage, string> = {
  NEW_INQUIRY: "New (needs first message)",
  NEW_LEADS: "New (needs first message)",
  AWAITING_RESPONSE: "Contacted — waiting on renter",
  TOUR_SCHEDULED: "Tour scheduled",
  APPLICATION_STARTED: "Application started",
  NEEDS_HUMAN_REVIEW: "Needs human review",
  COLD_LEADS: "Cold leads",
};

export function stagesForInboxNavId(navId: InboxNavId): LeadInboxStage[] {
  if (navId === COMBINED_NEW_NAV_ID) {
    return [LeadInboxStage.NEW_INQUIRY, LeadInboxStage.NEW_LEADS];
  }
  return [navId];
}

export function labelForInboxNavId(navId: InboxNavId): string {
  if (navId === COMBINED_NEW_NAV_ID) {
    return "New (needs first message)";
  }
  return inboxStageLabel[navId];
}
