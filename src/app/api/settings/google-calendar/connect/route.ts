import { NextResponse } from "next/server";

import { requireOrgContext } from "@/server/auth/context";
import { buildGoogleOAuthUrl } from "@/server/services/google/google-calendar.service";

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext();
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/api/settings/google-calendar/callback`;
    const state = Buffer.from(
      JSON.stringify({ organizationId: ctx.organizationId, userId: ctx.userId }),
    ).toString("base64url");
    const authUrl = buildGoogleOAuthUrl(redirectUri, state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Missing env var")
        ? "missing_env"
        : "connect_failed";
    return NextResponse.redirect(new URL(`/settings?googleCalendar=${message}`, request.url));
  }
}
