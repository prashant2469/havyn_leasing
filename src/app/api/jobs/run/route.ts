import { NextResponse } from "next/server";

import { processDueAutomationJobs } from "@/server/jobs/events";
import { checkSlidingWindow } from "@/server/security/rate-limit";

function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

export async function POST(request: Request) {
  const expectedToken = process.env.JOB_RUNNER_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json({ error: "JOB_RUNNER_TOKEN is not configured" }, { status: 503 });
  }

  const providedToken =
    request.headers.get("x-job-token") ??
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")?.slice("Bearer ".length)
      : null);

  if (!providedToken || providedToken.trim() !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rate = await checkSlidingWindow({
    namespace: "jobs-run-api",
    identifier: `${ip}:${providedToken.slice(0, 8)}`,
    limit: 10,
    window: "1 m",
  });

  if (!rate.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const result = await processDueAutomationJobs(50);
  return NextResponse.json(result);
}
