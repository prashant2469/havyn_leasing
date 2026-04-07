import { LeaseStatus } from "@prisma/client";
import { z } from "zod";

export const createLeaseFromApplicationSchema = z.object({
  applicationId: z.string().cuid(),
  unitId: z.string().cuid(),
  residentId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  rentAmount: z.coerce.number().positive(),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  status: z.nativeEnum(LeaseStatus).default(LeaseStatus.DRAFT),
});

export type CreateLeaseFromApplicationInput = z.infer<typeof createLeaseFromApplicationSchema>;
