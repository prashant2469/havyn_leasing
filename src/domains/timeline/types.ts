import type {
  ApplicationStatus,
  MessageAuthorType,
  MessageChannel,
  MessageDirection,
  TourStatus,
} from "@prisma/client";

export type TimelineEntryType =
  | "message"
  | "activity"
  | "tour"
  | "application"
  | "qualification";

export type TimelineEntryBase = {
  id: string;
  type: TimelineEntryType;
  at: string;
};

export type MessageTimelineEntry = TimelineEntryBase & {
  type: "message";
  messageId: string;
  direction: MessageDirection;
  channel: MessageChannel;
  authorType: MessageAuthorType;
  body: string;
};

export type ActivityTimelineEntry = TimelineEntryBase & {
  type: "activity";
  activityId: string;
  verb: string;
};

export type TourTimelineEntry = TimelineEntryBase & {
  type: "tour";
  tourId: string;
  status: TourStatus;
  scheduledAt: string;
  notes: string | null;
};

export type ApplicationTimelineEntry = TimelineEntryBase & {
  type: "application";
  applicationId: string;
  status: ApplicationStatus;
};

export type QualificationTimelineEntry = TimelineEntryBase & {
  type: "qualification";
  key: string;
  source: string;
  value: unknown;
};

export type TimelineEntry =
  | MessageTimelineEntry
  | ActivityTimelineEntry
  | TourTimelineEntry
  | ApplicationTimelineEntry
  | QualificationTimelineEntry;
