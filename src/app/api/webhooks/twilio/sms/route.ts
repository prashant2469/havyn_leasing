import { ListingChannelType } from "@prisma/client";
import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/api-route-response";
import { normalizePhoneToE164, isSmsOptInKeyword, isSmsOptOutKeyword } from "@/lib/phone";
import { prisma } from "@/server/db/client";
import { ingestInquiry, resolveLeadByPhone } from "@/server/services/channels/inquiry-ingest.service";
import {
  resolveTwilioOrganizationId,
  twimlResponse,
  validateTwilioFormSignature,
} from "@/server/services/outbound/twilio-webhook.service";

export const maxDuration = 60;

function splitName(profileName: string | null | undefined): { firstName: string; lastName: string } {
  const normalized = profileName?.trim();
  if (!normalized) return { firstName: "SMS", lastName: "Prospect" };
  const [firstName, ...rest] = normalized.split(/\s+/);
  return { firstName, lastName: rest.join(" ") || "Prospect" };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const signatureOk = await validateTwilioFormSignature(request, formData);
    if (!signatureOk) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
    }

    const organizationId = await resolveTwilioOrganizationId();
    if (!organizationId) {
      return NextResponse.json({ error: "organization_not_configured" }, { status: 500 });
    }

    const fromRaw = String(formData.get("From") ?? "").trim();
    const toRaw = String(formData.get("To") ?? "").trim();
    const profileName = String(formData.get("ProfileName") ?? "").trim();
    const messageSid = String(formData.get("MessageSid") ?? "").trim();
    const bodyRaw = String(formData.get("Body") ?? "");
    const mediaCount = Number(formData.get("NumMedia") ?? "0");

    const from = normalizePhoneToE164(fromRaw);
    const to = normalizePhoneToE164(toRaw);
    if (!from || !to) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }

    const configuredFrom = normalizePhoneToE164(process.env.TWILIO_FROM_NUMBER);
    if (configuredFrom && to !== configuredFrom) {
      return NextResponse.json({ error: "unexpected_to_number" }, { status: 400 });
    }

    const trimmedBody = bodyRaw.trim();
    if (isSmsOptOutKeyword(trimmedBody)) {
      await prisma.smsConsent.upsert({
        where: { organizationId_phone: { organizationId, phone: from } },
        update: {
          status: "OPTED_OUT",
          optOutAt: new Date(),
          optOutKeyword: trimmedBody.toUpperCase(),
        },
        create: {
          organizationId,
          phone: from,
          status: "OPTED_OUT",
          optOutAt: new Date(),
          optOutKeyword: trimmedBody.toUpperCase(),
        },
      });
      return twimlResponse(
        "<Message>You are unsubscribed and will no longer receive SMS from Havyn.</Message>",
      );
    }

    if (isSmsOptInKeyword(trimmedBody)) {
      await prisma.smsConsent.upsert({
        where: { organizationId_phone: { organizationId, phone: from } },
        update: {
          status: "OPTED_IN",
          optInAt: new Date(),
        },
        create: {
          organizationId,
          phone: from,
          status: "OPTED_IN",
          optInAt: new Date(),
        },
      });
    } else {
      const consent = await prisma.smsConsent.findUnique({
        where: { organizationId_phone: { organizationId, phone: from } },
        select: { status: true },
      });
      if (consent?.status === "OPTED_OUT") {
        return twimlResponse();
      }
    }

    const existingLead = await resolveLeadByPhone({
      organizationId,
      phone: from,
    });
    const name = splitName(profileName);

    const body =
      trimmedBody ||
      (mediaCount > 0
        ? `[Inbound MMS] Prospect sent ${mediaCount} media attachment${mediaCount > 1 ? "s" : ""}.`
        : "[Inbound SMS without body]");

    await ingestInquiry(
      { organizationId, actorUserId: null },
      {
        channelType: ListingChannelType.SMS,
        listingId: existingLead?.listingId ?? null,
        contact: {
          firstName: existingLead?.firstName ?? name.firstName,
          lastName: existingLead?.lastName ?? name.lastName,
          email: existingLead?.email ?? null,
          phone: from,
        },
        message: body,
        externalLeadId: from,
        externalThreadId: `sms:${from}:${to}`,
        sourceMetadata: {
          provider: "twilio",
          messageSid: messageSid || null,
          from,
          to,
          numMedia: mediaCount,
        },
      },
    );

    return twimlResponse();
  } catch (error) {
    return jsonApiError(error);
  }
}
