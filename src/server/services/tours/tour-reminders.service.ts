import { subHours } from "date-fns";

import { enqueueTourReminder } from "@/server/jobs/events";

/** Enqueue Inngest 24h and 1h reminders before `scheduledAt` (skips past times). */
export async function scheduleTourReminders(params: {
  organizationId: string;
  tourId: string;
  leadId: string;
  conversationId: string | null;
  scheduledAt: Date;
}): Promise<void> {
  const now = new Date();
  const at24 = subHours(params.scheduledAt, 24);
  const at1 = subHours(params.scheduledAt, 1);
  if (at24 > now) {
    await enqueueTourReminder(
      {
        organizationId: params.organizationId,
        tourId: params.tourId,
        leadId: params.leadId,
        conversationId: params.conversationId,
        kind: "24h",
      },
      at24,
    );
  }
  if (at1 > now) {
    await enqueueTourReminder(
      {
        organizationId: params.organizationId,
        tourId: params.tourId,
        leadId: params.leadId,
        conversationId: params.conversationId,
        kind: "1h",
      },
      at1,
    );
  }
}
