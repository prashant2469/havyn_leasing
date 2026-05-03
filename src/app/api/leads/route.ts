import { LeadInboxStage, ListingChannelType } from "@prisma/client";
import { NextResponse } from "next/server";

import { jsonApiError, serializePrismaForJson } from "@/lib/api-route-response";
import { requireOrgContext } from "@/server/auth/context";
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
    const cursor = searchParams.get("cursor");
    const limitParam = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const multiStages = parseInboxStages(stagesParam);
    let leads =
      multiStages && multiStages.length > 0
        ? await listLeadsByInboxStages(ctx, multiStages, { take: limit, cursorId: cursor })
        : stage && Object.values(LeadInboxStage).includes(stage as LeadInboxStage)
          ? await listLeadsByInboxStage(ctx, stage as LeadInboxStage, { take: limit, cursorId: cursor })
          : await listLeads(ctx, { take: limit, cursorId: cursor });

    // Client-side filter by channel type (V2)
    if (channel && Object.values(ListingChannelType).includes(channel as ListingChannelType)) {
      leads = leads.filter(
        (l) => l.sourceChannelType === (channel as ListingChannelType),
      );
    }

    const nextCursor = leads.length >= limit ? leads.at(-1)?.id ?? null : null;
    return NextResponse.json({
      leads: serializePrismaForJson(leads),
      pagination: { nextCursor, limit },
    });
  } catch (e) {
    return jsonApiError(e);
  }
}
