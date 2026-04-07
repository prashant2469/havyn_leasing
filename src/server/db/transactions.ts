import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";

export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}
