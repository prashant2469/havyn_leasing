// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTwilioInboundSmsWebhookUrl,
  getTwilioStatusCallbackUrl,
  isPublicHttpsWebhookBase,
  resolveWebhookAppOrigin,
} from "@/server/services/outbound/twilio-webhook-url";

describe("Twilio webhook origin (StatusCallback)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers VERCEL_URL when NEXT_PUBLIC_APP_URL is localhost http", () => {
    vi.stubEnv("VERCEL_URL", "havyn-leasing-abc.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(resolveWebhookAppOrigin()).toBe("https://havyn-leasing-abc.vercel.app");
  });

  it("returns null when only localhost is configured", () => {
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(resolveWebhookAppOrigin()).toBeNull();
  });

  it("uses NEXT_PUBLIC_APP_URL when it is public https", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://apply.example.com");
    expect(resolveWebhookAppOrigin()).toBe("https://apply.example.com");
    expect(getTwilioStatusCallbackUrl()).toBe("https://apply.example.com/api/webhooks/twilio/status");
    expect(getTwilioInboundSmsWebhookUrl()).toBe("https://apply.example.com/api/webhooks/twilio/sms");
  });

  it("rejects non-https and private hosts", () => {
    expect(isPublicHttpsWebhookBase("http://example.com")).toBe(false);
    expect(isPublicHttpsWebhookBase("https://localhost")).toBe(false);
    expect(isPublicHttpsWebhookBase("https://10.0.0.1")).toBe(false);
    expect(isPublicHttpsWebhookBase("https://192.168.1.1")).toBe(false);
    expect(isPublicHttpsWebhookBase("https://172.16.0.1")).toBe(false);
    expect(isPublicHttpsWebhookBase("https://example.com")).toBe(true);
  });
});
