import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { getAutomationOrgContext } from "@/server/auth/automation-context";
import { prisma } from "@/server/db/client";
import { runCopilotAnalysis } from "@/server/services/ai/ai-copilot.service";
import {
  dispatchAutomationReply,
  dispatchLeadFollowUp,
  dispatchFirstOutreach,
  sendToProspect,
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

async function queueDelayedJob(
  organizationId: string,
  type: "TOUR_REMINDER" | "LEAD_FOLLOW_UP_DUE",
  payload: Record<string, unknown>,
  runAt: Date,
) {
  await prisma.automationJob.create({
    data: {
      organizationId,
      type,
      payload: payload as Prisma.InputJsonValue,
      runAt,
    },
  });
}

export async function enqueueLeadIngested(payload: LeadIngestedPayload) {
  const runLeadIngested = async () => {
    try {
      console.info("[automation] after.start lead/ingested", payload);
      const ctx = await getAutomationOrgContext(payload.organizationId);
      try {
        await runCopilotAnalysis(ctx, payload.leadId, payload.conversationId);
      } catch (copilotError) {
        console.error("[automation] lead/ingested copilot failed (non-fatal)", {
          leadId: payload.leadId,
          conversationId: payload.conversationId,
          error: copilotError,
        });
      }
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
      // Dispatch first — this is the time-critical reply path.
      // Copilot analysis (which may create escalation flags) runs after so it
      // cannot block the auto-reply pipeline.
      await dispatchAutomationReply(ctx, payload.leadId, payload.conversationId);
      try {
        await runCopilotAnalysis(ctx, payload.leadId, payload.conversationId);
      } catch (copilotError) {
        console.error("[automation] message/received copilot failed (non-fatal)", {
          leadId: payload.leadId,
          conversationId: payload.conversationId,
          error: copilotError,
        });
      }
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

export async function enqueueTourReminder(payload: TourReminderPayload, sendAt: Date) {
  await queueDelayedJob(payload.organizationId, "TOUR_REMINDER", payload, sendAt);
}

export async function enqueueLeadFollowUpDue(payload: LeadFollowUpDuePayload, sendAt: Date) {
  await queueDelayedJob(payload.organizationId, "LEAD_FOLLOW_UP_DUE", payload, sendAt);
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

async function runTourReminderJob(payload: TourReminderPayload) {
  const ctx = await getAutomationOrgContext(payload.organizationId);
  const tour = await prisma.tour.findFirst({
    where: { id: payload.tourId, leadId: payload.leadId },
    include: {
      lead: {
        select: {
          firstName: true,
          listing: { select: { title: true } },
        },
      },
    },
  });
  if (!tour) return;

  const label = payload.kind === "24h" ? "tomorrow" : "in about an hour";
  const body = `Hi ${tour.lead.firstName}, quick reminder: your tour is ${label}. Reply here if you need to reschedule.`;
  const conversationId =
    payload.conversationId ??
    (
      await prisma.conversation.findFirst({
        where: { organizationId: payload.organizationId, leadId: payload.leadId },
        select: { id: true },
      })
    )?.id;
  if (!conversationId) return;
  await sendToProspect(ctx, {
    leadId: payload.leadId,
    conversationId,
    body,
    subject: tour.lead.listing?.title
      ? `Tour reminder: ${tour.lead.listing.title}`
      : "Tour reminder",
    preferredChannel: "AUTO",
    fallbackLabel: "Tour reminder not sent — no deliverable channel configured",
  });
}

export async function processDueAutomationJobs(limit = 20): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const jobs = await prisma.automationJob.findMany({
    where: { status: "PENDING", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: Math.min(Math.max(limit, 1), 200),
  });

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    await prisma.automationJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", attempts: { increment: 1 } },
    });

    try {
      if (job.type === "LEAD_FOLLOW_UP_DUE") {
        const payload = job.payload as unknown as LeadFollowUpDuePayload;
        const ctx = await getAutomationOrgContext(payload.organizationId);
        await dispatchLeadFollowUp(ctx, payload.leadId, {
          conversationId: payload.conversationId ?? undefined,
        });
      } else if (job.type === "TOUR_REMINDER") {
        await runTourReminderJob(job.payload as unknown as TourReminderPayload);
      }

      await prisma.automationJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", completedAt: new Date(), lastError: null },
      });
      succeeded += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const shouldRetry = attempts < 3;
      await prisma.automationJob.update({
        where: { id: job.id },
        data: shouldRetry
          ? {
              status: "PENDING",
              runAt: new Date(Date.now() + 5 * 60_000),
              lastError: error instanceof Error ? error.message : String(error),
            }
          : {
              status: "FAILED",
              completedAt: new Date(),
              lastError: error instanceof Error ? error.message : String(error),
            },
      });
      failed += 1;
    }
  }

  return { processed: jobs.length, succeeded, failed };
}
