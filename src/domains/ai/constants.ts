import {
  AIEscalationReason,
  AIEscalationStatus,
  AIReplyDraftStatus,
  AISuggestedActionStatus,
  AISuggestedActionType,
  AIUrgency,
  LeadPriorityTier,
} from "@prisma/client";

// ─── Urgency ─────────────────────────────────────────────────────────────────

export const urgencyLabel: Record<AIUrgency, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const urgencyColor: Record<AIUrgency, string> = {
  LOW: "secondary",
  NORMAL: "outline",
  HIGH: "default",
  URGENT: "destructive",
};

// ─── Reply Draft Status ───────────────────────────────────────────────────────

export const replyDraftStatusLabel: Record<AIReplyDraftStatus, string> = {
  SUGGESTED: "Suggested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT: "Sent",
  SUPERSEDED: "Superseded",
};

export const replyDraftStatusColor: Record<AIReplyDraftStatus, string> = {
  SUGGESTED: "outline",
  APPROVED: "default",
  REJECTED: "secondary",
  SENT: "default",
  SUPERSEDED: "secondary",
};

// ─── Suggested Actions ────────────────────────────────────────────────────────

export const suggestedActionLabel: Record<AISuggestedActionType, string> = {
  REPLY_NOW: "Reply now",
  ASK_QUALIFICATION: "Ask qualification question",
  OFFER_TOUR_TIMES: "Offer tour times",
  SHARE_RECOMMENDATIONS: "Share recommendations",
  SCHEDULE_RECOMMENDED_TOUR: "Schedule recommended tour",
  SEND_APPLICATION_INVITE: "Send application invite",
  HAND_OFF_TO_HUMAN: "Hand off to human",
  FOLLOW_UP_24H: "Follow up in 24 hours",
  MARK_QUALIFIED: "Mark as qualified",
  OTHER: "Other",
};

export const suggestedActionIcon: Record<AISuggestedActionType, string> = {
  REPLY_NOW: "MessageSquare",
  ASK_QUALIFICATION: "ClipboardList",
  OFFER_TOUR_TIMES: "CalendarPlus",
  SHARE_RECOMMENDATIONS: "Building2",
  SCHEDULE_RECOMMENDED_TOUR: "CalendarRange",
  SEND_APPLICATION_INVITE: "FileText",
  HAND_OFF_TO_HUMAN: "UserCheck",
  FOLLOW_UP_24H: "Clock",
  MARK_QUALIFIED: "CheckCircle",
  OTHER: "Zap",
};

export const suggestedActionStatusLabel: Record<AISuggestedActionStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DISMISSED: "Dismissed",
  EXPIRED: "Expired",
};

// ─── Escalation ───────────────────────────────────────────────────────────────

export const escalationReasonLabel: Record<AIEscalationReason, string> = {
  POLICY_EXCEPTION: "Policy exception",
  UPSET_LEAD: "Upset lead",
  UNCLEAR_INTENT: "Unclear intent",
  UNSUPPORTED_CHANNEL_REPLY: "Unsupported channel reply",
  LOW_CONFIDENCE: "Low AI confidence",
  COMPLEX_SITUATION: "Complex situation",
  URGENT_RESPONSE_NEEDED: "Urgent response needed",
};

export const escalationStatusLabel: Record<AIEscalationStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False positive",
};

export const escalationStatusColor: Record<AIEscalationStatus, string> = {
  OPEN: "destructive",
  ACKNOWLEDGED: "default",
  RESOLVED: "secondary",
  FALSE_POSITIVE: "outline",
};

// ─── Priority ─────────────────────────────────────────────────────────────────

export const priorityTierLabel: Record<LeadPriorityTier, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
  COLD: "Cold",
};

export const priorityTierColor: Record<LeadPriorityTier, string> = {
  URGENT: "destructive",
  HIGH: "default",
  NORMAL: "outline",
  LOW: "secondary",
  COLD: "secondary",
};
