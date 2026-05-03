import { addHours } from "date-fns";

import { enqueueTourReminder } from "@/server/jobs/events";

export async function scheduleTourReminders(params: {
  organizationId: string;
  tourId: string;
  leadId: string;
  conversationId: string | null;
  scheduledAt: Date;
}): Promise<void> {
  await Promise.all([
    enqueueTourReminder(
      {
        organizationId: params.organizationId,
        tourId: params.tourId,
        leadId: params.leadId,
        conversationId: params.conversationId,
        kind: "24h",
      },
      addHours(params.scheduledAt, -24),
    ),
    enqueueTourReminder(
      {
        organizationId: params.organizationId,
        tourId: params.tourId,
        leadId: params.leadId,
        conversationId: params.conversationId,
        kind: "1h",
      },
      addHours(params.scheduledAt, -1),
    ),
  ]);
}
