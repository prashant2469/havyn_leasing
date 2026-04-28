"use server";

import { ListingChannelType, Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { PUBLIC_INTAKE_HONEYPOT_FIELD, isPublicIntakeHoneypotTripped } from "@/lib/public-intake-honeypot";
import { ingestInquiry } from "@/server/services/channels/inquiry-ingest.service";
import { prisma } from "@/server/db/client";
import { createPublicApplication } from "@/server/services/leasing/application.service";
import { getPublishedPublicListing } from "@/server/services/listings/public-listing.service";
import { applicationIntakeSchema, type ApplicationIntakePayload } from "@/server/validation/application";
import { publicApplicationFormSchema } from "@/server/validation/public-application";

function mapPublicApplicationError(e: unknown): string {
  if (e instanceof ZodError) return "Please review the application and try again.";
  const msg = e instanceof Error ? e.message : "";
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.toLowerCase().includes("not available")) return "This listing is not currently available.";
  return "We couldn't submit your application. Please check your details and try again.";
}

/**
 * Inbound message staff see in the thread — not a placeholder; must stand alone in the inbox.
 */
function formatPublicApplicationInquiryBody(
  listingTitle: string,
  contact: { firstName: string; lastName: string; email: string; phone?: string | null },
  payload: ApplicationIntakePayload,
  hasPets: string,
): string {
  const lines: string[] = [
    "Rental application (public listing)",
    `Property / listing: ${listingTitle}`,
    "",
    "Contact",
    `${contact.firstName} ${contact.lastName}`,
    `Email: ${contact.email}`,
    `Phone: ${contact.phone?.trim() || "—"}`,
    "",
  ];
  if (payload.employer) lines.push(`Employer: ${payload.employer}`);
  if (payload.jobTitle) lines.push(`Job title: ${payload.jobTitle}`);
  if (typeof payload.monthlyIncome === "number") {
    lines.push(`Monthly income: $${payload.monthlyIncome.toLocaleString()}`);
  }
  if (typeof payload.otherIncome === "number" && payload.otherIncome > 0) {
    lines.push(`Other income: $${payload.otherIncome.toLocaleString()}`);
  }
  if (payload.creditScoreRange) lines.push(`Credit score range: ${payload.creditScoreRange}`);
  if (payload.desiredLeaseStart) lines.push(`Desired lease start: ${payload.desiredLeaseStart}`);
  if (typeof payload.leaseTermMonths === "number") {
    lines.push(`Lease term (months): ${payload.leaseTermMonths}`);
  }
  if (typeof payload.occupants === "number") lines.push(`Occupants: ${payload.occupants}`);
  if (payload.currentAddress) lines.push(`Current address: ${payload.currentAddress}`);
  if (typeof payload.currentResidenceMonths === "number") {
    lines.push(`Current residence (months): ${payload.currentResidenceMonths}`);
  }
  if (payload.landlordName || payload.landlordPhone) {
    lines.push(
      `Landlord: ${[payload.landlordName, payload.landlordPhone].filter(Boolean).join(" · ") || "—"}`,
    );
  }
  if (payload.moveReason) lines.push(`Reason for moving: ${payload.moveReason}`);

  if (hasPets === "no") {
    lines.push("Pets: no");
  } else if (hasPets === "yes" && payload.petsDescription?.trim()) {
    lines.push(`Pets: ${payload.petsDescription.trim()}`);
  } else if (hasPets === "yes") {
    lines.push("Pets: yes (see application record for details)");
  } else if (payload.petsDescription?.trim()) {
    lines.push(`Pets: ${payload.petsDescription.trim()}`);
  }
  if (payload.vehicleParking) lines.push(`Vehicle / parking: ${payload.vehicleParking}`);
  if (payload.emergencyContactName || payload.emergencyContactPhone) {
    lines.push(
      `Emergency contact: ${[payload.emergencyContactName, payload.emergencyContactPhone].filter(Boolean).join(" · ") || "—"}`,
    );
  }
  if (payload.additionalNotes) {
    lines.push("", "Additional notes", payload.additionalNotes);
  }
  lines.push(
    "",
    "—",
    "Full structured intake is saved on the Application. Use the Applications tab in Havyn to review and update status.",
  );
  return lines.join("\n");
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
    if (isPublicIntakeHoneypotTripped(formData)) {
      return { ok: true, message: "Thanks — your application was submitted." };
    }

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
      creditScoreRange: formData.get("creditScoreRange") || "",
      desiredLeaseStart: formData.get("desiredLeaseStart") || "",
      leaseTermMonths: formData.get("leaseTermMonths") || "",
      occupants: formData.get("occupants") || "",
      currentAddress: formData.get("currentAddress") || "",
      currentResidenceMonths: formData.get("currentResidenceMonths") || "",
      landlordName: formData.get("landlordName") || "",
      landlordPhone: formData.get("landlordPhone") || "",
      moveReason: formData.get("moveReason") || "",
      petsDescription: formData.get("petsDescription") || "",
      vehicleParking: formData.get("vehicleParking") || "",
      emergencyContactName: formData.get("emergencyContactName") || "",
      emergencyContactPhone: formData.get("emergencyContactPhone") || "",
      additionalNotes: formData.get("additionalNotes") || "",
      hasPets: formData.get("hasPets") || "",
      [PUBLIC_INTAKE_HONEYPOT_FIELD]: formData.get(PUBLIC_INTAKE_HONEYPOT_FIELD) || "",
    };
    const input = publicApplicationFormSchema.parse(raw);

    const listing = await getPublishedPublicListing(input.orgSlug, input.listingSlug);
    if (!listing) {
      return {
        ok: false,
        message:
          "This listing is not open for public applications. The owner must publish it on the website channel with a public link.",
      };
    }

    const payload = applicationIntakeSchema.parse(input);

    const threadMessage = formatPublicApplicationInquiryBody(
      listing.title,
      {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
      },
      payload,
      input.hasPets ?? "",
    );

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
        message: threadMessage,
        sourceMetadata: {
          source: "public_microsite",
          intakeKind: "APPLICATION",
          path: `/r/${input.orgSlug}/${input.listingSlug}`,
        },
      },
    );

    try {
      await createPublicApplication(
        { organizationId: listing.organizationId, actorUserId: null },
        { leadId: ingest.leadId, payload: payload as Prisma.InputJsonValue },
      );
    } catch (err) {
      // Lead + thread exist; do not tell the user success if application record failed.
      console.error("[public-application] createPublicApplication failed after ingest", err);
      return {
        ok: false,
        message: "We saved your message but could not create the application record. Please contact the property directly or try again in a few minutes.",
      };
    }

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
    if (payload.creditScoreRange) {
      qualificationUpserts.push(
        prisma.qualificationAnswer.upsert({
          where: { leadId_key: { leadId: ingest.leadId, key: "creditScoreRange" } },
          create: {
            leadId: ingest.leadId,
            key: "creditScoreRange",
            value: payload.creditScoreRange as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
          update: {
            value: payload.creditScoreRange as Prisma.InputJsonValue,
            source: "MANUAL",
            metadata: { source: "public_application" },
          },
        }),
      );
    }
    if (qualificationUpserts.length > 0) {
      try {
        await Promise.all(qualificationUpserts);
      } catch (e) {
        console.error("[public-application] qualification upserts failed", e);
        // application + thread already succeeded; non-fatal
      }
    }

    return {
      ok: true,
      message: "Application submitted. A leasing specialist will review it and follow up soon.",
    };
  } catch (e) {
    return { ok: false, message: mapPublicApplicationError(e) };
  }
}
