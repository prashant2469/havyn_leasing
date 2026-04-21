import { ConversationReplyMode, ListingChannelType } from "@prisma/client";

export const replyModeLabel: Record<ConversationReplyMode, string> = {
  IN_CHANNEL_REPLY: "In-channel reply",
  REDIRECT_TO_OWNED_CHANNEL: "Redirect to owned channel",
  MANUAL_ONLY: "Manual only",
};

export const replyModeDescription: Record<ConversationReplyMode, string> = {
  IN_CHANNEL_REPLY:
    "Reply is sent back through the originating channel (e.g. Zillow thread, Facebook message).",
  REDIRECT_TO_OWNED_CHANNEL:
    "Lead is redirected to your owned channel (email or SMS) before replying.",
  MANUAL_ONLY: "No automated outbound. Agent handles all replies manually.",
};

export const replyModeColor: Record<ConversationReplyMode, string> = {
  IN_CHANNEL_REPLY: "default",
  REDIRECT_TO_OWNED_CHANNEL: "outline",
  MANUAL_ONLY: "secondary",
};

/** Channels that support local publish operations (no external API needed yet) */
export const LOCAL_PUBLISHABLE_CHANNELS: ListingChannelType[] = [
  ListingChannelType.WEBSITE,
  ListingChannelType.MANUAL,
];

/** Channels that are stubs — show UI but adapter returns not_supported */
export const EXTERNAL_CHANNEL_STUBS: ListingChannelType[] = [
  ListingChannelType.ZILLOW,
  ListingChannelType.FACEBOOK_MARKETPLACE,
  ListingChannelType.EMAIL,
  ListingChannelType.SMS,
];

/** Default reply mode per channel type */
export const defaultReplyModeForChannel: Record<ListingChannelType, ConversationReplyMode> = {
  WEBSITE: ConversationReplyMode.IN_CHANNEL_REPLY,
  ZILLOW: ConversationReplyMode.MANUAL_ONLY,
  FACEBOOK_MARKETPLACE: ConversationReplyMode.MANUAL_ONLY,
  EMAIL: ConversationReplyMode.REDIRECT_TO_OWNED_CHANNEL,
  SMS: ConversationReplyMode.REDIRECT_TO_OWNED_CHANNEL,
  MANUAL: ConversationReplyMode.MANUAL_ONLY,
  OTHER: ConversationReplyMode.MANUAL_ONLY,
};


export const messageDirectionLabel: Record<string, string> = {
  INBOUND: "Prospect",
  OUTBOUND: "Team",
};

export const messageChannelLabel: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  IN_APP: "Web",
  VOICE: "Call",
  OTHER: "Other",
};
