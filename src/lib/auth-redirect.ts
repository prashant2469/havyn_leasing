const DEFAULT_AUTH_REDIRECT = "/leasing";

const BLOCKED_PATH_PREFIXES = ["/login", "/api/auth"];
const TRANSIENT_QUERY_KEYS = ["next_direct", "next", "nextUrl", "__nextDefaultLocale"];

function toUrl(value: string): URL | null {
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value);
    }
    return new URL(value, "http://localhost");
  } catch {
    return null;
  }
}

export function normalizeAuthRedirect(rawValue?: string | null): string {
  const candidate = rawValue?.trim();
  if (!candidate) return DEFAULT_AUTH_REDIRECT;

  const parsed = toUrl(candidate);
  if (!parsed) return DEFAULT_AUTH_REDIRECT;
  if (!parsed.pathname.startsWith("/")) return DEFAULT_AUTH_REDIRECT;
  if (BLOCKED_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return DEFAULT_AUTH_REDIRECT;
  }

  const query = new URLSearchParams(parsed.search);
  for (const key of TRANSIENT_QUERY_KEYS) query.delete(key);
  const cleanedQuery = query.toString();

  return `${parsed.pathname}${cleanedQuery ? `?${cleanedQuery}` : ""}`;
}
