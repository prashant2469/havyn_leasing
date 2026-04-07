import { TourStatus } from "@prisma/client";
import { z } from "zod";

export const createTourSchema = z.object({
  leadId: z.string().cuid(),
  listingId: z.string().cuid().optional().nullable(),
  scheduledAt: z.coerce.date(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateTourInput = z.infer<typeof createTourSchema>;

export const updateTourStatusSchema = z.object({
  tourId: z.string().cuid(),
  status: z.nativeEnum(TourStatus),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type UpdateTourStatusInput = z.infer<typeof updateTourStatusSchema>;
