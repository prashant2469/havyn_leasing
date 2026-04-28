"use server";

import { ListingChannelType, Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { PUBLIC_INTAKE_HONEYPOT_FIELD, isPublicIntakeHoneypotTripped } from "@/lib/public-intake-honeypot";
import { ingestInquiry } from "@/server/services/channels/inquiry-ingest.service";
import { prisma } from "@/server/db/client";
import { getPublishedPublicListing } from "@/server/services/listings/public-listing.service";
import { publicInquiryFormSchema } from "@/server/validation/public-inquiry";

function mapPublicInquiryError(e: unknown): string {
  if (e instanceof ZodError) return "Please review the form and try again.";
  const msg = e instanceof Error ? e.message : "";
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.toLowerCase().includes("not available")) return "This listing is not currently available.";
  return "We couldn't submit your request. Please check your details and try again.";
}

export type PublicInquiryActionState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function submitPublicInquiryAction(
  _prev: PublicInquiryActionState,
  formData: FormData,
): Promise<PublicInquiryActionState> {
  try {
    if (isPublicIntakeHoneypotTripped(formData)) {
      return { ok: true, message: "Thanks — we'll be in touch shortly." };
    }

    const raw = {
      orgSlug: formData.get("orgSlug"),
      listingSlug: formData.get("listingSlug"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email") || "",
      phone: formData.get("phone") || "",
      message: formData.get("message"),
      hasPets: formData.get("hasPets") || "",
      petsDescription: formData.get("petsDescription") || "",
      [PUBLIC_INTAKE_HONEYPOT_FIELD]: formData.get(PUBLIC_INTAKE_HONEYPOT_FIELD) || "",
    };
    const input = publicInquiryFormSchema.parse(raw);

    if (!input.email?.trim() && !input.phone?.trim()) {
      return { ok: false, message: "Please provide an email or phone number so we can reach you." };
    }

    const listing = await getPublishedPublicListing(input.orgSlug, input.listingSlug);
    if (!listing) {
      return { ok: false, message: "This listing is not available." };
    }

    const ingest = await ingestInquiry(
      { organizationId: listing.organizationId, actorUserId: null },
      {
        channelType: ListingChannelType.WEBSITE,
        listingId: listing.id,
        contact: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
        },
        message: input.message,
        sourceMetadata: {
          source: "public_microsite",
          path: `/r/${input.orgSlug}/${input.listingSlug}`,
          hasPets: input.hasPets || null,
          petsDescription: input.petsDescription?.trim() || null,
        },
      },
    );

    if (input.hasPets === "yes" || input.hasPets === "no") {
      const petsValue =
        input.hasPets === "yes"
          ? input.petsDescription?.trim() || "yes"
          : "no";

      await prisma.qualificationAnswer.upsert({
        where: { leadId_key: { leadId: ingest.leadId, key: "pets" } },
        create: {
          leadId: ingest.leadId,
          key: "pets",
          value: petsValue as Prisma.InputJsonValue,
          source: "MANUAL",
          metadata: { source: "public_inquiry" },
        },
        update: {
          value: petsValue as Prisma.InputJsonValue,
          source: "MANUAL",
          metadata: { source: "public_inquiry" },
        },
      });
    }

    return {
      ok: true,
      message: "Thanks — your message was sent. A leasing specialist will follow up soon.",
    };
  } catch (e) {
    return { ok: false, message: mapPublicInquiryError(e) };
  }
}
