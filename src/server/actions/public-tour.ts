"use server";

import { ListingChannelType, MessageChannel, Prisma, TourStatus } from "@prisma/client";
import { ZodError } from "zod";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { PUBLIC_INTAKE_HONEYPOT_FIELD, isPublicIntakeHoneypotTripped } from "@/lib/public-intake-honeypot";
import { getAutomationOrgContext } from "@/server/auth/automation-context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import { ingestInquiry } from "@/server/services/channels/inquiry-ingest.service";
import { logOutboundAutomationMessage } from "@/server/services/communications/conversation.service";
import { transitionAfterTourBooked } from "@/server/services/leasing/stage-machine.service";
import { getPublishedPublicListing } from "@/server/services/listings/public-listing.service";
import { sendTransactionalEmail } from "@/server/services/outbound/resend.service";
import { upsertGoogleTourEventForOrganization } from "@/server/services/google/google-calendar.service";
import { getBusyRangesForProperty } from "@/server/services/tours/availability.service";
import { generateAvailableTourSlots } from "@/server/services/tours/slot-generator.service";
import { scheduleTourReminders } from "@/server/services/tours/tour-reminders.service";
import { publicBookTourSchema, publicScheduleTourSchema } from "@/server/validation/public-tour";

function mapPublicTourError(e: unknown): string {
  if (e instanceof ZodError) return "Please review the form and try again.";
  const msg = e instanceof Error ? e.message : "";
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.toLowerCase().includes("no longer available")) return "That tour slot is no longer available. Please choose another time.";
  if (msg.toLowerCase().includes("couldn't find your inquiry")) return "Please send a message first, then book with the same email.";
  return "We couldn't submit your request. Please check your details and try again.";
}

