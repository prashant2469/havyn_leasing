import { prisma } from "@/server/db/client";

/**
 * Funnel timestamps for **organization outbound** (staff or automation), not prospect inbound.
 * Call whenever an OUTBOUND message is persisted for the lead.
 */
export async function recordLeadOrgOutboundResponse(organizationId: string, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { firstResponseAt: true },
  });
  if (!lead) return;

  const now = new Date();
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstResponseAt: lead.firstResponseAt ?? now,
      lastResponseAt: now,
    },
  });
}
