"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { logInboundPlaceholder, logOutboundMessage } from "@/server/services/communications/conversation.service";
import { logOutboundMessageSchema } from "@/server/validation/message";

export async function logOutboundMessageAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      leadId: formData.get("leadId"),
      channel: formData.get("channel"),
      body: formData.get("body"),
    };
    const input = logOutboundMessageSchema.parse(raw);
    await logOutboundMessage(ctx, input);
    revalidatePath(`/leasing/leads/${input.leadId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to log message";
    return { ok: false as const, message };
  }
}

export async function logInboundPlaceholderAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const leadId = String(formData.get("leadId"));
    const body = String(formData.get("body"));
    if (!body.trim()) throw new Error("Body required");
    await logInboundPlaceholder(ctx, leadId, body);
    revalidatePath(`/leasing/leads/${leadId}`);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to log inbound";
    return { ok: false as const, message };
  }
}
