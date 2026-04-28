import { TourStatus } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { getGoogleFreeBusyRangesForOrganization } from "@/server/services/google/google-calendar.service";
import type { BusyRange } from "@/server/services/tours/slot-generator.service";

/**
 * Internal conflict ranges from Havyn's own scheduled tours.
 */
export async function getInternalBusyRangesForProperty(
  organizationId: string,
  propertyId: string,
  from: Date,
  to: Date,
): Promise<BusyRange[]> {
  const tours = await prisma.tour.findMany({
    where: {
      status: TourStatus.SCHEDULED,
      scheduledAt: { gte: from, lte: to },
      lead: { organizationId },
      OR: [
        { propertyId },
        {
          listing: {
            unit: { propertyId },
          },
        },
      ],
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  return tours.map((t) => ({
    start: t.scheduledAt,
    end: new Date(t.scheduledAt.getTime() + t.durationMinutes * 60_000),
  }));
}

export async function getBusyRangesForProperty(
  organizationId: string,
  propertyId: string,
  from: Date,
  to: Date,
): Promise<BusyRange[]> {
  const [internalBusy, googleBusy] = await Promise.all([
    getInternalBusyRangesForProperty(organizationId, propertyId, from, to),
    getGoogleFreeBusyRangesForOrganization(organizationId, from, to),
  ]);
  return [...internalBusy, ...googleBusy];
}
