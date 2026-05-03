// @vitest-environment node

import { ListingChannelType } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldBypassPhoneLeadDedupe } from "./application-phone-dedupe-bypass";

describe("shouldBypassPhoneLeadDedupe", () => {
  const orgId = "org_test_1";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches allowlisted US 10-digit and E.164 for the same handset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_E164", "6506952683");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW", "true");

    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "(650) 695-2683",
        channelType: ListingChannelType.WEBSITE,
      }),
    ).toBe(true);

    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_E164", "+16506952683");
    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "6506952683",
        channelType: ListingChannelType.WEBSITE,
      }),
    ).toBe(true);
  });

  it("does not bypass dedupe for SMS channel", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_E164", "+16506952683");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW", "true");
    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "6506952683",
        channelType: ListingChannelType.SMS,
      }),
    ).toBe(false);
  });

  it("returns false when number is not on the allowlist", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_E164", "+16505551212");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW", "true");

    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "6506952683",
        channelType: ListingChannelType.WEBSITE,
      }),
    ).toBe(false);
  });

  it("allows bypass on Vercel production when number is allowlisted", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_E164", "+16506952683");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW", "true");

    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "+16506952683",
        channelType: ListingChannelType.WEBSITE,
      }),
    ).toBe(true);
  });

  it("honors APPLICATION_PHONE_DEDUPE_BYPASS_ORG_IDS when set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_E164", "+16506952683");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW", "true");
    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_ORG_IDS", "other_org");

    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "+16506952683",
        channelType: ListingChannelType.WEBSITE,
      }),
    ).toBe(false);

    vi.stubEnv("APPLICATION_PHONE_DEDUPE_BYPASS_ORG_IDS", `other_org,${orgId}`);
    expect(
      shouldBypassPhoneLeadDedupe({
        organizationId: orgId,
        contactPhoneRaw: "+16506952683",
        channelType: ListingChannelType.WEBSITE,
      }),
    ).toBe(true);
  });
});
