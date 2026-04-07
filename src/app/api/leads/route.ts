import { LeadInboxStage, ListingChannelType } from "@prisma/client";
import { NextResponse } from "next/server";

import { DevAuthError, requireOrgContext } from "@/server/auth/context";
import { listLeads, listLeadsByInboxStage } from "@/server/services/leasing/lead.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireOrgContext();
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const channel = searchParams.get("channel");

    let leads = stage && Object.values(LeadInboxStage).includes(stage as LeadInboxStage)
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
