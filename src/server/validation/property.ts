import { PropertyStatus, UnitStatus } from "@prisma/client";
import { z } from "zod";

export const createPropertySchema = z.object({
  name: z.string().min(1).max(200),
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).default("US"),
  status: z.nativeEnum(PropertyStatus).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  parkingType: z.string().max(80).optional().nullable(),
  parkingSpaces: z.number().int().min(0).max(1000).optional().nullable(),
  laundryType: z.string().max(80).optional().nullable(),
  yearBuilt: z.number().int().min(1700).max(3000).optional().nullable(),
  propertyType: z.string().max(80).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  transitNotes: z.string().max(4000).optional().nullable(),
  schoolDistrict: z.string().max(200).optional().nullable(),
  petRules: z.record(z.string(), z.any()).optional(),
  amenities: z.array(z.string()).optional(),
  utilityNotes: z.string().max(4000).optional().nullable(),
  leaseTerms: z.record(z.string(), z.any()).optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const createUnitSchema = z.object({
  propertyId: z.string().cuid(),
  unitNumber: z.string().min(1).max(50),
  beds: z.number().positive().optional(),
  baths: z.number().positive().optional(),
  sqft: z.number().int().positive().optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updatePropertySchema = createPropertySchema.extend({
  id: z.string().cuid(),
  showingSchedule: z.record(z.string(), z.any()).optional(),
});

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const deletePropertySchema = z.object({
  id: z.string().cuid(),
});

export type DeletePropertyInput = z.infer<typeof deletePropertySchema>;

export const updateUnitSchema = z.object({
  id: z.string().cuid(),
  propertyId: z.string().cuid(),
  unitNumber: z.string().min(1).max(50),
  beds: z.number().nonnegative().nullable().optional(),
  baths: z.number().nonnegative().nullable().optional(),
  sqft: z.number().int().nonnegative().nullable().optional(),
  status: z.nativeEnum(UnitStatus),
});

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
