import type { ZillowRentalFeedPayload, ZillowFeedListing } from "./types";
import { escapeXml } from "./xml-escape";

function el(tag: string, content: string | number): string {
  return `<${tag}>${String(content)}</${tag}>`;
}

function optionalEl(tag: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return el(tag, value);
}

function cdataBlock(body: string): string {
  const safe = body.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

function listingToXml(companyId: string, l: ZillowFeedListing): string {
  const hide = l.streetHide === true ? "true" : "false";
  const photos = l.photos
    .map((p) => {
      const cap =
        p.caption != null && p.caption !== "" ? el("caption", escapeXml(p.caption)) : "";
      const label = p.label != null && p.label !== "" ? el("label", escapeXml(p.label)) : "";
      return `    <ListingPhoto source="${escapeXml(p.source)}">${label}${cap}
    </ListingPhoto>`;
    })
    .join("\n");

  const desc = `    <description>${cdataBlock(l.description)}</description>`;
  const virt =
    l.virtualTourUrl && l.virtualTourUrl !== ""
      ? `    ${el("virtualTourUrl", escapeXml(l.virtualTourUrl))}\n`
      : "";

  return `  <Listing id="${escapeXml(
    l.id
  )}" type="RENTAL" companyId="${escapeXml(companyId)}" propertyType="${l.propertyType}">
    ${el("name", escapeXml(l.name))}
    ${el("unit", escapeXml(l.unit))}
    <street hide="${hide}">${escapeXml(l.street)}</street>
    ${el("city", escapeXml(l.city))}
    ${el("state", escapeXml(l.state))}
    ${el("zip", escapeXml(l.zip))}
    ${el("country", escapeXml(l.country))}
    ${l.latitude ? el("latitude", l.latitude) : ""}
    ${l.longitude ? el("longitude", l.longitude) : ""}
    ${el("lastUpdated", l.lastUpdated)}
    ${el("contactName", escapeXml(l.contactName))}
    ${el("contactEmail", escapeXml(l.contactEmail))}
    ${el("contactPhone", escapeXml(l.contactPhone))}
    ${l.website ? el("website", escapeXml(l.website)) : ""}
${virt}${desc}
    <price>${escapeXml(l.price)}</price>
    ${el("pricingFrequency", l.pricingFrequency)}
    ${el("numBedrooms", l.numBedrooms)}
    ${el("numFullBaths", l.numFullBaths)}
    ${el("numHalfBaths", l.numHalfBaths)}
    ${optionalEl("squareFeet", l.squareFeet ?? undefined)}
    ${l.dateAvailable ? el("dateAvailable", l.dateAvailable) : ""}
    ${photos ? `\n${photos}\n` : ""}
  </Listing>`;
}

/**
 * Build `hotPadsItems` XML (UTF-8) per Zillow’s Rental Listing Bulk Feed Guide
 * (single-Company, single-Unit `Listing` nodes; multifamily/roommate not included here).
 */
export function buildZillowRentalFeedXml(payload: ZillowRentalFeedPayload): string {
  const c = payload.company;
  const companyLogo = c.logoUrl
    ? `  <CompanyLogo source="${escapeXml(c.logoUrl)}" />\n`
    : "";
  const website = c.websiteUrl ? el("website", escapeXml(c.websiteUrl)) : "<website/>";

  const companyBlock = `<Company id="${escapeXml(c.id)}">
  ${c.name ? el("name", escapeXml(c.name)) : "<name/>"}
  ${website}
  ${el("city", escapeXml(c.city))}
  ${el("state", escapeXml(c.state))}
${companyLogo}</Company>`;

  const listingBlocks = payload.listings
    .map((l) => listingToXml(c.id, l))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<hotPadsItems version="${payload.version}">
${companyBlock}
${listingBlocks}
</hotPadsItems>
`;
}
