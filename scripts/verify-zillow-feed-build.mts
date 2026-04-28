/**
 * Quick sanity check for the Zillow `hotPadsItems` builder (no database).
 * Run: npm run zillow-feed:verify
 */
import { buildZillowRentalFeedXml } from "../src/lib/zillow-rental-feed/build-feed-xml";
import { gzipUtf8String } from "../src/lib/zillow-rental-feed/gzip-feed";

const xml = buildZillowRentalFeedXml({
  version: "2.1",
  company: {
    id: "company_smoke",
    name: "Smoke Test PM",
    websiteUrl: "https://example.com",
    city: "Seattle",
    state: "WA",
  },
  listings: [
    {
      id: "listing_smoke1",
      type: "RENTAL",
      propertyType: "HOUSE",
      name: "Charming 2br",
      unit: "1",
      street: "123 Test St",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      country: "US",
      lastUpdated: new Date().toISOString(),
      contactName: "Leasing",
      contactEmail: "leasing@example.com",
      contactPhone: "2065550100",
      price: "2500",
      pricingFrequency: "MONTHLY",
      numBedrooms: 2,
      numFullBaths: 1,
      numHalfBaths: 0,
      dateAvailable: "2026-05-01",
      description: "Hello & <welcome> to UTF-8.",
      photos: [
        { source: "https://example.com/photos/a.jpg?v=1", caption: "Living room" },
      ],
    },
  ],
});

if (!xml.includes("hotPadsItems") || !xml.includes("listing_smoke1")) {
  throw new Error("Zillow feed smoke build did not include expected content.");
}
const gz = gzipUtf8String(xml);
if (gz.length === 0) {
  throw new Error("Gzip output empty.");
}
console.log("Zillow feed builder OK, xml bytes =", Buffer.byteLength(xml, "utf8"), "gzip bytes =", gz.length);
