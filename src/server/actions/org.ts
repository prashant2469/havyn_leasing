"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { ACTIVE_ORG_COOKIE } from "@/server/auth/constants";
import { prisma } from "@/server/db/client";

export async function setActiveOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  if (!organizationId) return { ok: false as const, error: "Missing organization" };

  const session = await auth();
  const userId =
    session?.user?.id ??
    (session?.user?.email
      ? (
          await prisma.user.findFirst({
            where: { email: { equals: session.user.email, mode: "insensitive" } },
            select: { id: true },
          })
        )?.id
      : null);
  if (!userId) return { ok: false as const, error: "Not signed in" };

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });
  if (!membership) return { ok: false as const, error: "Not a member of that organization" };

  const jar = await cookies();
  jar.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
