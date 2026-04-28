import { z } from "zod";

import { PUBLIC_INTAKE_HONEYPOT_FIELD } from "@/lib/public-intake-honeypot";

export const publicInquiryFormSchema = z.object({
  orgSlug: z.string().min(1).max(200),
  listingSlug: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.union([z.string().email().max(320), z.literal("")]).optional(),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().min(1).max(5000).trim(),
  hasPets: z.enum(["yes", "no", ""]).optional(),
  petsDescription: z.string().max(500).optional().or(z.literal("")),
  [PUBLIC_INTAKE_HONEYPOT_FIELD]: z.string().optional(),
});

export type PublicInquiryFormInput = z.infer<typeof publicInquiryFormSchema>;
