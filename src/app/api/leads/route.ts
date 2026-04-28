import { LeadInboxStage, ListingChannelType } from "@prisma/client";
import { NextResponse } from "next/server";

import { DevAuthError, requireOrgContext } from "@/server/auth/context";
import { listLeads, listLeadsByInboxStage, listLeadsByInboxStages } from "@/server/services/leasing/lead.service";

function parseInboxStages(raw: string | null): LeadInboxStage[] | null {
  if (!raw) return null;
  const parts = raw.split(",").map((s) => s.trim());
  const stages: LeadInboxStage[] = [];
  for (const p of parts) {
    if (Object.values(LeadInboxStage).includes(p as LeadInboxStage)) {
      stages.push(p as LeadInboxStage);
    }
  }
  return stages.length > 0 ? stages : null;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireOrgContext();
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const stagesParam = searchParams.get("stages");
    const channel = searchParams.get("channel");

    const multiStages = parseInboxStages(stagesParam);
    let leads =
      multiStages && multiStages.length > 0
        ? await listLeadsByInboxStages(ctx, multiStages)
        : stage && Object.values(LeadInboxStage).includes(stage as LeadInboxStage)
          ? await listLeadsByInboxStage(ctx, stage as LeadInboxStage)
          : await listLeads(ctx);

    // Client-side filter by channel type (V2)
    if (channel && Object.values(ListingChannelType).includes(channel as ListingChannelType)) {
      leads = leads.filter(
        (l) => l.sourceChannelType === (channel as ListingChannelType),
      );
    }

    return NextResponse.json({ leads });
  } catch (e) {
    const message = e instanceof DevAuthError ? e.message : "Unauthorized";
    const status = e instanceof DevAuthError ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
