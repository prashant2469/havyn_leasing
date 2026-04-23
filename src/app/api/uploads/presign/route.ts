import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireOrgContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { generatePresignedUploadUrl } from "@/lib/s3";
import { Permission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";

function normalizeExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!/^[a-z0-9]+$/.test(ext)) return "jpg";
  return ext.slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgContext();
    await requirePermission(ctx, Permission.PHOTOS_UPLOAD);

    const body = (await request.json()) as {
      listingId?: string;
      filename?: string;
      contentType?: string;
    };
    const listingId = body.listingId?.trim();
    const filename = body.filename?.trim() ?? "";
    const contentType = body.contentType?.trim() || "application/octet-stream";

    if (!listingId) {
      return NextResponse.json({ error: "listingId is required" }, { status: 400 });
    }
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const ext = normalizeExtension(filename);
    const storageKey = `listings/${listing.id}/${randomUUID()}.${ext}`;
    const signed = await generatePresignedUploadUrl(storageKey, contentType);
    return NextResponse.json(signed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
