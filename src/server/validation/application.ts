import { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

function optionalTrimmed(maxLen: number) {
  return z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .transform((v) => {
      if (v === undefined || v === null) return undefined;
      const t = String(v).trim();
      if (!t) return undefined;
      return t.length > maxLen ? t.slice(0, maxLen) : t;
    });
}

function optionalNumber(max = 1_000_000_000) {
  return z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
    return n;
  }, z.number().optional());
}

export const applicationIntakeSchema = z.object({
  employer: optionalTrimmed(500),
  jobTitle: optionalTrimmed(200),
  monthlyIncome: optionalNumber(),
  otherIncome: optionalNumber(),
  creditScoreRange: optionalTrimmed(80),
  desiredLeaseStart: optionalTrimmed(64),
  leaseTermMonths: optionalNumber(120),
  occupants: optionalNumber(50),
  currentAddress: optionalTrimmed(500),
  currentResidenceMonths: optionalNumber(1200),
  landlordName: optionalTrimmed(200),
  landlordPhone: optionalTrimmed(64),
  moveReason: optionalTrimmed(500),
  petsDescription: optionalTrimmed(2000),
  vehicleParking: optionalTrimmed(500),
  emergencyContactName: optionalTrimmed(200),
  emergencyContactPhone: optionalTrimmed(64),
  additionalNotes: optionalTrimmed(4000),
});

export type ApplicationIntakePayload = z.infer<typeof applicationIntakeSchema>;

export { APPLICATION_INTAKE_LABELS } from "@/domains/leasing/application-intake";

export const createApplicationSchema = z.object({
  leadId: z.string().cuid(),
  payload: applicationIntakeSchema,
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationStatusSchema = z.object({
  applicationId: z.string().cuid(),
  status: z.nativeEnum(ApplicationStatus),
});

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;

export const updateApplicationPipelineSchema = z.object({
  applicationId: z.string().cuid(),
  waitingOn: z.union([z.literal("prospect"), z.literal("internal"), z.literal("")]).optional(),
  pipelineNote: z.string().max(2000).optional(),
});

export type UpdateApplicationPipelineInput = z.infer<typeof updateApplicationPipelineSchema>;

export function parseApplicationIntakeFromFormData(formData: FormData): ApplicationIntakePayload {
  const get = (k: string) => {
    const v = formData.get(k);
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
  };

  const raw: Record<string, unknown> = {
    employer: get("employer"),
    jobTitle: get("jobTitle"),
    monthlyIncome: get("monthlyIncome"),
    otherIncome: get("otherIncome"),
    creditScoreRange: get("creditScoreRange"),
    desiredLeaseStart: get("desiredLeaseStart"),
    leaseTermMonths: get("leaseTermMonths"),
    occupants: get("occupants"),
    currentAddress: get("currentAddress"),
    currentResidenceMonths: get("currentResidenceMonths"),
    landlordName: get("landlordName"),
    landlordPhone: get("landlordPhone"),
    moveReason: get("moveReason"),
    petsDescription: get("petsDescription"),
    vehicleParking: get("vehicleParking"),
    emergencyContactName: get("emergencyContactName"),
    emergencyContactPhone: get("emergencyContactPhone"),
    additionalNotes: get("additionalNotes"),
  };

  const jsonBlob = get("intakePayloadJson");
  if (jsonBlob) {
    try {
      const parsed: unknown = JSON.parse(jsonBlob);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(raw, parsed as Record<string, unknown>);
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  return applicationIntakeSchema.parse(raw);
}
