import { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

export const createApplicationSchema = z.object({
  leadId: z.string().cuid(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationStatusSchema = z.object({
  applicationId: z.string().cuid(),
  status: z.nativeEnum(ApplicationStatus),
});

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
