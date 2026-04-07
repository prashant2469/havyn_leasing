"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { ingestInquiry } from "@/server/services/channels/inquiry-ingest.service";
import {
  pauseListingChannel,
  publishListingToChannel,
  retryListingChannelSync,
  unpublishListingChannel,
} from "@/server/services/channels/listing-publish.service";
import { updateConversationReplyMode } from "@/server/services/channels/reply-strategy.service";
import { ingestInquirySchema } from "@/server/validation/inquiry";
import {
  pauseListingChannelSchema,
  publishListingChannelSchema,
  retryListingChannelSyncSchema,
  unpublishListingChannelSchema,
  updateConversationReplyModeSchema,
} from "@/server/validation/channel";

export async function publishListingChannelAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = publishListingChannelSchema.parse({
      listingChannelId: formData.get("listingChannelId"),
    });
    await publishListingToChannel(ctx, input.listingChannelId);
    revalidatePath("/listings");
    revalidatePath("/listings/[id]", "page");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function pauseListingChannelAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = pauseListingChannelSchema.parse({
      listingChannelId: formData.get("listingChannelId"),
    });
    await pauseListingChannel(ctx, input.listingChannelId);
    revalidatePath("/listings");
    revalidatePath("/listings/[id]", "page");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function unpublishListingChannelAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = unpublishListingChannelSchema.parse({
      listingChannelId: formData.get("listingChannelId"),
    });
    await unpublishListingChannel(ctx, input.listingChannelId);
    revalidatePath("/listings");
    revalidatePath("/listings/[id]", "page");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function retryListingChannelSyncAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = retryListingChannelSyncSchema.parse({
      listingChannelId: formData.get("listingChannelId"),
    });
    await retryListingChannelSync(ctx, input.listingChannelId);
    revalidatePath("/listings");
    revalidatePath("/listings/[id]", "page");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function ingestInquiryAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const raw = {
      channelType: formData.get("channelType"),
      listingId: formData.get("listingId") || null,
      contact: {
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email") || null,
        phone: formData.get("phone") || null,
      },
      message: formData.get("message"),
      externalLeadId: formData.get("externalLeadId") || undefined,
      externalThreadId: formData.get("externalThreadId") || undefined,
    };

    const input = ingestInquirySchema.parse(raw);
    const result = await ingestInquiry(ctx, input);

    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/leads");
    revalidatePath("/activity");

    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateConversationReplyModeAction(_prev: unknown, formData: FormData) {
  try {
    const ctx = await requireOrgContext();
    const input = updateConversationReplyModeSchema.parse({
      conversationId: formData.get("conversationId"),
      replyMode: formData.get("replyMode"),
    });
    const result = await updateConversationReplyMode(ctx, input.conversationId, input.replyMode);
    revalidatePath("/leasing/inbox");
    revalidatePath("/leasing/leads/[id]", "page");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
