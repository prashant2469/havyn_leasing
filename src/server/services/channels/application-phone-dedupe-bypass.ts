import { normalizePhoneToE164 } from "@/lib/phone";
import { ListingChannelType } from "@prisma/client";

/** Each CSV token is normalized to E.164 so `6506952683` and `+16506952683` match the same allowlist entry. */
function csvToNormalizedE164Set(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  const out = new Set<string>();
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    const e164 = normalizePhoneToE164(t);
    if (e164) out.add(e164);
  }
  return out;
}

function envAllowsBypassByDeployment(): boolean {
  if (process.env.APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW === "false") {
    return true;
  }
  // Preview + local dev + Vercel production. Safety is the E.164 allowlist — numbers not listed still dedupe normally.
  return (
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "development"
  );
}

/**
 * When true, `ingestInquiry` skips matching an existing lead by **email or phone / SMS identity**
 * so QA can submit multiple inquiries/applications with the same number (and same test email)
 * on the same listing.
 *
 * Controlled by server-only env; see `.env.example`, `.env.development`, and `vercel.json`.
 * With default `APPLICATION_PHONE_DEDUPE_BYPASS_REQUIRE_PREVIEW`, bypass runs on local dev, Vercel Preview,
 * and Vercel Production (still only for phones present in `APPLICATION_PHONE_DEDUPE_BYPASS_E164`).
 */
export function shouldBypassPhoneLeadDedupe(input: {
  organizationId: string;
  contactPhoneRaw: string | null | undefined;
  channelType: ListingChannelType;
}): boolean {
  // Bypass is only for public website/application style intake. SMS replies must continue
  // the same lead/conversation and therefore should never bypass dedupe.
  if (input.channelType !== ListingChannelType.WEBSITE) return false;

  const e164 = normalizePhoneToE164(input.contactPhoneRaw);
  if (!e164) return false;

  const allowlist = csvToNormalizedE164Set(process.env.APPLICATION_PHONE_DEDUPE_BYPASS_E164);
  if (!allowlist.has(e164)) return false;

  if (!envAllowsBypassByDeployment()) return false;

  const orgAllow = process.env.APPLICATION_PHONE_DEDUPE_BYPASS_ORG_IDS?.trim();
  if (orgAllow) {
    const orgIds = new Set(
      orgAllow
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (!orgIds.has(input.organizationId)) return false;
  }

  return true;
}
