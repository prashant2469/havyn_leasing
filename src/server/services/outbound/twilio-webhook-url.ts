/**
 * Resolves the public HTTPS origin Twilio can POST status callbacks to.
 * Kept separate from `twilio.service.ts` so it stays importable in tests without Prisma/env.
 */

export function isPublicHttpsWebhookBase(base: string): boolean {
  let url: URL;
  try {
    url = new URL(base.endsWith("/") ? base.slice(0, -1) : base);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
  if (h.endsWith(".local")) return false;
  if (h.startsWith("10.") || h.startsWith("192.168.")) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

/**
 * Prefer `VERCEL_URL` before `NEXT_PUBLIC_APP_URL` so a dev `.env.local` with localhost does not
 * override the real deployment host on Vercel.
 */
export function resolveWebhookAppOrigin(): string | null {
  const candidates: string[] = [];
  const next = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (next) candidates.push(next.replace(/\/+$/, ""));
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) candidates.push(`https://${vercel}`);

  for (const raw of candidates) {
    if (isPublicHttpsWebhookBase(raw)) return new URL(raw).origin;
  }
  return null;
}

export function getTwilioStatusCallbackUrl(): string | null {
  const origin = resolveWebhookAppOrigin();
  if (!origin) return null;
  return `${origin.replace(/\/+$/, "")}/api/webhooks/twilio/status`;
}

export function getTwilioInboundSmsWebhookUrl(): string | null {
  const origin = resolveWebhookAppOrigin();
  if (!origin) return null;
  return `${origin.replace(/\/+$/, "")}/api/webhooks/twilio/sms`;
}