export type PublicTourActionState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function submitPublicScheduleTourAction(
  _prev: PublicTourActionState,
  formData: FormData,
): Promise<PublicTourActionState> {
  try {
    if (isPublicIntakeHoneypotTripped(formData)) {
      return { ok: true, message: "Thanks — we'll be in touch shortly." };
    }

    const raw = {
      orgSlug: formData.get("orgSlug"),
      listingSlug: formData.get("listingSlug"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone") || "",
      preferredDate: formData.get("preferredDate"),
      timeWindow: formData.get("timeWindow"),
      notes: formData.get("notes") || "",
      hasPets: formData.get("hasPets") || "",
      petsDescription: formData.get("petsDescription") || "",
      [PUBLIC_INTAKE_HONEYPOT_FIELD]: formData.get(PUBLIC_INTAKE_HONEYPOT_FIELD) || "",
    };
    const input = publicScheduleTourSchema.parse(raw);

    const listing = await getPublishedPublicListing(input.orgSlug, input.listingSlug);
    if (!listing) {
      return { ok: false, message: "This listing is not available." };
    }

    const message = [
      "[Schedule tour request]",
      `Preferred date: ${input.preferredDate}`,
      `Time window: ${input.timeWindow}`,
      input.notes?.trim() ? `Notes: ${input.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

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
        message,
        sourceMetadata: {
          source: "public_microsite",
          intakeKind: "SCHEDULE_TOUR",
          preferredDate: input.preferredDate,
          timeWindow: input.timeWindow,
          notes: input.notes?.trim() ?? null,
          hasPets: input.hasPets || null,
          petsDescription: input.petsDescription?.trim() || null,
          path: `/r/${input.orgSlug}/${input.listingSlug}`,
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
          metadata: { source: "public_tour_request" },
        },
        update: {
          value: petsValue as Prisma.InputJsonValue,
          source: "MANUAL",
          metadata: { source: "public_tour_request" },
        },
      });
    }

    return {
      ok: true,
      message: "Thanks - we received your tour request. We'll follow up with next steps soon.",
    };
  } catch (e) {
    return { ok: false, message: mapPublicTourError(e) };
  }
}

export async function bookPublicTourSlotAction(
  _prev: PublicTourActionState,
  formData: FormData,
): Promise<PublicTourActionState> {
  try {
    if (isPublicIntakeHoneypotTripped(formData)) {
      return { ok: true, message: "Your tour is confirmed." };
    }

    const raw = {
      orgSlug: formData.get("orgSlug"),
      listingSlug: formData.get("listingSlug"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      slotIso: formData.get("slotIso"),
      [PUBLIC_INTAKE_HONEYPOT_FIELD]: formData.get(PUBLIC_INTAKE_HONEYPOT_FIELD) || "",
    };
    const input = publicBookTourSchema.parse(raw);

    const listing = await getPublishedPublicListing(input.orgSlug, input.listingSlug);
    if (!listing) {
      return { ok: false, message: "This listing is not available." };
    }

    const property = listing.unit.property;
    const from = new Date();
    const rangeEnd = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
    const internalBusy = await getBusyRangesForProperty(
      listing.organizationId,
      property.id,
      from,
      rangeEnd,
    );
    const slots = generateAvailableTourSlots(property.showingSchedule, from, 12, internalBusy);
    const allowed = new Set(slots.map((d) => d.toISOString()));
    if (!allowed.has(input.slotIso)) {
      return { ok: false, message: "That time slot is no longer available. Please pick another." };
    }

    const scheduledAt = new Date(input.slotIso);

    const lead = await prisma.lead.findFirst({
      where: {
        organizationId: listing.organizationId,
        listingId: listing.id,
        email: { equals: input.email.trim(), mode: "insensitive" },
      },
    });

    if (!lead) {
      return {
        ok: false,
        message: "We couldn't find your inquiry. Send a message first, then book a tour using the same email.",
      };
    }

    if (
      lead.firstName.trim().toLowerCase() !== input.firstName.trim().toLowerCase() ||
      lead.lastName.trim().toLowerCase() !== input.lastName.trim().toLowerCase()
    ) {
      return { ok: false, message: "Name doesn't match your original inquiry. Check spelling or contact the team." };
    }

    const conversation = await prisma.conversation.findFirst({
      where: { organizationId: listing.organizationId, leadId: lead.id },
    });

    const ctx = await getAutomationOrgContext(listing.organizationId);

    const tour = await prisma.tour.create({
      data: {
        leadId: lead.id,
        listingId: listing.id,
        propertyId: listing.unit.property.id,
        scheduledAt,
        notes: "Booked via public listing",
        status: TourStatus.SCHEDULED,
      },
    });
    await upsertGoogleTourEventForOrganization({
      organizationId: listing.organizationId,
      tourId: tour.id,
      startAt: tour.scheduledAt,
      durationMinutes: tour.durationMinutes,
      summary: `Tour: ${lead.firstName} ${lead.lastName}`,
      description: `Public booking for ${listing.title}`,
    }).catch(() => null);

    await transitionAfterTourBooked(ctx, lead.id);

    await scheduleTourReminders({
      organizationId: listing.organizationId,
      tourId: tour.id,
      leadId: lead.id,
      conversationId: conversation?.id ?? null,
      scheduledAt,
    });

    const when = scheduledAt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const confirmBody = `Hi ${lead.firstName},\n\nYour tour for ${listing.title} is confirmed for ${when}.\n\nWe look forward to meeting you!`;

    const to = lead.email?.trim();
    if (conversation) {
      const sendResult = to
        ? await sendTransactionalEmail({
            to,
            subject: `Tour confirmed — ${listing.title}`,
            text: confirmBody,
          })
        : ({ skipped: true } as const);
      if (to && !("skipped" in sendResult && sendResult.skipped)) {
        await logOutboundAutomationMessage(ctx, {
          conversationId: conversation.id,
          leadId: lead.id,
          body: confirmBody,
          channel: MessageChannel.EMAIL,
        });
      } else {
        await logOutboundAutomationMessage(ctx, {
          conversationId: conversation.id,
          leadId: lead.id,
          body: to
            ? `[Email not sent — configure RESEND] ${confirmBody}`
            : `[Confirmation — no email on file] ${confirmBody}`,
          channel: to ? MessageChannel.EMAIL : MessageChannel.IN_APP,
        });
      }
    }

    await logActivity({
      ctx: { organizationId: listing.organizationId, actorUserId: null },
      verb: ActivityVerbs.TOUR_SCHEDULED,
      entityType: "Tour",
      entityId: tour.id,
      metadata: {
        leadId: lead.id,
        listingId: listing.id,
        scheduledAt: scheduledAt.toISOString(),
        source: "public_microsite",
      } as Prisma.InputJsonValue,
    });

    return {
      ok: true,
      message: `You're booked for ${when}. A confirmation has been sent to your email when available.`,
    };
  } catch (e) {
    return { ok: false, message: mapPublicTourError(e) };
  }
}
