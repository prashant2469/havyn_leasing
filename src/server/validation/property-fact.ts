import { PropertyFactCategory } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().max(4000).optional().nullable();

export const createPropertyFactSchema = z.object({
  propertyId: z.string().cuid(),
  unitId: z.string().cuid().optional().nullable(),
  category: z.nativeEnum(PropertyFactCategory),
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(4000),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export type CreatePropertyFactInput = z.infer<typeof createPropertyFactSchema>;

export const updatePropertyFactSchema = z.object({
  id: z.string().cuid(),
  propertyId: z.string().cuid(),
  unitId: z.string().cuid().optional().nullable(),
  category: z.nativeEnum(PropertyFactCategory).optional(),
  question: optionalText,
  answer: optionalText,
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export type UpdatePropertyFactInput = z.infer<typeof updatePropertyFactSchema>;

export const deletePropertyFactSchema = z.object({
  id: z.string().cuid(),
  propertyId: z.string().cuid(),
});

export type DeletePropertyFactInput = z.infer<typeof deletePropertyFactSchema>;

export const seedPropertyFactsSchema = z.object({
  propertyId: z.string().cuid(),
  overwriteEmptyAnswers: z.boolean().default(false).optional(),
});

export type SeedPropertyFactsInput = z.infer<typeof seedPropertyFactsSchema>;

export const importStructuredPropertyFactsSchema = z.object({
  propertyId: z.string().cuid(),
  overwriteExistingQuestions: z.boolean().default(false).optional(),
});

export type ImportStructuredPropertyFactsInput = z.infer<
  typeof importStructuredPropertyFactsSchema
>;
