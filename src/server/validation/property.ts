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
