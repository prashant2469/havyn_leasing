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

  const orgB = await prisma.organization.create({
    data: { name: "Sunrise Residential", slug: "sunrise-demo" },
  });

  const admin = await prisma.user.create({
    data: { email: "admin@havyn.local", name: "Alex Admin" },
  });

  const manager = await prisma.user.create({
    data: { email: "manager@havyn.local", name: "Morgan Manager" },
  });

  const dualOrgUser = await prisma.user.create({
    data: { email: "dual@havyn.local", name: "Dana Dual-Org" },
  });

  await prisma.membership.createMany({
    data: [
      { userId: admin.id, organizationId: org.id, role: MembershipRole.OWNER },
      { userId: manager.id, organizationId: org.id, role: MembershipRole.MANAGER },
      { userId: dualOrgUser.id, organizationId: org.id, role: MembershipRole.STAFF },
      { userId: dualOrgUser.id, organizationId: orgB.id, role: MembershipRole.ADMIN },
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
      showingSchedule: {
        weekdayWindows: [{ weekdays: [1, 2, 3, 4, 5], start: "10:00", end: "16:00" }],
        tourDurationMinutes: 30,
      },
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

  const unit103 = await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: "103",
      beds: 2,
      baths: 1,
      sqft: 880,
      status: UnitStatus.NOTICE,
    },
  });

  const propertyLake = await prisma.property.create({
    data: {
      organizationId: org.id,
      name: "Lakeside Lofts",
      street: "400 Lakeview Blvd",
      city: "Austin",
      state: "TX",
      postalCode: "78704",
      showingSchedule: {
        weekdayWindows: [{ weekdays: [1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" }],
        tourDurationMinutes: 30,
      },
    },
  });

  const unitLake201 = await prisma.unit.create({
    data: {
      propertyId: propertyLake.id,
      unitNumber: "201",
      beds: 1,
      baths: 1,
      sqft: 640,
      status: UnitStatus.VACANT,
    },
  });

  const propertyB = await prisma.property.create({
    data: {
      organizationId: orgB.id,
      name: "Sunrise Court",
      street: "55 Sunrise Ave",
      city: "Dallas",
      state: "TX",
      postalCode: "75201",
      showingSchedule: {
        weekdayWindows: [{ weekdays: [1, 2, 3, 4, 5], start: "11:00", end: "15:00" }],
        tourDurationMinutes: 45,
      },
    },
  });

  const unitSunrise1 = await prisma.unit.create({
    data: {
      propertyId: propertyB.id,
      unitNumber: "A1",
      beds: 2,
      baths: 2,
      sqft: 1010,
      status: UnitStatus.VACANT,
    },
  });

  const listing = await prisma.listing.create({
    data: {
      organizationId: org.id,
      unitId: unit101.id,
      publicSlug: "foundry-101",
      title: "Bright 2BR · The Foundry 101",
      description:
        "Corner unit with floor-to-ceiling windows, W/D in unit, quartz counters, and a walkable score to downtown. Pet-friendly with deposit.",
      monthlyRent: 2400,
      availableFrom: new Date(),
      bedrooms: 2,
      bathrooms: 2,
      amenities: ["wd_in_unit", "parking", "gym", "hardwood_floors", "balcony"],
      petPolicy: "Cats and dogs under 40 lbs; $300 deposit.",
      status: ListingStatus.ACTIVE,
    },
  });

  await prisma.listingPhoto.createMany({
    data: [
      {
        listingId: listing.id,
        storageKey: "seed/foundry-primary",
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1400&auto=format&fit=crop&q=80",
        sortOrder: 0,
        isPrimary: true,
        caption: "Living area",
      },
      {
        listingId: listing.id,
        storageKey: "seed/foundry-2",
        url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&auto=format&fit=crop&q=80",
        sortOrder: 1,
        isPrimary: false,
      },
    ],
  });

  const listingLake = await prisma.listing.create({
    data: {
      organizationId: org.id,
      unitId: unitLake201.id,
      publicSlug: "lakeside-studio-201",
      title: "Studio loft · Lakeside 201",
      description: "Top floor studio, bike storage, steps from the trail.",
      monthlyRent: 1650,
      availableFrom: new Date(),
      bedrooms: 1,
      bathrooms: 1,
      amenities: ["bike_storage", "roof_deck"],
      status: ListingStatus.ACTIVE,
    },
  });

  await prisma.listingPhoto.createMany({
    data: [
      {
        listingId: listingLake.id,
        storageKey: "seed/lake-primary",
        url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1400&auto=format&fit=crop&q=80",
        sortOrder: 0,
        isPrimary: true,
      },
    ],
  });

  const listingSunrise = await prisma.listing.create({
    data: {
      organizationId: orgB.id,
      unitId: unitSunrise1.id,
      publicSlug: "sunrise-a1",
      title: "2BR corner · Sunrise Court A1",
      description: "Pool view, in-unit laundry, reserved parking.",
      monthlyRent: 2100,
      availableFrom: new Date(),
      bedrooms: 2,
      bathrooms: 2,
      amenities: ["pool", "wd_in_unit", "parking"],
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
      metadata: { url: `/r/havyn-demo/foundry-101` },
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

  const lakeWebsite = await prisma.listingChannel.create({
    data: {
      listingId: listingLake.id,
      channelType: ListingChannelType.WEBSITE,
      publishStatus: ChannelPublishStatus.LIVE,
      publishState: ChannelPublishState.PUBLISHED,
      externalListingId: `web-${listingLake.id}`,
      replyModeDefault: ConversationReplyMode.IN_CHANNEL_REPLY,
      lastPublishedAt: new Date(),
      lastSyncedAt: new Date(),
      metadata: { url: `/r/havyn-demo/lakeside-studio-201` },
    },
  });

  await prisma.listingChannel.create({
    data: {
      listingId: listingLake.id,
      channelType: ListingChannelType.MANUAL,
      publishStatus: ChannelPublishStatus.LIVE,
      publishState: ChannelPublishState.PUBLISHED,
      externalListingId: `manual-${listingLake.id}`,
      replyModeDefault: ConversationReplyMode.MANUAL_ONLY,
      lastPublishedAt: new Date(),
      lastSyncedAt: new Date(),
      metadata: {},
    },
  });

  const sunriseWebsite = await prisma.listingChannel.create({
    data: {
      listingId: listingSunrise.id,
      channelType: ListingChannelType.WEBSITE,
      publishStatus: ChannelPublishStatus.LIVE,
      publishState: ChannelPublishState.PUBLISHED,
      externalListingId: `web-${listingSunrise.id}`,
      replyModeDefault: ConversationReplyMode.IN_CHANNEL_REPLY,
      lastPublishedAt: new Date(),
      lastSyncedAt: new Date(),
      metadata: { url: `/r/sunrise-demo/sunrise-a1` },
    },
  });

  await prisma.listingChannel.create({
    data: {
      listingId: listingSunrise.id,
      channelType: ListingChannelType.MANUAL,
      publishStatus: ChannelPublishStatus.LIVE,
      publishState: ChannelPublishState.PUBLISHED,
      externalListingId: `manual-${listingSunrise.id}`,
      replyModeDefault: ConversationReplyMode.MANUAL_ONLY,
      lastPublishedAt: new Date(),
      lastSyncedAt: new Date(),
      metadata: {},
    },
  });

  await prisma.listingChannelSync.createMany({
    data: [
      {
        listingChannelId: lakeWebsite.id,
        operation: ChannelSyncOperation.PUBLISH,
        status: ChannelSyncStatus.SUCCEEDED,
        startedAt: new Date(Date.now() - 8000),
        completedAt: new Date(),
        requestPayload: { listingId: listingLake.id },
        resultPayload: { externalListingId: `web-${listingLake.id}` },
      },
      {
        listingChannelId: sunriseWebsite.id,
        operation: ChannelSyncOperation.PUBLISH,
        status: ChannelSyncStatus.SUCCEEDED,
        startedAt: new Date(Date.now() - 9000),
        completedAt: new Date(),
        requestPayload: { listingId: listingSunrise.id },
        resultPayload: { externalListingId: `web-${listingSunrise.id}` },
      },
    ],
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

  const leadOwnedWebsite = await prisma.lead.create({
    data: {
      organizationId: org.id,
      propertyId: property.id,
      primaryUnitId: unit101.id,
      listingId: listing.id,
      firstName: "Dana",
      lastName: "OwnedChannel",
      email: "dana.owned@example.com",
      source: "Website",
      sourceChannelType: ListingChannelType.WEBSITE,
      sourceAttribution: {
        channelType: "WEBSITE",
        source: "public_microsite",
        path: "/r/havyn-demo/foundry-101",
        ingestedAt: new Date().toISOString(),
      },
      inboxStage: LeadInboxStage.NEW_INQUIRY,
      status: LeadStatus.NEW,
      firstResponseAt: new Date(),
    },
  });

  const convoOwnedWebsite = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: leadOwnedWebsite.id,
      listingId: listing.id,
      subject: "Dana OwnedChannel",
      channelType: ListingChannelType.WEBSITE,
      replyMode: ConversationReplyMode.IN_CHANNEL_REPLY,
      sourceMetadata: { source: "public_microsite" },
    },
  });

  await prisma.message.create({
    data: {
      conversationId: convoOwnedWebsite.id,
      direction: MessageDirection.INBOUND,
      channel: MessageChannel.IN_APP,
      body: "Hi! I'd like to learn more about this listing.",
      authorType: MessageAuthorType.CONTACT,
      isAiGenerated: false,
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
      automationPaused: true,
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
      {
        conversationId: convoNew.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.OTHER,
        body: "Hi Sam — yes, June 1 works. Would you like a virtual or in-person tour?",
        authorType: MessageAuthorType.USER,
        authorUserId: manager.id,
        isAiGenerated: false,
        channelMetadata: { sourceChannelType: "ZILLOW" },
      },
      {
        conversationId: convoNew.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.OTHER,
        body: "In-person if possible — weekday afternoons.",
        authorType: MessageAuthorType.CONTACT,
        isAiGenerated: false,
        channelMetadata: { sourceChannelType: "ZILLOW" },
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

  const leadSunrise = await prisma.lead.create({
    data: {
      organizationId: orgB.id,
      propertyId: propertyB.id,
      primaryUnitId: unitSunrise1.id,
      listingId: listingSunrise.id,
      firstName: "Priya",
      lastName: "Shah",
      email: "priya@example.com",
      phone: "+14655550111",
      source: "Website",
      sourceChannelType: ListingChannelType.WEBSITE,
      status: LeadStatus.NEW,
      inboxStage: LeadInboxStage.NEW_LEADS,
      assignedToUserId: dualOrgUser.id,
    },
  });

  const convoSunrise = await prisma.conversation.create({
    data: {
      organizationId: orgB.id,
      leadId: leadSunrise.id,
      listingId: listingSunrise.id,
      subject: `${leadSunrise.firstName} ${leadSunrise.lastName}`,
      channelType: ListingChannelType.WEBSITE,
      replyMode: ConversationReplyMode.IN_CHANNEL_REPLY,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convoSunrise.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.IN_APP,
        body: "Is the pool heated year-round?",
        authorType: MessageAuthorType.CONTACT,
        isAiGenerated: false,
      },
      {
        conversationId: convoSunrise.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.IN_APP,
        body: "Hi Priya — yes, the pool is heated October through April.",
        authorType: MessageAuthorType.USER,
        authorUserId: dualOrgUser.id,
        isAiGenerated: false,
      },
    ],
  });

  const leadLake = await prisma.lead.create({
    data: {
      organizationId: org.id,
      propertyId: propertyLake.id,
      primaryUnitId: unitLake201.id,
      listingId: listingLake.id,
      firstName: "Chris",
      lastName: "Okonkwo",
      email: "chris@example.com",
      source: "Website",
      sourceChannelType: ListingChannelType.WEBSITE,
      status: LeadStatus.CONTACTED,
      inboxStage: LeadInboxStage.AWAITING_RESPONSE,
      assignedToUserId: manager.id,
    },
  });

  await prisma.tour.create({
    data: {
      leadId: leadLake.id,
      listingId: listingLake.id,
      scheduledAt: new Date(Date.now() + 86400000 * 3),
      status: TourStatus.SCHEDULED,
      notes: "Evening after 5:30pm",
    },
  });

  writeDevEnvLocal(org.id, manager.id);

  console.log("\n--- Havyn seed complete ---");
  console.log(`DEV_ORGANIZATION_ID="${org.id}"`);
  console.log(`DEV_USER_ID="${manager.id}"`);
  console.log("(Also written to .env.local. Restart dev server after seed.)");
  console.log("\nGoogle sign-in: your Google account email must match a User.email in the DB (case-insensitive).");
  console.log("Seed users: admin@havyn.local, manager@havyn.local, dual@havyn.local — update emails in DB or re-seed with your address.");
  console.log("Multi-org test user: dual@havyn.local (Havyn Demo PM + Sunrise Residential).");
  console.log("Public microsite examples: /r/havyn-demo/foundry-101 , /r/havyn-demo/lakeside-studio-201 , /r/sunrise-demo/sunrise-a1\n");
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
