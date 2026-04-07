import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AIActionStatus,
  AIActionType,
  ApplicationStatus,
  ChannelPublishState,
  ChannelPublishStatus,
  ChannelSyncOperation,
  ChannelSyncStatus,
  ConversationReplyMode,
  LeadInboxStage,
  LeadStatus,
  ListingChannelType,
  ListingStatus,
  MembershipRole,
  MessageAuthorType,
  MessageChannel,
  MessageDirection,
  NextActionType,
  PrismaClient,
  QualificationSource,
  TourStatus,
  UnitStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

/** Writes dev stub IDs so Next.js picks them up without manual copy-paste. */
function writeDevEnvLocal(organizationId: string, userId: string) {
  const envLocal = resolve(process.cwd(), ".env.local");
  let content = existsSync(envLocal) ? readFileSync(envLocal, "utf8") : "";
  const upsert = (key: string, value: string) => {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, "m");
    content = re.test(content)
      ? content.replace(re, line)
      : `${content.replace(/\s*$/, "")}\n${line}\n`;
  };
  upsert("DEV_ORGANIZATION_ID", organizationId);
  upsert("DEV_USER_ID", userId);
  writeFileSync(envLocal, content.trimEnd() + "\n");
  console.log(`Wrote DEV_ORGANIZATION_ID and DEV_USER_ID to .env.local`);
  console.log("(Restart `npm run dev` if it was already running.)\n");
}

