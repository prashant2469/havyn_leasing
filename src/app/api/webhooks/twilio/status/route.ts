import { CommunicationEventType } from "@prisma/client";
import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/api-route-response";
import { prisma } from "@/server/db/client";
import { recordActivity } from "@/server/services/activity/activity.service";
import { validateTwilioFormSignature } from "@/server/services/outbound/twilio-webhook.service";

function mapSmsStatusToEventType(status: string): CommunicationEventType {
  switch (status) {
    case "delivered":
      return CommunicationEventType.DELIVERED;
    case "failed":
      return CommunicationEventType.FAILED;
    case "undelivered":
      return CommunicationEventType.UNDELIVERED;
    default:
      return CommunicationEventType.NOTE;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const signatureOk = await validateTwilioFormSignature(request, formData);
    if (!signatureOk) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
    }

    const messageSid = String(formData.get("MessageSid") ?? "").trim();
    const smsStatus = String(formData.get("MessageStatus") ?? formData.get("SmsStatus") ?? "").trim();
    const errorCode = String(formData.get("ErrorCode") ?? "").trim();
    const errorMessage = String(formData.get("ErrorMessage") ?? "").trim();

    if (!messageSid || !smsStatus) {
      return NextResponse.json({ error: "missing_status_payload" }, { status: 400 });
    }

    const message = await prisma.message.findFirst({
      where: { externalId: messageSid },
      include: { conversation: { select: { organizationId: true, leadId: true } } },
    });
    if (!message) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const type = mapSmsStatusToEventType(smsStatus.toLowerCase());

    await prisma.communicationEvent.create({
      data: {
        conversationId: message.conversationId,
        messageId: message.id,
        type,
        metadata: {
          provider: "twilio",
          messageSid,
          smsStatus,
          errorCode: errorCode || null,
          errorMessage: errorMessage || null,
        },
      },
    });

    if (type === CommunicationEventType.FAILED || type === CommunicationEventType.UNDELIVERED) {
      await recordActivity({
        ctx: { organizationId: message.conversation.organizationId, actorUserId: null },
        verb: "message.delivery_failed",
        entityType: "Message",
        entityId: message.id,
        metadata: {
          leadId: message.conversation.leadId,
          provider: "twilio",
          messageSid,
          smsStatus,
          errorCode: errorCode || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonApiError(error);
  }
}
