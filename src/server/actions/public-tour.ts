"use server";

import { ListingChannelType, MessageChannel, Prisma, TourStatus } from "@prisma/client";

import { ActivityVerbs } from "@/domains/activity/verbs";
import { getAutomationOrgContext } from "@/server/auth/automation-context";
import { prisma } from "@/server/db/client";
import { logActivity } from "@/server/services/activity/activity.service";
import { ingestInquiry } from "@/server/services/channels/inquiry-ingest.service";
import { logOutboundAutomationMessage } from "@/server/services/communications/conversation.service";
import { transitionAfterTourBooked } from "@/server/services/leasing/stage-machine.service";
import { getPublishedPublicListing } from "@/server/services/listings/public-listing.service";
import { sendTransactionalEmail } from "@/server/services/outbound/resend.service";
import { generateTourSlots } from "@/server/services/tours/slot-generator.service";
import { scheduleTourReminders } from "@/server/services/tours/tour-reminders.service";
import { publicBookTourSchema, publicScheduleTourSchema } from "@/server/validation/public-tour";

export type PublicTourActionState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function submitPublicScheduleTourAction(
  _prev: PublicTourActionState,
  formData: FormData,
): Promise<PublicTourActionState> {
  try {
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
      website: formData.get("website") || "",
    };
    const input = publicScheduleTourSchema.parse(raw);

    if (input.website?.trim()) {
      return { ok: true, message: "Thanks — we'll be in touch shortly." };
    }

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

    await ingestInquiry(
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
          path: `/r/${input.orgSlug}/${input.listingSlug}`,
        },
      },
    );

    return {
      ok: true,
      message: "Thanks — we received your tour request. Check your email for next steps.",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
    return { ok: false, message };
  }
}

export async function bookPublicTourSlotAction(
  _prev: PublicTourActionState,
  formData: FormData,
): Promise<PublicTourActionState> {
  try {
    const raw = {
      orgSlug: formData.get("orgSlug"),
      listingSlug: formData.get("listingSlug"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      slotIso: formData.get("slotIso"),
      website: formData.get("website") || "",
    };
    const input = publicBookTourSchema.parse(raw);

    if (input.website?.trim()) {
      return { ok: true, message: "Your tour is confirmed." };
    }

    const listing = await getPublishedPublicListing(input.orgSlug, input.listingSlug);
    if (!listing) {
      return { ok: false, message: "This listing is not available." };
    }

    const property = listing.unit.property;
    const slots = generateTourSlots(property.showingSchedule, new Date(), 12);
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
        scheduledAt,
        notes: "Booked via public listing",
        status: TourStatus.SCHEDULED,
      },
    });

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
    const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
    return { ok: false, message };
  }
}
