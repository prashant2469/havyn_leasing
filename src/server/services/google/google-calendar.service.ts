import { addMinutes } from "date-fns";

import { prisma } from "@/server/db/client";
import type { BusyRange } from "@/server/services/tours/slot-generator.service";

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_FREEBUSY_API = "https://www.googleapis.com/calendar/v3/freeBusy";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function buildGoogleOAuthUrl(redirectUri: string, state: string): string {
  const clientId = requiredEnv("GOOGLE_CALENDAR_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar",
    state,
  });
  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(code: string, redirectUri: string) {
  const clientId = requiredEnv("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}

async function refreshToken(refreshToken: string) {
  const clientId = requiredEnv("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
}

export async function upsertGoogleCalendarConnection(input: {
  organizationId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scope?: string;
  calendarId?: string;
}) {
  const tokenExpiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
  return prisma.googleCalendarConnection.upsert({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
    create: {
      organizationId: input.organizationId,
      userId: input.userId,
      calendarId: input.calendarId ?? "primary",
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt,
      scope: input.scope ?? null,
    },
    update: {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt,
      scope: input.scope ?? null,
      ...(input.calendarId ? { calendarId: input.calendarId } : {}),
    },
  });
}

async function getFreshAccessToken(organizationId: string, userId: string): Promise<string> {
  const conn = await prisma.googleCalendarConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!conn) throw new Error("Google Calendar not connected");
  if (conn.tokenExpiresAt.getTime() > Date.now() + 30_000) return conn.accessToken;
  const refreshed = await refreshToken(conn.refreshToken);
  await prisma.googleCalendarConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: refreshed.access_token,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scope: refreshed.scope ?? conn.scope,
    },
  });
  return refreshed.access_token;
}

export async function listGoogleCalendars(organizationId: string, userId: string) {
  const token = await getFreshAccessToken(organizationId, userId);
  const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google calendarList failed (${res.status}) ${body}`.trim());
  }
  const data = (await res.json()) as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>;
  };
  return data.items ?? [];
}

export async function updateGoogleSelectedCalendar(
  organizationId: string,
  userId: string,
  calendarId: string,
) {
  return prisma.googleCalendarConnection.update({
    where: { organizationId_userId: { organizationId, userId } },
    data: { calendarId },
  });
}

export async function getGoogleFreeBusyRanges(
  organizationId: string,
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyRange[]> {
  const conn = await prisma.googleCalendarConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!conn) return [];
  const token = await getFreshAccessToken(organizationId, userId);
  const res = await fetch(GOOGLE_FREEBUSY_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: conn.calendarId }],
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };
  const busy = data.calendars?.[conn.calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function getGoogleFreeBusyRangesForOrganization(
  organizationId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyRange[]> {
  const conn = await prisma.googleCalendarConnection.findFirst({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });
  if (!conn) return [];
  return getGoogleFreeBusyRanges(organizationId, conn.userId, timeMin, timeMax);
}

export async function upsertGoogleTourEvent(input: {
  organizationId: string;
  userId: string;
  tourId: string;
  googleEventId?: string | null;
  startAt: Date;
  durationMinutes: number;
  summary: string;
  description: string;
}) {
  const conn = await prisma.googleCalendarConnection.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
  });
  if (!conn) return null;
  const token = await getFreshAccessToken(input.organizationId, input.userId);
  const endAt = addMinutes(input.startAt, input.durationMinutes);
  const payload = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startAt.toISOString() },
    end: { dateTime: endAt.toISOString() },
  };

  const method = input.googleEventId ? "PATCH" : "POST";
  const url = input.googleEventId
    ? `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(input.googleEventId)}`
    : `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(conn.calendarId)}/events`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  if (!data.id) return null;
  await prisma.tour.update({
    where: { id: input.tourId },
    data: { googleEventId: data.id },
  });
  return data.id;
}

export async function upsertGoogleTourEventForOrganization(input: {
  organizationId: string;
  tourId: string;
  googleEventId?: string | null;
  startAt: Date;
  durationMinutes: number;
  summary: string;
  description: string;
}) {
  const conn = await prisma.googleCalendarConnection.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });
  if (!conn) return null;
  return upsertGoogleTourEvent({ ...input, userId: conn.userId });
}

export async function deleteGoogleTourEvent(input: {
  organizationId: string;
  userId: string;
  googleEventId: string;
}) {
  const conn = await prisma.googleCalendarConnection.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
  });
  if (!conn) return;
  const token = await getFreshAccessToken(input.organizationId, input.userId);
  await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(input.googleEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function deleteGoogleTourEventForOrganization(input: {
  organizationId: string;
  googleEventId: string;
}) {
  const conn = await prisma.googleCalendarConnection.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });
  if (!conn) return;
  return deleteGoogleTourEvent({
    organizationId: input.organizationId,
    userId: conn.userId,
    googleEventId: input.googleEventId,
  });
}
