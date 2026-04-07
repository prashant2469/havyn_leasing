import { ListingChannelType } from "@prisma/client";
import { z } from "zod";

export const ingestInquirySchema = z.object({
  channelType: z.nativeEnum(ListingChannelType),
  listingId: z.string().cuid().optional().nullable(),
  contact: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
    phone: z.union([z.string().max(30), z.literal(""), z.null()]).optional(),
  }),
  message: z.string().min(1).max(5000),
  externalLeadId: z.string().max(200).optional(),
  externalThreadId: z.string().max(200).optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type IngestInquiryInput = z.infer<typeof ingestInquirySchema>;
