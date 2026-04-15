/**
 * Resend outbound email — requires RESEND_API_KEY and RESEND_FROM_EMAIL in production.
 */

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ id: string } | { skipped: true; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.warn("[resend] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping send.");
    return { skipped: true, reason: "missing_env" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error("Resend returned no id");
  }
  return { id: data.id };
}
