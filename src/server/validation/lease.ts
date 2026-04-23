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

const optionalText = z.string().trim().optional();

export const fastTrackLeaseSchema = z
  .object({
    leadId: z.string().cuid(),
    applicationId: z.string().cuid().optional().nullable(),
    residentId: z.string().cuid().optional().nullable(),
    residentFirstName: optionalText,
    residentLastName: optionalText,
    residentEmail: z.string().email().optional().nullable().or(z.literal("")),
    residentPhone: optionalText.or(z.literal("")),
    unitId: z.string().cuid(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    rentAmount: z.coerce.number().positive(),
    depositAmount: z.coerce.number().nonnegative().optional().nullable(),
    status: z.nativeEnum(LeaseStatus).default(LeaseStatus.DRAFT),
  })
  .superRefine((input, ctx) => {
    if (input.residentId) return;
    if (!input.residentFirstName || !input.residentLastName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Resident first and last name are required when no resident is selected",
        path: ["residentFirstName"],
      });
    }
  });

export type FastTrackLeaseInput = z.infer<typeof fastTrackLeaseSchema>;
