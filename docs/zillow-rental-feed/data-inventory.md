# Data inventory: Havyn → Zillow `hotPadsItems` feed

## Stable identifiers (critical)

| Zillow concept | Havyn source | Rule |
|----------------|-------------|------|
| **`<Company id="...">`** | `Organization.id` | One company block per org per feed. Must stay **stable** across releases. |
| **`<Listing id="...">`** | `Listing.id` | **Must not change** while the listing is on-market. Havyn uses **cuid** (no `_` in the value; the guide notes `_` may be stripped in some fields). Do **not** reuse an id for a different address. |
| **Model / floorplan ids** (multifamily) | Not fully modeled in Havyn yet | If you add multifamily in the future, use **separate** stable ids per model in your domain; see the guide for **Model** naming rules. |

## Address and property

| Field | Havyn source | Notes |
|--------|-------------|--------|
| Street / city / state / zip / country | `Property` via `Unit` | Use **unit** in `<unit/>` as **unit number only** (guide: no extra address text in the unit tag). |
| **lat / long** | Not on `Property` by default | **New construction / BTR / multi-lot:** the guide often requires **exact lat/lon per lot** — add coordinates to your data model or `Listing.metadata` and **map them into the feed** before go-live. Contact **rentalfeeds@zillow.com** for edge cases. |
| `propertyType` | Default `HOUSE` in builder | Map from `Listing.metadata` (e.g. `zillowPropertyType`: `CONDO` \| `HOUSE` \| `TOWNHOUSE`) when you have reliable data. |
| `hide` on street | `Listing.metadata` e.g. `hideStreetAddress: boolean` | Optional; implement when you need off-map or hidden address. |

## Pricing and availability

| Field | Havyn source |
|--------|-------------|
| `price` / `pricingFrequency` | `Listing.monthlyRent` → `MONTHLY` |
| `dateAvailable` | `Listing.availableFrom` (ISO date) |
| `lastUpdated` | `Listing.updatedAt` (ISO) |
| **Off market** | Listings with status other than `ACTIVE` are **excluded** from the export (snapshot model). |

## Descriptions and marketing

| Field | Havyn source |
|--------|-------------|
| `description` | `Listing.title` + `Listing.description` (CDATA) |
| `virtualTourUrl` | `Listing.metadata.virtualTourUrl` (optional) |
| `website` | Prospect page: `{NEXT_PUBLIC_APP_URL}/r/{orgSlug}/{publicSlug}` when `publicSlug` is set |

## Media (photos)

- Zillow fetches **each photo URL** you put in the XML. **Must be HTTPS** in practice.
- **Each URL should be unique per image version.** If you replace a photo in place, **change the URL** (e.g. versioned key or `?v=timestamp`) or Zillow may keep the old image.
- Havyn stores `ListingPhoto.url` (and `storageKey`). After upload, ensure the app persists a **stable public URL**; when the file bytes change, **update the URL** in the DB.
- **Sizes / format:** follow the guide (min dimensions, `.jpg` / `.png` / `.webp`, max size).
- **Threaded downloads** can hit WAF — **allowlist Zillow** egress/proxy IPs on the image host (see [transport](./transport.md)).

## Contact on listings

- Zillow expects contact fields on each listing. Havyn’s `Organization` does not include phone/email by default.
- The feed service uses **environment variables** for org-level contact (see `.env.example`). Replace with DB fields if you add them later.

## What to collect before implementation sign-off

- [ ] **Default `propertyType` rule** or metadata mapping.  
- [ ] **Contact** for syndicated listings (email/phone/name).  
- [ ] **New construction** list: do you need **lat/lon** in feed for any property? If yes, where will it live?  
- [ ] **Photo URL** versioning policy (S3/CloudFront: key per version vs query param).  
- [ ] **Which listings** to include: this export uses `Listing.status === ACTIVE` for the selected org; adjust if you need `PUBLISHED` on `WEBSITE` channel only.  
