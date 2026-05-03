import { MembershipRole } from "@prisma/client";

import { prisma } from "../src/server/db/client";

type CliArgs = {
  email: string;
  role: MembershipRole;
  organizationId: string | null;
  createIfMissing: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1]?.startsWith("--") ? "" : (argv[i + 1] ?? "");
    args.set(key, value);
  }

  const email = (args.get("email") ?? "").trim().toLowerCase();
  const roleRaw = (args.get("role") ?? MembershipRole.OWNER).trim().toUpperCase();
  const organizationId = (args.get("organizationId") ?? "").trim() || null;
  const createIfMissing = (args.get("createIfMissing") ?? "false").trim().toLowerCase() === "true";

  if (!email) {
    throw new Error("Missing required --email argument.");
  }

  if (!(roleRaw in MembershipRole)) {
    throw new Error(`Invalid --role value "${roleRaw}".`);
  }

  return { email, role: roleRaw as MembershipRole, organizationId, createIfMissing };
}

async function main() {
  const { email, role, organizationId, createIfMissing } = parseArgs(process.argv.slice(2));
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user && createIfMissing) {
    user = await prisma.user.create({
      data: { email, name: email.split("@")[0] ?? email },
      select: { id: true, email: true },
    });
  }
  if (!user) {
    throw new Error(`No user found for email "${email}".`);
  }

  const org =
    (organizationId
      ? await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true },
        })
      : await prisma.organization.findFirst({
          where: { memberships: { some: { userId: user.id } } },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        })) ??
    (await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }));

  if (!org) {
    throw new Error("No organization found. Create an organization first.");
  }

  const membership = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    create: { userId: user.id, organizationId: org.id, role },
    update: { role },
    select: { id: true, role: true },
  });

  console.log(
    [
      "Bootstrap complete.",
      `email=${user.email}`,
      `organization=${org.name} (${org.id})`,
      `membershipId=${membership.id}`,
      `role=${membership.role}`,
    ].join(" "),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
