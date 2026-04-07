import { ConversationReplyMode, ListingChannelType } from "@prisma/client";
import { z } from "zod";

export const publishListingChannelSchema = z.object({
  listingChannelId: z.string().cuid(),
});
export type PublishListingChannelInput = z.infer<typeof publishListingChannelSchema>;

export const pauseListingChannelSchema = z.object({
  listingChannelId: z.string().cuid(),
});
export type PauseListingChannelInput = z.infer<typeof pauseListingChannelSchema>;

export const unpublishListingChannelSchema = z.object({
  listingChannelId: z.string().cuid(),
});
export type UnpublishListingChannelInput = z.infer<typeof unpublishListingChannelSchema>;

export const retryListingChannelSyncSchema = z.object({
  listingChannelId: z.string().cuid(),
});
export type RetryListingChannelSyncInput = z.infer<typeof retryListingChannelSyncSchema>;

export const updateConversationReplyModeSchema = z.object({
  conversationId: z.string().cuid(),
  replyMode: z.nativeEnum(ConversationReplyMode),
});
export type UpdateConversationReplyModeInput = z.infer<
  typeof updateConversationReplyModeSchema
>;

export const attachChannelSchema = z.object({
  listingId: z.string().cuid(),
  channelType: z.nativeEnum(ListingChannelType),
});
export type AttachChannelInput = z.infer<typeof attachChannelSchema>;
