import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { listRecommendationsForLead } from "@/server/services/recommendations/recommendation.service";
import { getNextQualificationPrompt } from "@/server/services/leasing/guided-qualification.service";
import { QUALIFICATION_QUESTIONS, type QualificationKey } from "@/domains/leasing/qualification-keys";
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

function recommendationsSnippet(input: {
  recommendations: Array<{
    listing: {
      title: string;
      monthlyRent: unknown;
      bedrooms: number | null;
      unit: { property: { name: string } };
    };
  }>;
}): string {
  const top = input.recommendations.slice(0, 2);
  if (top.length === 0) return "";
  const lines = top.map((r) => {
    const rent = Number(r.listing.monthlyRent);
    const rentLabel = Number.isFinite(rent)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rent)
      : "Rent varies";
    const bedLabel = r.listing.bedrooms != null ? `${r.listing.bedrooms} bd` : "Layout varies";
    return `- ${r.listing.title} (${r.listing.unit.property.name}) · ${rentLabel} · ${bedLabel}`;
  });
  return `Nearby alternatives you may also like:\n${lines.join("\n")}`;
}

function appendSection(base: string, section: string): string {
  if (!section.trim()) return base;
  return `${base.trim()}\n\n${section.trim()}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,]/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function generateStrategyMessage(
  ctx: OrgContext,
  input: { leadId: string; decision: StrategyDecision; smsCompact?: boolean },
): Promise<StrategyMessage> {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: ctx.organizationId },
    include: {
      listing: { select: { title: true } },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { payload: true },
      },
      qualifications: { select: { key: true, value: true } },
    },
  });
  if (!lead) throw new Error("Lead not found");

  const firstName = lead.firstName || "there";
  const listingTitle = lead.listing?.title;
  const defaultSubject = listingTitle ? `Re: ${listingTitle} — Havyn Leasing` : "Re: your inquiry — Havyn Leasing";
  const latestPayload = toRecord(lead.applications[0]?.payload);
  const qualMap = new Map(lead.qualifications.map((q) => [q.key, q.value]));
  const moveInDate = toText(qualMap.get("moveInDate")) || toText(latestPayload.desiredLeaseStart);
  const incomeRange = toText(qualMap.get("incomeRange"));
  const monthlyBudget = toNumber(qualMap.get("monthlyBudget"));
  const monthlyIncome = toNumber(qualMap.get("monthlyIncome")) ?? toNumber(latestPayload.monthlyIncome);
  const creditSelfReport = toText(qualMap.get("creditSelfReport")) || toText(latestPayload.creditScoreRange);
  const summaryBits: string[] = [];
  if (moveInDate) summaryBits.push(`move-in around ${moveInDate}`);
  if (monthlyBudget != null) {
    summaryBits.push(
      `budget around ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(monthlyBudget)}/mo`,
    );
  } else if (incomeRange) {
    summaryBits.push(`income range ${incomeRange}`);
  } else if (monthlyIncome != null) {
    summaryBits.push(
      `income around ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(monthlyIncome)}/mo`,
    );
  }
  if (creditSelfReport) summaryBits.push(`credit profile ${creditSelfReport}`);
  const personalizedIntro = summaryBits.length
    ? `Thanks for applying${listingTitle ? ` for ${listingTitle}` : ""}. I noted ${summaryBits.join(", ")}.`
    : `Thanks for applying${listingTitle ? ` for ${listingTitle}` : ""}.`;
  const recommendations = await listRecommendationsForLead(ctx, lead.id);
  const recSnippet = input.smsCompact ? "" : recommendationsSnippet({ recommendations });

  if (input.decision.action === "QUALIFY") {
    const q1 = await getNextQualificationPrompt(lead.id);
    const q2Key = !input.smsCompact
      ? (input.decision.qualificationKeysToAsk?.[1] as QualificationKey | undefined)
      : undefined;
    const q2 = q2Key ? QUALIFICATION_QUESTIONS[q2Key] : "";
    const fallbackQ1 = "What move-in date are you targeting?";
    if (input.smsCompact) {
      return {
        body: `Hi ${firstName},\n\n${personalizedIntro}\n\nQuick question so I can send the right tour options: ${singleLine(q1 ?? fallbackQ1)}`,
        subject: defaultSubject,
        preferredChannel: "AUTO",
      };
    }
    return {
      body: appendSection(
        `Hi ${firstName},\n\n${personalizedIntro}\n\nTo keep options accurate and avoid wasted tours, I need two quick details.\n${q1 ?? fallbackQ1}${q2 ? `\n${q2}` : ""}`.trim(),
        recSnippet,
      ),
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
      body: `Hi ${firstName},\n\n${personalizedIntro}\n\nI can suggest a few nearby options that may fit your timeline and budget better. If you share your ideal bedroom target, I’ll narrow it down.`,
      subject: "Alternative matches — Havyn Leasing",
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "TOUR_OFFER") {
    return {
      body: appendSection(
        `Hi ${firstName},\n\n${personalizedIntro}\n\nI can send 2-3 tour options that match your preferences this week. Do mornings or afternoons work better?`,
        recSnippet,
      ),
      subject: listingTitle ? `Tour options for ${listingTitle} — Havyn Leasing` : "Tour options — Havyn Leasing",
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "APPLICATION") {
    return {
      body: appendSection(
        `Hi ${firstName},\n\n${personalizedIntro}\n\nIf you'd like to move forward, I can share the application checklist and link now.`,
        recSnippet,
      ),
      subject: listingTitle ? `Application next steps for ${listingTitle}` : "Application next steps",
      preferredChannel: "AUTO",
    };
  }

  if (input.decision.action === "NURTURE") {
    return {
      body: appendSection(
        `Hi ${firstName},\n\n${personalizedIntro}\n\nChecking in to keep things moving. Are you still planning to move soon, or should I follow up later this week?`,
        recSnippet,
      ),
      subject: defaultSubject,
      preferredChannel: "AUTO",
    };
  }

  return {
    body: appendSection(
      `Hi ${firstName},\n\n${personalizedIntro}\n\nThanks for your message — a leasing specialist will follow up shortly.`,
      recSnippet,
    ),
    subject: defaultSubject,
    preferredChannel: "AUTO",
  };
}
