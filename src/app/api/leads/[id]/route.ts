import { NextResponse } from "next/server";

import { DevAuthError, requireOrgContext } from "@/server/auth/context";
import { listActivityForEntity } from "@/server/services/activity/activity.service";
import { listAIActionsForLead } from "@/server/services/ai/ai-action.service";
import { loadCopilotContext } from "@/server/services/ai/ai-copilot.service";
import { listMessagesForLead } from "@/server/services/communications/conversation.service";
import { getLeadById } from "@/server/services/leasing/lead.service";
import { resolveReplyStrategy } from "@/server/services/channels/reply-strategy.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireOrgContext();
    const { id } = await params;
    const [lead, conversation, activities, aiActions] = await Promise.all([
      getLeadById(ctx, id),
      listMessagesForLead(ctx, id),
      listActivityForEntity(ctx, "Lead", id),
      listAIActionsForLead(ctx, id),
    ]);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    return NextResponse.json({
      lead: JSON.parse(JSON.stringify(lead)),
      conversation: conversation ? JSON.parse(JSON.stringify(conversation)) : null,
      activities: JSON.parse(JSON.stringify(activities)),
      aiActions: JSON.parse(JSON.stringify(aiActions)),
      replyStrategy,
      copilotContext: copilotContext ? JSON.parse(JSON.stringify(copilotContext)) : null,
    });
  } catch (e) {
    const message = e instanceof DevAuthError ? e.message : "Unauthorized";
    const status = e instanceof DevAuthError ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
