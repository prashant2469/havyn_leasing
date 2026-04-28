import { z } from "zod";

import { PUBLIC_INTAKE_HONEYPOT_FIELD } from "@/lib/public-intake-honeypot";
import { applicationIntakeSchema } from "@/server/validation/application";

export const publicApplicationFormSchema = z.object({
  orgSlug: z.string().min(1).max(200),
  listingSlug: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(320),
  phone: z.string().min(7).max(40).trim(),
  ...applicationIntakeSchema.shape,
  hasPets: z.enum(["yes", "no", ""]).optional(),
  /** Honeypot; must be empty. Not named `website` to avoid autofill misfires. */
  [PUBLIC_INTAKE_HONEYPOT_FIELD]: z.string().optional(),
});

export type PublicApplicationFormInput = z.infer<typeof publicApplicationFormSchema>;
