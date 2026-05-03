import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { listRecommendationsForLead } from "@/server/services/recommendations/recommendation.service";
import { getNextQualificationPrompt } from "@/server/services/leasing/guided-qualification.service";
import type { StrategyDecision } from "@/server/services/strategy/strategy-decision.service";

export type StrategyMessage = {
  body: string;
  subject: string;
  preferredChannel: "AUTO" | "SMS" | "EMAIL";
};

function recommendationsBody(input: {
  firstName: string;
  recommendations: Array<{
    listing: {
      title: string;
      monthlyRent: unknown;
      bedrooms: number | null;
      unit: { property: { name: string } };
    };
  }>;
}): string {
  const top = input.recommendations.slice(0, 3);
  const lines = top.map((r) => {
    const rent = Number(r.listing.monthlyRent);
    const rentLabel = Number.isFinite(rent)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rent)
      : "Rent varies";
    const bedLabel = r.listing.bedrooms != null ? `${r.listing.bedrooms} bd` : "Layout varies";
    return `- ${r.listing.title} (${r.listing.unit.property.name}) · ${rentLabel} · ${bedLabel}`;
  });
  return `Hi ${input.firstName},\n\nBased on what you shared, here are a few options in our portfolio that may be a better fit:\n${lines.join(
    "\n",
  )}\n\nReply with your top pick and I can send tour times.`;
}

export async function generateStrategyMessage(
  ctx: OrgContext,
  input: { leadId: string; decision: StrategyDecision },
): Promise<StrategyMessage> {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    include: {
      listing: { select: { title: true } },
      conversations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } },
      },
    },
  });
  if (!lead) throw new Error("Lead not found");

  const firstName = lead.firstName || "there";
  const listingTitle = lead.listing?.title;
  const defaultSubject = listingTitle ? `Re: ${listingTitle} — Havyn Leasing` : "Re: your inquiry — Havyn Leasing";

  if (input.decision.action === "QUALIFY") {
    const q1 = await getNextQualificationPrompt(lead.id);
    const q2 = input.decision.qualificationKeysToAsk?.[1]
      ? `Also, could you share ${input.decision.qualificationKeysToAsk[1]}?`
      : "";
    return {
      body: `Hi ${firstName},\n\nTo keep options accurate and avoid wasted tours, I need two quick details.\n${q1 ?? "What move-in date are you targeting?"}\n${q2}`.trim(),
      subject: defaultSubject,
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "RECOMMEND") {
    const recommendations = await listRecommendationsForLead(ctx, lead.id);
    if (recommendations.length > 0) {
      return {
        body: recommendationsBody({ firstName, recommendations }),
        subject: "Matching homes across our portfolio — Havyn Leasing",
        preferredChannel: "AUTO",
      };
    }
    return {
      body: `Hi ${firstName},\n\nI can suggest a few nearby options that may fit your timeline and budget better. If you share your ideal move-in date and bedroom target, I’ll narrow it down.`,
      subject: "Alternative matches — Havyn Leasing",
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "TOUR_OFFER") {
    return {
      body: `Hi ${firstName},\n\nI can send 2-3 tour options that match your preferences this week. Do mornings or afternoons work better?`,
      subject: listingTitle ? `Tour options for ${listingTitle} — Havyn Leasing` : "Tour options — Havyn Leasing",
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "APPLICATION") {
    return {
      body: `Hi ${firstName},\n\nIf you'd like to move forward, I can share the application checklist and link now.`,
      subject: listingTitle ? `Application next steps for ${listingTitle}` : "Application next steps",
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "NURTURE") {
    return {
      body: `Hi ${firstName},\n\nChecking in to keep things moving. Are you still planning to move soon, or should I follow up later this week?`,
      subject: defaultSubject,
      preferredChannel: "AUTO",
    };
  }

  return {
    body: `Hi ${firstName},\n\nThanks for your message — a leasing specialist will follow up shortly.`,
    subject: defaultSubject,
    preferredChannel: "AUTO",
  };
}
