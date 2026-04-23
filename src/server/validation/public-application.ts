import { z } from "zod";

import { applicationIntakeSchema } from "@/server/validation/application";

export const publicApplicationFormSchema = z.object({
  orgSlug: z.string().min(1).max(200),
  listingSlug: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(320),
  phone: z.string().max(40).optional().or(z.literal("")),
  ...applicationIntakeSchema.shape,
  hasPets: z.enum(["yes", "no", ""]).optional(),
  website: z.string().optional(),
});

export type PublicApplicationFormInput = z.infer<typeof publicApplicationFormSchema>;
