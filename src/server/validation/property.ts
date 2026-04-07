import { PropertyStatus } from "@prisma/client";
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
