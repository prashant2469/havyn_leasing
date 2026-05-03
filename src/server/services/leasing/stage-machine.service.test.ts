import { LeadInboxStage, LeadStatus, MembershipRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { transitionAfterFirstOutreach } from "./stage-machine.service";

const { prismaMock, recordActivityMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  recordActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/services/activity/activity.service", () => ({
  recordActivity: recordActivityMock,
}));

describe("transitionAfterFirstOutreach", () => {
  beforeEach(() => {
    prismaMock.lead.findFirst.mockReset();
    prismaMock.lead.update.mockReset();
    recordActivityMock.mockReset();
  });

  it("moves NEW_INQUIRY to AWAITING_RESPONSE", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: "lead_1",
      inboxStage: LeadInboxStage.NEW_INQUIRY,
      status: LeadStatus.NEW,
    });

    await transitionAfterFirstOutreach(
      { organizationId: "org_1", userId: "user_1", role: MembershipRole.OWNER },
      "lead_1",
    );

    expect(prismaMock.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: {
        inboxStage: LeadInboxStage.AWAITING_RESPONSE,
        status: LeadStatus.CONTACTED,
      },
    });
    expect(recordActivityMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing for already active stage", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: "lead_1",
      inboxStage: LeadInboxStage.AWAITING_RESPONSE,
      status: LeadStatus.CONTACTED,
    });

    await transitionAfterFirstOutreach(
      { organizationId: "org_1", userId: "user_1", role: MembershipRole.OWNER },
      "lead_1",
    );

    expect(prismaMock.lead.update).not.toHaveBeenCalled();
    expect(recordActivityMock).not.toHaveBeenCalled();
  });
});
