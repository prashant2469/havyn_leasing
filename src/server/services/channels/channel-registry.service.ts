import { ListingChannelType } from "@prisma/client";

import type { ChannelAdapter } from "./adapter.interface";
import { ManualAdapter } from "./adapters/manual.adapter";
import { StubAdapter } from "./adapters/stub.adapter";
import { WebsiteAdapter } from "./adapters/website.adapter";

// ---------------------------------------------------------------------------
// Registry — maps channel types to adapter instances
// ---------------------------------------------------------------------------

const registry = new Map<ListingChannelType, ChannelAdapter>([
  [ListingChannelType.WEBSITE, new WebsiteAdapter()],
  [ListingChannelType.MANUAL, new ManualAdapter()],
  // External stubs — replace with real adapters as integrations are built
  [ListingChannelType.ZILLOW, new StubAdapter(ListingChannelType.ZILLOW)],
  [
    ListingChannelType.FACEBOOK_MARKETPLACE,
    new StubAdapter(ListingChannelType.FACEBOOK_MARKETPLACE),
  ],
  [ListingChannelType.EMAIL, new StubAdapter(ListingChannelType.EMAIL)],
  [ListingChannelType.SMS, new StubAdapter(ListingChannelType.SMS)],
  [ListingChannelType.OTHER, new StubAdapter(ListingChannelType.OTHER)],
]);

export function getAdapter(channelType: ListingChannelType): ChannelAdapter {
  const adapter = registry.get(channelType);
  if (!adapter) {
    throw new Error(`No adapter registered for channel type: ${channelType}`);
  }
  return adapter;
}

export function getAllAdapters(): ChannelAdapter[] {
  return Array.from(registry.values());
}

export function getAdapterCapabilities(channelType: ListingChannelType) {
  return getAdapter(channelType).capabilities;
}

export function isChannelPublishable(channelType: ListingChannelType): boolean {
  return getAdapter(channelType).capabilities.canPublish;
}
