/**
 * Twilio outbound SMS — requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
 */
import { normalizePhoneToE164 } from "@/lib/phone";
import { prisma } from "@/server/db/client";
import { getTwilioStatusCallbackUrl } from "@/server/services/outbound/twilio-webhook-url";

export async function sendTransactionalSms(input: {
  organizationId?: string;
  to: string;
  body: string;
}): Promise<{ id: string } | { skipped: true; reason: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !from) {
    console.warn("[twilio] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER not set — skipping send.");
    return { skipped: true, reason: "missing_env" };
  }

  const normalizedTo = normalizePhoneToE164(input.to);
  if (!normalizedTo) {
    return { skipped: true, reason: "invalid_phone" };
  }

  if (input.organizationId) {
    const consent = await prisma.smsConsent.findUnique({
      where: { organizationId_phone: { organizationId: input.organizationId, phone: normalizedTo } },
      select: { status: true },
    });
    if (consent?.status === "OPTED_OUT") {
      return { skipped: true, reason: "opted_out" };
    }
  }

  const { default: twilio } = await import("twilio");
  const client = twilio(accountSid, authToken);
  const statusCallback = getTwilioStatusCallbackUrl();
  try {
    const message = await client.messages.create({
      from,
      to: normalizedTo,
      body: input.body,
      ...(statusCallback ? { statusCallback } : {}),
    });
    if (!message.sid) {
      throw new Error("Twilio returned no sid");
    }
    return { id: message.sid };
  } catch (error) {
    const maybeTwilioError = error as {
      code?: number;
      status?: number;
      moreInfo?: string;
      message?: string;
    };
    console.error("[twilio.send] error", {
      code: maybeTwilioError.code,
      status: maybeTwilioError.status,
      moreInfo: maybeTwilioError.moreInfo,
      message: maybeTwilioError.message,
    });
    throw error;
  }
}
