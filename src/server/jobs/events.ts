import { inngest } from "@/server/jobs/inngest/client";

export type LeadIngestedPayload = {
  organizationId: string;
  leadId: string;
  conversationId: string;
  messageId: string;
};

export type MessageReceivedPayload = {
  organizationId: string;
  leadId: string;
  conversationId: string;
  messageId: string;
};

export type TourReminderPayload = {
  organizationId: string;
  tourId: string;
  leadId: string;
  conversationId: string | null;
  kind: "24h" | "1h";
};

export async function enqueueLeadIngested(payload: LeadIngestedPayload) {
  await inngest.send({
    name: "lead/ingested",
    data: payload,
  });
}

export async function enqueueMessageReceived(payload: MessageReceivedPayload) {
  await inngest.send({
    name: "message/received",
    data: payload,
  });
}

export async function enqueueTourReminder(payload: TourReminderPayload, sendAt: Date) {
  await inngest.send({
    name: "tour/reminder",
    data: payload,
    ts: sendAt.getTime(),
  });
}
