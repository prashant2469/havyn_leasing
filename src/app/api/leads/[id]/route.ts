import { NextResponse } from "next/server";

import { jsonApiError, serializePrismaForJson } from "@/lib/api-route-response";
import { requireOrgContext } from "@/server/auth/context";
import { listActivityForEntity } from "@/server/services/activity/activity.service";
import { listAIActionsForLead } from "@/server/services/ai/ai-action.service";
import { loadCopilotContext } from "@/server/services/ai/ai-copilot.service";
import { listMessagesForLead } from "@/server/services/communications/conversation.service";
import { getLeadById } from "@/server/services/leasing/lead.service";
import { resolveReplyStrategy } from "@/server/services/channels/reply-strategy.service";
import { getLeadTimeline } from "@/server/services/timeline/timeline.service";
import { listRecommendationsForLead } from "@/server/services/recommendations/recommendation.service";
import { prisma } from "@/server/db/client";
import { normalizePhoneToE164 } from "@/lib/phone";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgContext();
    const { id } = await params;
    const [lead, conversation, activities, aiActions, timeline, recommendations] = await Promise.all([
      getLeadById(ctx, id),
      listMessagesForLead(ctx, id),
      listActivityForEntity(ctx, "Lead", id),
      listAIActionsForLead(ctx, id),
      getLeadTimeline(ctx, id),
      listRecommendationsForLead(ctx, id),
    ]);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const relevantPropertyId = lead.propertyId ?? lead.listing?.unit?.property?.id ?? null;
    const units = relevantPropertyId
      ? await prisma.unit.findMany({
          where: { propertyId: relevantPropertyId, property: { organizationId: ctx.organizationId } },
          orderBy: { unitNumber: "asc" },
          select: {
            id: true,
            unitNumber: true,
            property: { select: { name: true } },
          },
        })
      : [];

    // Resolve reply strategy and load V3 copilot context in parallel
    let replyStrategy = null;
    let copilotContext = null;
    if (conversation) {
      try {
        [replyStrategy, copilotContext] = await Promise.all([
          resolveReplyStrategy(ctx, conversation.id),
          loadCopilotContext(ctx, id, conversation.id),
        ]);
      } catch {
        // Non-fatal
      }
    } else {
      try {
        copilotContext = await loadCopilotContext(ctx, id);
      } catch {
        // Non-fatal
      }
    }

    const smsConsent =
      lead?.phone && normalizePhoneToE164(lead.phone)
        ? await prisma.smsConsent.findUnique({
            where: {
              organizationId_phone: {
                organizationId: ctx.organizationId,
                phone: normalizePhoneToE164(lead.phone)!,
              },
            },
            select: {
              status: true,
              optOutAt: true,
              optOutKeyword: true,
            },
          })
        : null;

    return NextResponse.json({
      lead: serializePrismaForJson(lead),
      conversation: conversation ? serializePrismaForJson(conversation) : null,
      activities: serializePrismaForJson(activities),
      aiActions: serializePrismaForJson(aiActions),
      timeline: serializePrismaForJson(timeline),
      recommendations: serializePrismaForJson(recommendations),
      units: serializePrismaForJson(units),
      smsConsent: smsConsent ? serializePrismaForJson(smsConsent) : null,
      replyStrategy,
      copilotContext: copilotContext ? serializePrismaForJson(copilotContext) : null,
    });
  } catch (e) {
    return jsonApiError(e);
  }
}
