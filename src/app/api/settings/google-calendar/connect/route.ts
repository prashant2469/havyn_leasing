import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/api-route-response";
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
    if (error instanceof Error && error.message.includes("Missing env var")) {
      return NextResponse.redirect(new URL("/settings?googleCalendar=missing_env", request.url));
    }
    if (error instanceof Error) {
      console.warn("[google-calendar-connect]", error.message);
      return NextResponse.redirect(new URL("/settings?googleCalendar=connect_failed", request.url));
    }
    return jsonApiError(error);
  }
}