async function main() {
  await prisma.humanHandoffEvent.deleteMany();
  await prisma.aIAction.deleteMany();
  await prisma.qualificationAnswer.deleteMany();
  await prisma.communicationEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contactChannelIdentity.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.application.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.listingChannelSync.deleteMany();
  await prisma.listingChannel.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.resident.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: "Havyn Demo PM", slug: "havyn-demo" },
  });

  const admin = await prisma.user.create({
    data: { email: "admin@havyn.local", name: "Alex Admin" },
  });

  const manager = await prisma.user.create({
    data: { email: "manager@havyn.local", name: "Morgan Manager" },
  });

  await prisma.membership.createMany({
    data: [
      { userId: admin.id, organizationId: org.id, role: MembershipRole.OWNER },
      { userId: manager.id, organizationId: org.id, role: MembershipRole.MANAGER },
    ],
  });

  const property = await prisma.property.create({
    data: {
      organizationId: org.id,
      name: "The Foundry",
      street: "100 Main St",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
    },
  });

  const unit101 = await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: "101",
      beds: 2,
      baths: 2,
      sqft: 950,
      status: UnitStatus.VACANT,
    },
  });

  await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: "102",
      beds: 1,
      baths: 1,
      sqft: 720,
      status: UnitStatus.OCCUPIED,
    },
  });

  const listing = await prisma.listing.create({
    data: {
      organizationId: org.id,
      unitId: unit101.id,
      title: "Bright 2BR · The Foundry 101",
      description: "Corner unit, W/D in unit, pet-friendly with deposit.",
      monthlyRent: 2400,
      availableFrom: new Date(),
      bedrooms: 2,
      bathrooms: 2,
      amenities: ["wd_in_unit", "parking", "gym"],
      petPolicy: "Cats and dogs under 40 lbs; $300 deposit.",
      status: ListingStatus.ACTIVE,
    },
  });

  const channelWebsite = await prisma.listingChannel.create({
    data: {
      listingId: listing.id,
      channelType: ListingChannelType.WEBSITE,
      publishStatus: ChannelPublishStatus.LIVE,
      publishState: ChannelPublishState.PUBLISHED,
      externalListingId: `web-${listing.id}`,
      replyModeDefault: ConversationReplyMode.IN_CHANNEL_REPLY,
      lastPublishedAt: new Date(),
      lastSyncedAt: new Date(),
      metadata: { url: `/listings/${listing.id}` },
    },
  });

  await prisma.listingChannelSync.create({
    data: {
      listingChannelId: channelWebsite.id,
      operation: ChannelSyncOperation.PUBLISH,
      status: ChannelSyncStatus.SUCCEEDED,
      startedAt: new Date(Date.now() - 5000),
      completedAt: new Date(),
      requestPayload: { listingId: listing.id },
      resultPayload: { externalListingId: `web-${listing.id}` },
    },
  });

  await prisma.listingChannel.create({
    data: {
      listingId: listing.id,
      channelType: ListingChannelType.MANUAL,
      publishStatus: ChannelPublishStatus.LIVE,
      publishState: ChannelPublishState.PUBLISHED,
      externalListingId: `manual-${listing.id}`,
      replyModeDefault: ConversationReplyMode.MANUAL_ONLY,
      lastPublishedAt: new Date(),
      lastSyncedAt: new Date(),
      metadata: { note: "Manual / inbox" },
    },
  });

  await prisma.listingChannel.create({
    data: {
      listingId: listing.id,
      channelType: ListingChannelType.ZILLOW,
      publishStatus: ChannelPublishStatus.NOT_CONNECTED,
      publishState: ChannelPublishState.DRAFT,
      replyModeDefault: ConversationReplyMode.MANUAL_ONLY,
    },
  });

  await prisma.resident.create({
    data: {
      organizationId: org.id,
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie@example.com",
      phone: "+15125550123",
    },
  });

  const leadNew = await prisma.lead.create({
    data: {
      organizationId: org.id,
      propertyId: property.id,
      primaryUnitId: unit101.id,
      listingId: listing.id,
      firstName: "Sam",
      lastName: "Chen",
      email: "sam@example.com",
      phone: "+15125550999",
      source: "Zillow",
      sourceChannelType: ListingChannelType.ZILLOW,
      sourceChannelRefId: "zillow-lead-001",
      sourceAttribution: {
        channelType: "ZILLOW",
        externalLeadId: "zillow-lead-001",
        ingestedAt: new Date().toISOString(),
      },
      firstResponseAt: new Date(),
      status: LeadStatus.NEW,
      inboxStage: LeadInboxStage.NEW_LEADS,
      assignedToUserId: manager.id,
    },
  });

  await prisma.contactChannelIdentity.create({
    data: {
      leadId: leadNew.id,
      channelType: ListingChannelType.ZILLOW,
      handle: "sam@example.com",
      displayName: "Sam Chen",
      externalId: "zillow-lead-001",
    },
  });

  const leadAwaiting = await prisma.lead.create({
    data: {
      organizationId: org.id,
      listingId: listing.id,
      firstName: "Riley",
      lastName: "Nguyen",
      email: "riley@example.com",
      source: "Website",
      sourceChannelType: ListingChannelType.WEBSITE,
      sourceAttribution: {
        channelType: "WEBSITE",
        ingestedAt: new Date().toISOString(),
      },
      firstResponseAt: new Date(Date.now() - 86400000),
      lastResponseAt: new Date(),
      status: LeadStatus.CONTACTED,
      inboxStage: LeadInboxStage.AWAITING_RESPONSE,
      assignedToUserId: manager.id,
      nextActionAt: new Date(Date.now() + 3600000),
      nextActionType: NextActionType.FOLLOW_UP,
    },
  });

  const leadTour = await prisma.lead.create({
    data: {
      organizationId: org.id,
      listingId: listing.id,
      firstName: "Jordan",
      lastName: "Patel",
      email: "jordan@example.com",
      status: LeadStatus.TOURING,
      inboxStage: LeadInboxStage.TOUR_SCHEDULED,
      assignedToUserId: manager.id,
    },
  });

  await prisma.tour.create({
    data: {
      leadId: leadTour.id,
      listingId: listing.id,
      scheduledAt: new Date(Date.now() + 172800000),
      status: TourStatus.SCHEDULED,
      notes: "Morning preferred",
    },
  });

  const leadApp = await prisma.lead.create({
    data: {
      organizationId: org.id,
      listingId: listing.id,
      firstName: "Taylor",
      lastName: "Brooks",
      email: "taylor@example.com",
      status: LeadStatus.APPLIED,
      inboxStage: LeadInboxStage.APPLICATION_STARTED,
      assignedToUserId: manager.id,
    },
  });

  await prisma.application.create({
    data: {
      leadId: leadApp.id,
      status: ApplicationStatus.IN_REVIEW,
      payload: { employer: "Tech Co", incomeMonthly: 9200 },
    },
  });

  const leadReview = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Casey",
      lastName: "Diaz",
      email: "casey@example.com",
      status: LeadStatus.CONTACTED,
      inboxStage: LeadInboxStage.NEEDS_HUMAN_REVIEW,
      assignedToUserId: manager.id,
    },
  });

  await prisma.humanHandoffEvent.create({
    data: {
      organizationId: org.id,
      leadId: leadReview.id,
      fromUserId: manager.id,
      toUserId: admin.id,
      reason: "Pricing exception requested",
    },
  });

  await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Morgan",
      lastName: "Lee",
      email: "morgan@example.com",
      status: LeadStatus.LOST,
      inboxStage: LeadInboxStage.COLD_LEADS,
      assignedToUserId: manager.id,
    },
  });

  await prisma.qualificationAnswer.createMany({
    data: [
      {
        leadId: leadAwaiting.id,
        key: "monthlyIncome",
        value: 7800,
        source: QualificationSource.MANUAL,
      },
      {
        leadId: leadAwaiting.id,
        key: "moveInWindow",
        value: "Next 30 days",
        source: QualificationSource.MANUAL,
      },
    ],
  });

  const convoNew = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: leadNew.id,
      listingId: listing.id,
      subject: `${leadNew.firstName} ${leadNew.lastName} — ${listing.title}`,
      channelType: ListingChannelType.ZILLOW,
      replyMode: ConversationReplyMode.MANUAL_ONLY,
      externalThreadId: "zillow-thread-001",
      sourceMetadata: { source: "Zillow", externalLeadId: "zillow-lead-001" },
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convoNew.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.OTHER,
        body: "Is 101 still available for a June 1 move-in?",
        authorType: MessageAuthorType.CONTACT,
        isAiGenerated: false,
        channelMetadata: { sourceChannelType: "ZILLOW", externalLeadId: "zillow-lead-001" },
      },
    ],
  });

  const convoAwait = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: leadAwaiting.id,
      listingId: listing.id,
      subject: `${leadAwaiting.firstName} ${leadAwaiting.lastName}`,
      channelType: ListingChannelType.WEBSITE,
      replyMode: ConversationReplyMode.IN_CHANNEL_REPLY,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convoAwait.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.EMAIL,
        body: "Thanks for your interest — happy to share availability.",
        authorType: MessageAuthorType.USER,
        authorUserId: manager.id,
        isAiGenerated: false,
      },
      {
        conversationId: convoAwait.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.EMAIL,
        body: "Can we tour Saturday?",
        authorType: MessageAuthorType.CONTACT,
        isAiGenerated: false,
      },
    ],
  });

  await prisma.aIAction.create({
    data: {
      organizationId: org.id,
      leadId: leadNew.id,
      conversationId: convoNew.id,
      type: AIActionType.DRAFT_REPLY,
      status: AIActionStatus.PENDING_REVIEW,
      content: {
        text: "[Seed placeholder] Thanks for reaching out — 101 is available; I can offer tour slots.",
      },
    },
  });

  writeDevEnvLocal(org.id, manager.id);

  console.log("\n--- Havyn seed complete ---");
  console.log(`DEV_ORGANIZATION_ID="${org.id}"`);
  console.log(`DEV_USER_ID="${manager.id}"`);
  console.log("(Also written to .env.local. Use admin user id for OWNER-only checks if you add them later.)\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
