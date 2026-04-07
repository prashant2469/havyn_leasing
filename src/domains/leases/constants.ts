import { LeaseStatus } from "@prisma/client";

export const leaseStatusLabel: Record<LeaseStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  ACTIVE: "Active",
  ENDED: "Ended",
};
