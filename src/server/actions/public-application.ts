"use server";

import { ListingChannelType, Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { ingestInquiry } from "@/server/services/channels/inquiry-ingest.service";
import { prisma } from "@/server/db/client";
import { createPublicApplication } from "@/server/services/leasing/application.service";
import { getPublishedPublicListing } from "@/server/services/listings/public-listing.service";
import { applicationIntakeSchema } from "@/server/validation/application";
import { publicApplicationFormSchema } from "@/server/validation/public-application";

function mapPublicApplicationError(e: unknown): string {
  if (e instanceof ZodError) return "Please review the application and try again.";
  const msg = e instanceof Error ? e.message : "";
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.toLowerCase().includes("not available")) return "This listing is not currently available.";
  return "We couldn't submit your application. Please check your details and try again.";
}

export type PublicApplicationActionState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function submitPublicApplicationAction(
  _prev: PublicApplicationActionState,
  formData: FormData,
): Promise<PublicApplicationActionState> {
  try {
    const raw = {
      orgSlug: formData.get("orgSlug"),
      listingSlug: formData.get("listingSlug"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone") || "",
      employer: formData.get("employer") || "",
      jobTitle: formData.get("jobTitle") || "",
      monthlyIncome: formData.get("monthlyIncome") || "",
      otherIncome: formData.get("otherIncome") || "",
      desiredLeaseStart: formData.get("desiredLeaseStart") || "",
      leaseTermMonths: formData.get("leaseTermMonths") || "",
      occupants: formData.get("occupants") || "",
      petsDescription: formData.get("petsDescription") || "",
      vehicleParking: formData.get("vehicleParking") || "",
      emergencyContactName: formData.get("emergencyContactName") || "",
      emergencyContactPhone: formData.get("emergencyContactPhone") || "",
      additionalNotes: formData.get("additionalNotes") || "",
      hasPets: formData.get("hasPets") || "",
      website: formData.get("website") || "",
    };
    const input = publicApplicationFormSchema.parse(raw);

    if (input.website?.trim()) {
      return { ok: true, message: "Thanks — your application was submitted." };
    }

    const listing = await getPublishedPublicListing(input.orgSlug, input.listingSlug);
    if (!listing) {
      return { ok: false, message: "This listing is not available." };
    }

    const payload = applicationIntakeSchema.parse(input);
    const ingest = await ingestInquiry(
      { organizationId: listing.organizationId, actorUserId: null },
      {
        channelType: ListingChannelType.WEBSITE,
        listingId: listing.id,
        contact: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.trim(),
          phone: input.phone?.trim() || null,
        },
        message: "[Public application submitted]",
        sourceMetadata: {
          source: "public_microsite",
          intakeKind: "APPLICATION",
          path: `/r/${input.orgSlug}/${input.listingSlug}`,
        },
      },
    );

    await createPublicApplication(
      { organizationId: listing.organizationId, actorUserId: null },
      { leadId: ingest.leadId, payload: payload as Prisma.InputJsonValue },
    );

    const qualificationUpserts: Promise<unknown>[] = [];
    const trimmedPets = payload.petsDescription?.trim();
    if (input.hasPets === "yes" || input.hasPets === "no" || trimmedPets) {
      const petsValue = input.hasPets === "no" ? "no" : trimmedPets || (input.hasPets === "yes" ? "yes" : "provided");
      qualificationUpserts.push(
        prisma.qualificationAnswer.upsert({
          where: { leadId_key: { leadId: ingest.leadId, key: "pets" } },
          create: {
            leadId: ingest.leadId,
            key: "pets",
            value: petsValue as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
          update: {
            value: petsValue as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
        }),
      );
    }
    if (typeof payload.monthlyIncome === "number") {
      qualificationUpserts.push(
        prisma.qualificationAnswer.upsert({
          where: { leadId_key: { leadId: ingest.leadId, key: "monthlyIncome" } },
          create: {
            leadId: ingest.leadId,
            key: "monthlyIncome",
            value: payload.monthlyIncome as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
          update: {
            value: payload.monthlyIncome as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
        }),
      );
    }
    if (typeof payload.occupants === "number") {
      qualificationUpserts.push(
        prisma.qualificationAnswer.upsert({
          where: { leadId_key: { leadId: ingest.leadId, key: "occupants" } },
          create: {
            leadId: ingest.leadId,
            key: "occupants",
            value: payload.occupants as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
          update: {
            value: payload.occupants as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
        }),
      );
    }
    if (qualificationUpserts.length > 0) {
      await Promise.all(qualificationUpserts);
    }

    return {
      ok: true,
      message: "Application submitted. A leasing specialist will review it and follow up soon.",
    };
  } catch (e) {
    return { ok: false, message: mapPublicApplicationError(e) };
  }
}
