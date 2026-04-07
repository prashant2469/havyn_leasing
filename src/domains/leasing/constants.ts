import { LeadStatus, TourStatus, ApplicationStatus } from "@prisma/client";

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOURING: "Touring",
  APPLIED: "Applied",
  CONVERTED: "Converted",
  LOST: "Lost",
};

export const tourStatusLabel: Record<TourStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  NO_SHOW: "No show",
  CANCELLED: "Cancelled",
};

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};
