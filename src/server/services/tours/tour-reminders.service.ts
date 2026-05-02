/** Delayed tour reminders are intentionally disabled with Inngest removal. */
export async function scheduleTourReminders(params: {
  organizationId: string;
  tourId: string;
  leadId: string;
  conversationId: string | null;
  scheduledAt: Date;
}): Promise<void> {
  void params;
}
