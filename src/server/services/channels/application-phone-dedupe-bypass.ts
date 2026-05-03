import { normalizePhoneToE164 } from "@/lib/phone";

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
  return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
}

/**
 * When true, `ingestInquiry` skips matching an existing lead by **email or phone / SMS identity**
 * so QA can submit multiple inquiries/applications with the same number (and same test email)
 * on the same listing.
 *
 * Controlled by server-only env; see `.env.example`, `.env.development`, and `vercel.json`.
 */
export function shouldBypassPhoneLeadDedupe(input: {
  organizationId: string;
  contactPhoneRaw: string | null | undefined;
}): boolean {
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
