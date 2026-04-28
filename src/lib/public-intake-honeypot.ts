/**
 * Shared anti-bot field for public lead forms. Must be empty; if filled, treat as bot
 * and return a silent success (do not process).
 * Not named `website` to avoid accidental overlap with autofill heuristics.
 */
export const PUBLIC_INTAKE_HONEYPOT_FIELD = "hp_trap" as const;

export function isPublicIntakeHoneypotTripped(formData: FormData): boolean {
  const v = formData.get(PUBLIC_INTAKE_HONEYPOT_FIELD);
  return typeof v === "string" && v.trim().length > 0;
}
