import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** True when this client is missing V2/V3 models (stale generate). */
function clientMissingModels(client: PrismaClient): boolean {
  const c = client as unknown as {
    listing?: { findMany?: unknown };
    contactChannelIdentity?: { findMany?: unknown };
    conversationSummary?: { findMany?: unknown };
    leadPrioritySignal?: { findMany?: unknown };
  };
  return (
    typeof c.listing?.findMany !== "function" ||
    typeof c.contactChannelIdentity?.findMany !== "function" ||
    typeof c.conversationSummary?.findMany !== "function" ||
    typeof c.leadPrioritySignal?.findMany !== "function"
  );
}

function getPrisma(): PrismaClient {
  let client = globalForPrisma.prisma;

  if (client && clientMissingModels(client)) {
    void client.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
    client = undefined;
  }

  if (!client) {
    client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
  }

  if (clientMissingModels(client)) {
    throw new Error(
      "Prisma Client is out of date (missing V3 models). Run `npx prisma generate`, then restart `npm run dev`.",
    );
  }

  return client;
}

export const prisma = getPrisma();
