"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import {
  loadCopilotContext,
  runCopilotAnalysis,
} from "@/server/services/ai/ai-copilot.service";
import { resolveEscalation } from "@/server/services/ai/escalation.service";
import {
  computeLeadPriority,
} from "@/server/services/ai/lead-priority.service";
import {
  approveReplyDraft,
  rejectReplyDraft,
  sendApprovedDraft,
  suggestReplyDraft,
} from "@/server/services/ai/reply-draft.service";
import {
  acceptSuggestedAction,
  dismissSuggestedAction,
} from "@/server/services/ai/suggested-action.service";
import {
  approveReplyDraftSchema,
  createEscalationSchema,
  dismissSuggestedActionSchema,
  rejectReplyDraftSchema,
  resolveEscalationSchema,
  runCopilotAnalysisSchema,
  sendApprovedDraftSchema,
  suggestReplyDraftSchema,
} from "@/server/validation/ai-copilot";
import { createEscalationFlag } from "@/server/services/ai/escalation.service";
import { acceptSuggestedActionSchema } from "@/server/validation/ai-copilot";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function runCopilotAnalysisAction(
  _prev: ActionResult<Awaited<ReturnType<typeof runCopilotAnalysis>>> | null,
  formData: FormData,
): Promise<ActionResult<Awaited<ReturnType<typeof runCopilotAnalysis>>>> {
  try {
    const ctx = await requireOrgContext();
    const input = runCopilotAnalysisSchema.parse({
      leadId: formData.get("leadId"),
      conversationId: formData.get("conversationId"),
    });
    const result = await runCopilotAnalysis(ctx, input.leadId, input.conversationId);
    revalidatePath(`/leasing/leads/${input.leadId}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function approveReplyDraftAction(
  _prev: ActionResult<{ draftId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ draftId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const { draftId } = approveReplyDraftSchema.parse({ draftId: formData.get("draftId") });
    await approveReplyDraft(ctx, draftId);
    revalidatePath("/leasing");
    return { success: true, data: { draftId } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function rejectReplyDraftAction(
  _prev: ActionResult<{ draftId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ draftId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const { draftId } = rejectReplyDraftSchema.parse({ draftId: formData.get("draftId") });
    await rejectReplyDraft(ctx, draftId);
    revalidatePath("/leasing");
    return { success: true, data: { draftId } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function sendApprovedDraftAction(
  _prev: ActionResult<{ draftId: string; messageId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ draftId: string; messageId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const { draftId } = sendApprovedDraftSchema.parse({ draftId: formData.get("draftId") });
    const { messageId } = await sendApprovedDraft(ctx, draftId);
    revalidatePath("/leasing");
    return { success: true, data: { draftId, messageId } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function suggestReplyDraftAction(
  _prev: ActionResult<{ draftId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ draftId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const { conversationId } = suggestReplyDraftSchema.parse({
      conversationId: formData.get("conversationId"),
    });
    const draft = await suggestReplyDraft(ctx, conversationId);
    revalidatePath("/leasing");
    return { success: true, data: { draftId: draft.id } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function acceptSuggestedActionAction(
  _prev: ActionResult<{ actionId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ actionId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const { actionId } = acceptSuggestedActionSchema.parse({ actionId: formData.get("actionId") });
    await acceptSuggestedAction(ctx, actionId);
    revalidatePath("/leasing");
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/leads");
    return { success: true, data: { actionId } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function dismissSuggestedActionAction(
  _prev: ActionResult<{ actionId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ actionId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const { actionId } = dismissSuggestedActionSchema.parse({
      actionId: formData.get("actionId"),
    });
    await dismissSuggestedAction(ctx, actionId);
    revalidatePath("/leasing");
    return { success: true, data: { actionId } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function resolveEscalationAction(
  _prev: ActionResult<{ flagId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ flagId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const input = resolveEscalationSchema.parse({
      flagId: formData.get("flagId"),
      resolutionNote: formData.get("resolutionNote") ?? undefined,
      isFalsePositive: formData.get("isFalsePositive") === "true",
    });
    await resolveEscalation(ctx, input.flagId, input.resolutionNote, input.isFalsePositive);
    revalidatePath("/leasing");
    return { success: true, data: { flagId: input.flagId } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function createEscalationAction(
  _prev: ActionResult<{ flagId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ flagId: string }>> {
  try {
    const ctx = await requireOrgContext();
    const input = createEscalationSchema.parse({
      leadId: formData.get("leadId"),
      conversationId: formData.get("conversationId") ?? undefined,
      reason: formData.get("reason"),
      notes: formData.get("notes") ?? undefined,
    });
    const flag = await createEscalationFlag(ctx, input);
    revalidatePath("/leasing");
    return { success: true, data: { flagId: flag.id } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}

export async function refreshLeadPriorityAction(
  _prev: ActionResult<{ tier: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ tier: string }>> {
  try {
    const ctx = await requireOrgContext();
    const leadId = formData.get("leadId") as string;
    if (!leadId) throw new Error("leadId required");
    const signal = await computeLeadPriority(ctx, leadId);
    revalidatePath(`/leasing/leads/${leadId}`);
    return { success: true, data: { tier: signal.priorityTier } };
  } catch (e) {
    return { success: false, error: String(e instanceof Error ? e.message : e) };
  }
}
