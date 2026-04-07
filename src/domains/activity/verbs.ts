/**
 * Standard activity verbs for {@link recordActivity}.
 * Keeps analytics, webhooks, and audit filters consistent.
 */
export const ActivityVerbs = {
  // Listings
  LISTING_CREATED: "listing.created",
  LISTING_UPDATED: "listing.updated",
  LISTING_CHANNEL_ATTACHED: "listing.channel_attached",

  // V2 Channel publish lifecycle
  LISTING_CHANNEL_PUBLISH_REQUESTED: "listing.channel_publish_requested",
  LISTING_CHANNEL_PUBLISHED: "listing.channel_published",
  LISTING_CHANNEL_PUBLISH_FAILED: "listing.channel_publish_failed",
  LISTING_CHANNEL_PAUSED: "listing.channel_paused",
  LISTING_CHANNEL_UNPUBLISHED: "listing.channel_unpublished",
  LISTING_CHANNEL_RETRY_REQUESTED: "listing.channel_retry_requested",
  LISTING_CHANNEL_SYNC_COMPLETED: "listing.channel_sync_completed",
  LISTING_CHANNEL_SYNC_FAILED: "listing.channel_sync_failed",

  // Leads / inquiries
  LEAD_CREATED: "lead.created",
  LEAD_INBOX_STAGE_CHANGED: "lead.inbox_stage_changed",
  LEAD_SOURCE_ATTRIBUTED: "lead.source_attributed",

  // V2 Inquiry ingestion
  INQUIRY_INGESTED: "inquiry.ingested",

  // Communications
  MESSAGE_RECEIVED: "message.received",
  MESSAGE_SENT: "message.sent",

  // V2 Reply strategy
  CONVERSATION_REPLY_MODE_CHANGED: "conversation.reply_mode_changed",

  // AI Copilot (legacy V1)
  AI_ACTION_CREATED: "ai.action_created",
  AI_ACTION_REVIEWED: "ai.action_reviewed",

  // V3 AI Copilot structured events
  AI_ANALYSIS_TRIGGERED: "ai.analysis_triggered",
  AI_SUMMARY_GENERATED: "ai.summary_generated",
  AI_DRAFT_SUGGESTED: "ai.draft_suggested",
  AI_DRAFT_APPROVED: "ai.draft_approved",
  AI_DRAFT_REJECTED: "ai.draft_rejected",
  AI_DRAFT_SENT: "ai.draft_sent",
  AI_QUALIFICATION_EXTRACTED: "ai.qualification_extracted",
  AI_NEXT_ACTION_SUGGESTED: "ai.next_action_suggested",
  AI_ACTION_ACCEPTED: "ai.action_accepted",
  AI_ACTION_DISMISSED: "ai.action_dismissed",
  AI_ESCALATION_FLAGGED: "ai.escalation_flagged",
  AI_ESCALATION_RESOLVED: "ai.escalation_resolved",
  AI_PRIORITY_COMPUTED: "ai.priority_computed",

  // Qualification
  QUALIFICATION_CAPTURED: "qualification.captured",

  // Tours
  TOUR_SCHEDULED: "tour.scheduled",

  // Handoffs
  HUMAN_HANDOFF: "human.handoff",
} as const;

export type ActivityVerb = (typeof ActivityVerbs)[keyof typeof ActivityVerbs];
