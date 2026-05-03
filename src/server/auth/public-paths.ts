export const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/r/",
  "/api/webhooks/twilio/",
  "/api/feeds/zillow-rental",
  "/api/jobs/run",
] as const;

export const PUBLIC_EXACT_PATHS = ["/favicon.ico", "/havyn-theme-boot.js", "/auth/callback"] as const;

export function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(path as (typeof PUBLIC_EXACT_PATHS)[number])) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}
