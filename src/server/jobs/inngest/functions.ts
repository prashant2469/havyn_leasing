import { MessageChannel, TourStatus } from "@prisma/client";

import { getAutomationOrgContext } from "@/server/auth/automation-context";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { inngest } from "@/server/jobs/inngest/client";
import { runCopilotAnalysis } from "@/server/services/ai/ai-copilot.service";
import { logOutboundAutomationMessage } from "@/server/services/communications/conversation.service";
import {
  dispatchAutomationReply,
  dispatchFirstOutreach,
  dispatchLeadFollowUp,
} from "@/server/services/outbound/dispatch.service";
import { sendTransactionalEmail } from "@/server/services/outbound/resend.service";

export const leadIngested = inngest.createFunction(
  {
    id: "lead-ingested",
    name: "Lead ingested — copilot + first outreach",
    triggers: [{ event: "lead/ingested" }],
  },
  async ({ event, step }) => {
    const { organizationId, leadId, conversationId } = event.data;

    await step.run("copilot", async () => {
      const ctx = await getAutomationOrgContext(organizationId);
      await runCopilotAnalysis(ctx, leadId, conversationId);
    });

    await step.run("first-outreach", async () => {
      const ctx = await getAutomationOrgContext(organizationId);
      await dispatchFirstOutreach(ctx, leadId, conversationId);
    });
  },
);

export const messageReceived = inngest.createFunction(
  {
    id: "message-received",
    name: "Inbound message — copilot + guided reply",
    triggers: [{ event: "message/received" }],
  },
  async ({ event, step }) => {
    const { organizationId, leadId, conversationId } = event.data;

    await step.run("copilot", async () => {
      const ctx = await getAutomationOrgContext(organizationId);
      await runCopilotAnalysis(ctx, leadId, conversationId);
    });

    await step.run("guided-reply", async () => {
      const ctx = await getAutomationOrgContext(organizationId);
      await dispatchAutomationReply(ctx, leadId, conversationId);
    });
  },
);

export const tourReminder = inngest.createFunction(
  {
    id: "tour-reminder",
    name: "Tour reminder email",
    triggers: [{ event: "tour/reminder" }],
  },
  async ({ event, step }) => {
    const { organizationId, tourId, leadId, conversationId, kind } = event.data;

    await step.run("send-reminder", async () => {
      const ctx = await getAutomationOrgContext(organizationId);
      const tour = await prisma.tour.findFirst({
        where: { id: tourId, leadId },
        include: {
          lead: true,
          listing: true,
        },
      });
      if (!tour || tour.status !== TourStatus.SCHEDULED) return;

      const email = tour.lead.email?.trim();
      const when = new Date(tour.scheduledAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const title = tour.listing?.title ?? "your tour";
      const body = `Hi ${tour.lead.firstName},\n\nThis is a friendly reminder about your tour ${kind === "24h" ? "tomorrow" : "soon"} (${when}) for ${title}.\n\nSee you there!`;

      if (!email) {
        if (conversationId) {
          await logOutboundAutomationMessage(ctx, {
            conversationId,
            leadId,
            body: `[Reminder not emailed — no address] ${body}`,
            channel: MessageChannel.IN_APP,
          });
        }
        await recordActivity({
          ctx,
          verb: "tour.reminder_sent",
          entityType: "Tour",
          entityId: tourId,
          metadata: { leadId, kind, outcome: "no_email" },
        });
        return;
      }

      const sendResult = await sendTransactionalEmail({
        to: email,
        subject: `Reminder: tour at ${when} — Havyn Leasing`,
        text: body,
      });

      if (conversationId) {
        if ("skipped" in sendResult && sendResult.skipped) {
          await logOutboundAutomationMessage(ctx, {
            conversationId,
            leadId,
            body: `[Reminder not sent — configure RESEND] ${body}`,
            channel: MessageChannel.EMAIL,
          });
        } else {
          await logOutboundAutomationMessage(ctx, {
            conversationId,
            leadId,
            body,
            channel: MessageChannel.EMAIL,
          });
        }
      }

      await recordActivity({
        ctx,
        verb: "tour.reminder_sent",
        entityType: "Tour",
        entityId: tourId,
        metadata: {
          leadId,
          kind,
          hadEmail: Boolean(email),
        },
      });
    });
  },
);

export const leadFollowUpDue = inngest.createFunction(
  {
    id: "lead-follow-up-due",
    name: "Lead follow-up due",
    triggers: [{ event: "lead/follow_up_due" }],
  },
  async ({ event, step }) => {
    const { organizationId, leadId, conversationId } = event.data;
    await step.run("dispatch-follow-up", async () => {
      const ctx = await getAutomationOrgContext(organizationId);
      await dispatchLeadFollowUp(ctx, leadId, { conversationId });
    });
  },
);

export const leadFollowUpSweep = inngest.createFunction(
  {
    id: "lead-follow-up-sweep",
    name: "Lead follow-up sweep",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const now = new Date();
    const dueLeads = await step.run("load-due-leads", async () =>
      prisma.lead.findMany({
        where: {
          automationPaused: false,
          nextActionAt: { lte: now },
          followUpCount: { lt: 3 },
          status: { notIn: ["CONVERTED", "LOST"] },
        },
        select: { id: true, organizationId: true },
        take: 100,
        orderBy: { nextActionAt: "asc" },
      }),
    );

    for (const lead of dueLeads) {
      await step.run(`dispatch-${lead.id}`, async () => {
        const ctx = await getAutomationOrgContext(lead.organizationId);
        await dispatchLeadFollowUp(ctx, lead.id);
      });
    }
  },
);

export const inngestFunctions = [
  leadIngested,
  messageReceived,
  tourReminder,
  leadFollowUpDue,
  leadFollowUpSweep,
];
