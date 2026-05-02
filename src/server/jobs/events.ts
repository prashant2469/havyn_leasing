import { after } from "next/server";

import { getAutomationOrgContext } from "@/server/auth/automation-context";
import { runCopilotAnalysis } from "@/server/services/ai/ai-copilot.service";
import {
  dispatchAutomationReply,
  dispatchFirstOutreach,
} from "@/server/services/outbound/dispatch.service";
import { generateRecommendations } from "@/server/services/recommendations/recommendation.service";

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

export type LeadFollowUpDuePayload = {
  organizationId: string;
  leadId: string;
  conversationId: string | null;
};

export type LeadQualificationsChangedPayload = {
  organizationId: string;
  leadId: string;
};

export async function enqueueLeadIngested(payload: LeadIngestedPayload) {
  const runLeadIngested = async () => {
    try {
      console.info("[automation] after.start lead/ingested", payload);
      const ctx = await getAutomationOrgContext(payload.organizationId);
      await runCopilotAnalysis(ctx, payload.leadId, payload.conversationId);
      await dispatchFirstOutreach(ctx, payload.leadId, payload.conversationId);
      console.info("[automation] after.end lead/ingested", {
        leadId: payload.leadId,
        conversationId: payload.conversationId,
      });
    } catch (error) {
      console.error("[automation] lead/ingested failed", error);
    }
  };

  // Local dev: await so work stays tied to the server action request. Fire-and-forget
  // promises can be dropped after the response when copilot + dispatch take many seconds.
  if (process.env.NODE_ENV === "development") {
    await runLeadIngested();
    return;
  }

  after(runLeadIngested);
}

export async function enqueueMessageReceived(payload: MessageReceivedPayload) {
  const runMessageReceived = async () => {
    try {
      console.info("[automation] after.start message/received", payload);
      const ctx = await getAutomationOrgContext(payload.organizationId);
      await runCopilotAnalysis(ctx, payload.leadId, payload.conversationId);
      await dispatchAutomationReply(ctx, payload.leadId, payload.conversationId);
      console.info("[automation] after.end message/received", {
        leadId: payload.leadId,
        conversationId: payload.conversationId,
      });
    } catch (error) {
      console.error("[automation] message/received failed", error);
    }
  };

  if (process.env.NODE_ENV === "development") {
    await runMessageReceived();
    return;
  }

  after(runMessageReceived);
}

export async function enqueueTourReminder(_payload: TourReminderPayload, _sendAt: Date) {
  // Delayed jobs intentionally dropped with Inngest removal.
}

export async function enqueueLeadFollowUpDue(_payload: LeadFollowUpDuePayload, _sendAt: Date) {
  // Delayed jobs intentionally dropped with Inngest removal.
}

export async function enqueueLeadQualificationsChanged(payload: LeadQualificationsChangedPayload) {
  const runLeadQualificationsChanged = async () => {
    try {
      const ctx = await getAutomationOrgContext(payload.organizationId);
      await generateRecommendations(ctx, payload.leadId);
    } catch (error) {
      console.error("[automation] lead/qualifications_changed failed", error);
    }
  };

  if (process.env.NODE_ENV === "development") {
    await runLeadQualificationsChanged();
    return;
  }

  after(runLeadQualificationsChanged);
}
