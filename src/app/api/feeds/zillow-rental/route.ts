import { getZillowRentalFeedXmlForOrganization } from "@/server/services/zillow/zillow-rental-feed.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenOk(req: Request, url: URL): boolean {
  const expected = process.env.ZILLOW_RENTAL_FEED_TOKEN?.trim();
  if (!expected) return true;
  const q = url.searchParams.get("token");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  return q === expected || bearer === expected;
}

/**
 * Public Zillow rental bulk feed (XML). Zillow fetches this URL on a schedule.
 * Set `ZILLOW_RENTAL_FEED_ENABLED=true` and `ZILLOW_RENTAL_FEED_ORG_ID` (and contact env) to enable.
 */
export async function GET(req: Request) {
  if (process.env.ZILLOW_RENTAL_FEED_ENABLED !== "true") {
    return new Response("Not found", { status: 404 });
  }
  const orgId = process.env.ZILLOW_RENTAL_FEED_ORG_ID?.trim();
  if (!orgId) {
    return new Response("Zillow feed is not configured (ZILLOW_RENTAL_FEED_ORG_ID).", { status: 503 });
  }
  const url = new URL(req.url);
  if (!tokenOk(req, url)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const xml = await getZillowRentalFeedXmlForOrganization(orgId);
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error building Zillow feed";
    return new Response(msg, { status: 500 });
  }
}
