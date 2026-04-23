import { notFound, redirect } from "next/navigation";

import { tryOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { listAIActionsForLead } from "@/server/services/ai/ai-action.service";
import { loadCopilotContext } from "@/server/services/ai/ai-copilot.service";
import { listActivityForEntity } from "@/server/services/activity/activity.service";
import { listMessagesForLead } from "@/server/services/communications/conversation.service";
import { getLeadById } from "@/server/services/leasing/lead.service";
import { listResidents } from "@/server/services/residents/resident.service";

import { LeadWorkspace } from "./lead-workspace";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const ctx = await tryOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  const lead = await getLeadById(ctx, id);
  if (!lead) notFound();

  const [convo, activities, aiActions, residents, properties] = await Promise.all([
    listMessagesForLead(ctx, id),
    listActivityForEntity(ctx, "Lead", id),
    listAIActionsForLead(ctx, id),
    listResidents(ctx),
    prisma.property.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: "asc" },
      include: { units: { orderBy: { unitNumber: "asc" } } },
    }),
  ]);

  let copilotContext = null;
  try {
    copilotContext = await loadCopilotContext(ctx, id, convo?.id);
  } catch {
    // Non-fatal: copilot context unavailable
  }

  return (
    <LeadWorkspace
      lead={JSON.parse(JSON.stringify(lead))}
      conversation={convo ? JSON.parse(JSON.stringify(convo)) : null}
      activities={JSON.parse(JSON.stringify(activities))}
      aiActions={JSON.parse(JSON.stringify(aiActions))}
      copilotContext={copilotContext ? JSON.parse(JSON.stringify(copilotContext)) : null}
      residents={JSON.parse(JSON.stringify(residents))}
      properties={JSON.parse(JSON.stringify(properties))}
      initialTab={
        tab === "overview" ||
        tab === "qualification" ||
        tab === "tours" ||
        tab === "application" ||
        tab === "communications" ||
        tab === "activity" ||
        tab === "copilot"
          ? tab
          : "overview"
      }
    />
  );
}
