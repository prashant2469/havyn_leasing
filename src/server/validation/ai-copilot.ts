import {
  AIEscalationReason,
} from "@prisma/client";
import { z } from "zod";

export const runCopilotAnalysisSchema = z.object({
  leadId: z.string().min(1),
  conversationId: z.string().min(1),
});

export const approveReplyDraftSchema = z.object({
  draftId: z.string().min(1),
});

export const rejectReplyDraftSchema = z.object({
  draftId: z.string().min(1),
});

export const sendApprovedDraftSchema = z.object({
  draftId: z.string().min(1),
});

export const acceptSuggestedActionSchema = z.object({
  actionId: z.string().min(1),
});

export const dismissSuggestedActionSchema = z.object({
  actionId: z.string().min(1),
});

export const resolveEscalationSchema = z.object({
  flagId: z.string().min(1),
  resolutionNote: z.string().optional(),
  isFalsePositive: z.boolean().optional(),
});

export const createEscalationSchema = z.object({
  leadId: z.string().min(1),
  conversationId: z.string().optional(),
  reason: z.nativeEnum(AIEscalationReason),
  notes: z.string().optional(),
});

export const suggestReplyDraftSchema = z.object({
  conversationId: z.string().min(1),
});
