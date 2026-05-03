import twilio from "twilio";

import {
  getTwilioInboundSmsWebhookUrl,
  isPublicHttpsWebhookBase,
} from "../src/server/services/outbound/twilio-webhook-url";

type Args = {
  origin: string | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  let origin: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--origin") {
      origin = (argv[i + 1] ?? "").trim() || null;
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
    }
  }

  return { origin, dryRun };
}

function resolveTargetWebhookUrl(args: Args): string {
  if (args.origin) {
    const normalized = args.origin.replace(/\/+$/, "");
    if (!isPublicHttpsWebhookBase(normalized)) {
      throw new Error("`--origin` must be a public HTTPS URL.");
    }
    return `${normalized}/api/webhooks/twilio/sms`;
  }

  const fromEnv = getTwilioInboundSmsWebhookUrl();
  if (!fromEnv) {
    throw new Error(
      "Could not resolve webhook URL from env. Set VERCEL_URL or NEXT_PUBLIC_APP_URL, or pass --origin.",
    );
  }
  return fromEnv;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required.");
  }

  const targetWebhook = resolveTargetWebhookUrl(args);
  const client = twilio(accountSid, authToken);

  const numbers = await client.incomingPhoneNumbers.list({
    phoneNumber: fromNumber,
    limit: 1,
  });
  const number = numbers[0];
  if (!number) {
    throw new Error(`Twilio phone number not found for TWILIO_FROM_NUMBER=${fromNumber}`);
  }

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          fromNumber,
          sid: number.sid,
          currentSmsUrl: number.smsUrl ?? null,
          targetSmsUrl: targetWebhook,
          smsMethod: "POST",
        },
        null,
        2,
      ),
    );
    return;
  }

  const updated = await client.incomingPhoneNumbers(number.sid).update({
    smsUrl: targetWebhook,
    smsMethod: "POST",
  });

  console.log(
    JSON.stringify(
      {
        updated: true,
        fromNumber,
        sid: updated.sid,
        smsUrl: updated.smsUrl ?? null,
        smsMethod: updated.smsMethod ?? null,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
