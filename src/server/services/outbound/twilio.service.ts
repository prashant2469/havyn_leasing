/**
 * Twilio outbound SMS — requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
 */
export async function sendTransactionalSms(input: {
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

  const { default: twilio } = await import("twilio");
  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    from,
    to: input.to,
    body: input.body,
  });
  if (!message.sid) {
    throw new Error("Twilio returned no sid");
  }
  return { id: message.sid };
}
