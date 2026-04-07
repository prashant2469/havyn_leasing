import { ConversationReplyMode } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import type { OrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";

export interface ReplyStrategyResult {
  replyMode: ConversationReplyMode;
  canReplyInChannel: boolean;
  canRedirect: boolean;
  requiresManual: boolean;
  hint: string;
}

/**
 * Resolves the effective reply strategy for a conversation.
 * UI uses this to show the correct reply mode indicator and enable/disable reply UI.
 */
export async function resolveReplyStrategy(
  ctx: OrgContext,
  conversationId: string,
): Promise<ReplyStrategyResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: ctx.organizationId },
    include: {
      lead: { select: { email: true, phone: true } },
    },
  });

  if (!conversation) throw new Error("Conversation not found");

  const mode = conversation.replyMode;
  const lead = conversation.lead;

  switch (mode) {
    case ConversationReplyMode.IN_CHANNEL_REPLY:
      return {
        replyMode: mode,
        canReplyInChannel: true,
        canRedirect: false,
        requiresManual: false,
        hint: "Reply will be sent back through the originating channel.",
      };

    case ConversationReplyMode.REDIRECT_TO_OWNED_CHANNEL:
      return {
        replyMode: mode,
        canReplyInChannel: false,
        canRedirect: !!(lead?.email || lead?.phone),
        requiresManual: !(lead?.email || lead?.phone),
        hint: lead?.email
          ? `Reply will be sent via email to ${lead.email}.`
          : lead?.phone
            ? `Reply will be sent via SMS to ${lead.phone}.`
            : "No owned channel contact info available — manual reply required.",
      };

    case ConversationReplyMode.MANUAL_ONLY:
      return {
        replyMode: mode,
        canReplyInChannel: false,
        canRedirect: false,
        requiresManual: true,
        hint: "Manual reply required. No automated outbound messaging enabled for this channel.",
      };
  }
}

/**
 * Updates the reply mode for a conversation and logs the change.
 */
export async function updateConversationReplyMode(
  ctx: OrgContext,
  conversationId: string,
  replyMode: ConversationReplyMode,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: ctx.organizationId },
  });
  if (!conversation) throw new Error("Conversation not found");

  const before = conversation.replyMode;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { replyMode },
  });

  await logActivity({
    ctx,
    verb: ActivityVerbs.CONVERSATION_REPLY_MODE_CHANGED,
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { before, after: replyMode },
  });

  return { conversationId, replyMode };
}
