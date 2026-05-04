import { LeadStrategyBucket } from "@prisma/client";

import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { classifyInboundIntent } from "@/server/services/ai/intent-classifier.service";
import { getQualificationCompleteness } from "@/server/services/leasing/qualification-score.service";
import { computeTourReadiness, type TourReadinessResult } from "@/server/services/strategy/tour-readiness.service";

export type StrategyAction =
  | "QUALIFY"
  | "RECOMMEND"
  | "TOUR_OFFER"
  | "NURTURE"
  | "ESCALATE"
  | "APPLICATION"
  | "WAIT";

export type StrategyDecision = {
  action: StrategyAction;
  bucket: LeadStrategyBucket;
  reasons: string[];
  qualificationKeysToAsk?: string[];
  recommendationIds?: string[];
  tourPropertyId?: string;
  readiness: TourReadinessResult;
  intent: ReturnType<typeof classifyInboundIntent>["intent"];
  confidence: number;
};

export async function resolveStrategyDecision(
  ctx: OrgContext,
  input: { leadId: string; conversationId: string },
): Promise<StrategyDecision> {
  const [lead, strength, latestInbound, latestOutbound, qual, recommendations, readiness] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: input.leadId, organizationId: ctx.organizationId },
      include: {
        tours: {
          where: { status: "SCHEDULED" },
          orderBy: { scheduledAt: "asc" },
          take: 1,
        },
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.leadStrengthSignal.findUnique({
      where: { leadId: input.leadId },
    }),
    prisma.message.findFirst({
      where: { conversationId: input.conversationId, direction: "INBOUND" },
      orderBy: { sentAt: "desc" },
      select: { body: true, sentAt: true, channel: true },
    }),
    prisma.message.findFirst({
      where: { conversationId: input.conversationId, direction: "OUTBOUND" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    getQualificationCompleteness(input.leadId),
    prisma.propertyRecommendation.findMany({
      where: { leadId: input.leadId, lead: { organizationId: ctx.organizationId } },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 3,
      select: { id: true, score: true, listingId: true, tourReady: true },
    }),
    computeTourReadiness(ctx, input.leadId),
  ]);

  const intent = classifyInboundIntent(latestInbound?.body ?? "");

  if (!lead) {
    return {
      action: "WAIT",
      bucket: LeadStrategyBucket.NURTURE,
      reasons: ["lead_missing"],
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  const bucket = strength?.strategyBucket ?? LeadStrategyBucket.PROMISING_INCOMPLETE;
  const bucketFallbackReason = strength ? [] : ["strength_missing_defaulting_bucket"];
  const hasRecentOutbound = Boolean(
    latestInbound?.sentAt && latestOutbound?.sentAt && latestOutbound.sentAt >= latestInbound.sentAt,
  );
  const topRecs = recommendations.filter((r) => r.score >= 0.6);

  const isActiveSmsReply = latestInbound?.channel === "SMS";
  const effectiveBucket =
    bucket === LeadStrategyBucket.HUMAN_REQUIRED && isActiveSmsReply
      ? LeadStrategyBucket.PROMISING_INCOMPLETE
      : bucket;
  if (bucket === LeadStrategyBucket.HUMAN_REQUIRED && !isActiveSmsReply) {
    return {
      action: "ESCALATE",
      bucket,
      reasons: ["bucket_requires_human"],
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  if (lead.automationPaused) {
    if (isActiveSmsReply && (intent.intent === "TOUR_INTEREST" || intent.intent === "TOUR_CONFIRMATION")) {
      return {
        action: "TOUR_OFFER",
        bucket: LeadStrategyBucket.PROMISING_INCOMPLETE,
        reasons: ["automation_resumed_via_sms_scheduling_intent"],
        tourPropertyId: readiness.qualifiedListings.find((l) => l.hasSlots)?.listingId,
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    return {
      action: "WAIT",
      bucket,
      reasons: ["automation_paused"],
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  if (effectiveBucket === LeadStrategyBucket.TOUR_READY) {
    if (lead.tours.length > 0) {
      return {
        action: "WAIT",
        bucket: effectiveBucket,
        reasons: ["tour_already_scheduled"],
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    if (lead.applications.length > 0 && lead.applications[0]?.status !== "SUBMITTED") {
      return {
        action: "APPLICATION",
        bucket: effectiveBucket,
        reasons: ["tour_done_or_app_in_progress"],
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    if (topRecs.length > 0 && topRecs.some((r) => r.score >= 0.7)) {
      return {
        action: "RECOMMEND",
        bucket: effectiveBucket,
        reasons: ["high_confidence_alternatives"],
        recommendationIds: topRecs.map((r) => r.id),
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    return {
      action: "TOUR_OFFER",
      bucket: effectiveBucket,
      reasons: ["tour_ready_bucket", ...bucketFallbackReason],
      tourPropertyId: readiness.qualifiedListings.find((l) => l.hasSlots)?.listingId,
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  if (effectiveBucket === LeadStrategyBucket.PROMISING_INCOMPLETE) {
    if (intent.intent === "TOUR_INTEREST") {
      return {
        action: "TOUR_OFFER",
        bucket: effectiveBucket,
        reasons: ["tour_interest_fast_track"],
        tourPropertyId: readiness.qualifiedListings.find((l) => l.hasSlots)?.listingId,
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    return {
      action: "QUALIFY",
      bucket: effectiveBucket,
      reasons: ["missing_qualification_data", ...bucketFallbackReason],
      qualificationKeysToAsk: qual.missing.slice(0, 2),
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  if (effectiveBucket === LeadStrategyBucket.PORTFOLIO_CANDIDATE) {
    return {
      action: "RECOMMEND",
      bucket: effectiveBucket,
      reasons: ["portfolio_fit_better_than_primary", ...bucketFallbackReason],
      recommendationIds: topRecs.map((r) => r.id),
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  if (effectiveBucket === LeadStrategyBucket.NURTURE) {
    if (hasRecentOutbound) {
      return {
        action: "WAIT",
        bucket: effectiveBucket,
        reasons: ["recent_outbound_sent"],
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    return {
      action: "NURTURE",
      bucket: effectiveBucket,
      reasons: ["nurture_lane", ...bucketFallbackReason],
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  if (effectiveBucket === LeadStrategyBucket.WEAK_HOLD) {
    if (!latestInbound) {
      return {
        action: "WAIT",
        bucket: effectiveBucket,
        reasons: ["weak_hold_no_reengagement"],
        readiness,
        intent: intent.intent,
        confidence: intent.confidence,
      };
    }
    return {
      action: "NURTURE",
      bucket: effectiveBucket,
      reasons: ["weak_hold_reengaged", ...bucketFallbackReason],
      readiness,
      intent: intent.intent,
      confidence: intent.confidence,
    };
  }

  return {
    action: "WAIT",
    bucket: effectiveBucket,
    reasons: ["default_wait"],
    readiness,
    intent: intent.intent,
    confidence: intent.confidence,
  };
}
