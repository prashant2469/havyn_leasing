import { NextResponse } from "next/server";

import { requireOrgContext } from "@/server/auth/context";
import {
  exchangeGoogleAuthCode,
  upsertGoogleCalendarConnection,
} from "@/server/services/google/google-calendar.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?googleCalendar=error", request.url));
  }

  try {
    const ctx = await requireOrgContext();
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      organizationId: string;
      userId: string;
    };
    if (parsed.organizationId !== ctx.organizationId || parsed.userId !== ctx.userId) {
      return NextResponse.redirect(new URL("/settings?googleCalendar=invalid_state", request.url));
    }

    const redirectUri = `${url.origin}/api/settings/google-calendar/callback`;
    const token = await exchangeGoogleAuthCode(code, redirectUri);
    if (!token.refresh_token) {
      throw new Error("Missing Google refresh token");
    }
    await upsertGoogleCalendarConnection({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: token.expires_in,
      scope: token.scope,
      calendarId: "primary",
    });
    return NextResponse.redirect(new URL("/settings?googleCalendar=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?googleCalendar=error", request.url));
  }
}
