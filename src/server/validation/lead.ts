import { LeadInboxStage, LeadStatus, NextActionType } from "@prisma/client";
import { z } from "zod";

export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  source: z.string().max(200).optional().or(z.literal("")),
  propertyId: z.string().cuid().optional(),
  primaryUnitId: z.string().cuid().optional(),
  listingId: z.string().cuid().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadStatusSchema = z.object({
  leadId: z.string().cuid(),
  status: z.nativeEnum(LeadStatus),
  nextActionAt: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.date().nullable().optional(),
  ),
  nextActionType: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.nativeEnum(NextActionType).nullable().optional(),
  ),
});

export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

export const updateLeadInboxStageSchema = z.object({
  leadId: z.string().cuid(),
  inboxStage: z.nativeEnum(LeadInboxStage),
});

export type UpdateLeadInboxStageInput = z.infer<typeof updateLeadInboxStageSchema>;

export const updateLeadContactSchema = z.object({
  leadId: z.string().cuid(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.union([z.string().email().max(320), z.literal("")]).optional(),
  phone: z.string().max(40).optional().or(z.literal("")),
});

export type UpdateLeadContactInput = z.infer<typeof updateLeadContactSchema>;
