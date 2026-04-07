import { z } from "zod";

export const createResidentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
});

export type CreateResidentInput = z.infer<typeof createResidentSchema>;
