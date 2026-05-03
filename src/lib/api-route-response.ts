import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { DevAuthError } from "@/server/auth/context";

/** Prisma models may include `Decimal`, `Date`, or nested JSON that must round-trip through HTTP JSON. */
export function serializePrismaForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

function resolveRouteError(e: unknown): { status: number; body: { error: string } } {
  if (e instanceof DevAuthError) {
    return { status: 401, body: { error: e.message } };
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2022") {
      return {
        status: 503,
        body: {
          error:
            "The database schema is out of date for this app version. Apply pending Prisma migrations (for example `npx prisma migrate deploy`) and reload.",
        },
      };
    }
    if (e.code === "P2010" || e.code === "P1001" || e.code === "P1002") {
      return {
        status: 503,
        body: { error: "Unable to reach the database. Try again in a moment." },
      };
    }
  }

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    console.error("[api-route]", e);
    const message = e instanceof Error ? e.message : "Internal Server Error";
    return { status: 500, body: { error: message } };
  }

  console.error("[api-route]", e instanceof Error ? e.message : String(e));
  return { status: 500, body: { error: "Internal Server Error" } };
}

export function jsonApiError(e: unknown): NextResponse {
  const { status, body } = resolveRouteError(e);
  return NextResponse.json(body, { status });
}
