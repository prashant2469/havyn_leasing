const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize user-supplied phone values into E.164 for reliable matching/sending.
 * Assumes US by default when country code is omitted.
 */
export function normalizePhoneToE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const hasPlusPrefix = raw.startsWith("+");
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let normalized: string;
  if (hasPlusPrefix) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.length === 10) {
    normalized = `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    normalized = `+${digitsOnly}`;
  } else {
    return null;
  }

  return E164_REGEX.test(normalized) ? normalized : null;
}

export function isSmsOptOutKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().toUpperCase();
  return new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]).has(normalized);
}

export function isSmsOptInKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().toUpperCase();
  return new Set(["START", "UNSTOP", "YES"]).has(normalized);
}
