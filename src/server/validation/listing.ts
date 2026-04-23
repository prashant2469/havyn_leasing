import { ListingChannelType, ListingStatus } from "@prisma/client";
import { z } from "zod";

/** Empty string / null → null; allows 0 (studio / half-bath). Undefined → field omitted in partial updates. */
const optionalNonNegativeNumber = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === "" || v === null) return null;
  return v;
}, z.union([z.null(), z.coerce.number().min(0)]).optional());

export const createListingSchema = z.object({
  unitId: z.string().cuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional().or(z.literal("")),
  monthlyRent: z.coerce.number().positive(),
  availableFrom: z.coerce.date().optional().nullable(),
  bedrooms: optionalNonNegativeNumber,
  bathrooms: optionalNonNegativeNumber,
  amenities: z.array(z.string()).optional(),
  petPolicy: z.string().max(500).optional().or(z.literal("")),
  metadata: z.record(z.string(), z.any()).optional(),
  status: z.nativeEnum(ListingStatus).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

const optionalPublicSlug = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === "" || v === null) return null;
  return String(v).trim().toLowerCase();
}, z.union([z.null(), z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120)]).optional());

export const updateListingSchema = createListingSchema.partial().extend({
  id: z.string().cuid(),
  publicSlug: optionalPublicSlug,
});

export type UpdateListingInput = z.infer<typeof updateListingSchema>;

export const attachListingChannelSchema = z.object({
  listingId: z.string().cuid(),
  channelType: z.nativeEnum(ListingChannelType),
});

export type AttachListingChannelInput = z.infer<typeof attachListingChannelSchema>;
