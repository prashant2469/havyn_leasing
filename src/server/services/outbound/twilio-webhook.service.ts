import { prisma } from "@/server/db/client";

function toStringRecord(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export async function validateTwilioFormSignature(
  request: Request,
  formData: FormData,
): Promise<boolean> {
  const signature = request.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!signature || !authToken) return false;

  const { validateRequest } = await import("twilio");
  return validateRequest(authToken, signature, request.url, toStringRecord(formData));
}

export async function resolveTwilioOrganizationId(): Promise<string | null> {
  const configuredId = process.env.TWILIO_ORGANIZATION_ID?.trim();
  if (configuredId) {
    const org = await prisma.organization.findUnique({
      where: { id: configuredId },
      select: { id: true },
    });
    return org?.id ?? null;
  }

  const firstOrg = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return firstOrg?.id ?? null;
}

export function twimlResponse(body = ""): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
