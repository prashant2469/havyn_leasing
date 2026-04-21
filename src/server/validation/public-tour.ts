import { z } from "zod";

export const publicScheduleTourSchema = z.object({
  orgSlug: z.string().min(1).max(200),
  listingSlug: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(320),
  phone: z.string().max(40).optional().or(z.literal("")),
  preferredDate: z.string().min(1).max(200).trim(),
  timeWindow: z.string().min(1).max(200).trim(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  hasPets: z.enum(["yes", "no", ""]).optional(),
  petsDescription: z.string().max(500).optional().or(z.literal("")),
  website: z.string().optional(),
});

export const publicBookTourSchema = z.object({
  orgSlug: z.string().min(1).max(200),
  listingSlug: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(320),
  slotIso: z.string().min(1).max(80),
  website: z.string().optional(),
});

export type PublicScheduleTourInput = z.infer<typeof publicScheduleTourSchema>;
export type PublicBookTourInput = z.infer<typeof publicBookTourSchema>;
