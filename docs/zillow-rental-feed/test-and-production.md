# Test and production (Zillow)

Use this with [approval-and-operations](./approval-and-operations.md) and [transport](./transport.md).

## What you hand to Zillow

**Do not** email the raw feed file. Provide:

- **Transport:** `HTTPS` (this app) or your SFTP/FTPS process  
- For **HTTPS:** a **stable, production** URL, e.g.  
  `https://<your-domain>/api/feeds/zillow-rental`  
  If you set `ZILLOW_RENTAL_FEED_TOKEN`, share the **pre-shared token** (via Password Pusher or your security team’s channel), not in a public doc.
- For **SFTP/FTPS:** host, path to the file, and credentials/keys (secure handoff)  
- **When** you run your update job, and the **20% swing** plan if the portfolio will change sharply.

## Local / staging verification (no Zillow)

1. `npm run zillow-feed:verify` — runs the [verify script](/scripts/verify-zillow-feed-build.mts) against a **smoke** payload (validates builder + gzip).
2. Enable the real route with env in `.env.local` (see `.env.example`):
   - `ZILLOW_RENTAL_FEED_ENABLED=true`
   - `ZILLOW_RENTAL_FEED_ORG_ID=<org cuid from DB>`
   - `ZILLOW_RENTAL_FEED_CONTACT_*` and (if needed) company city/state
3. `GET` `http://localhost:3000/api/feeds/zillow-rental?token=...` and review the XML in the browser (with DB seeded and **ACTIVE** listings).

## Zillow test environment

- After approval, **email rentalfeeds@zillow.com** to configure your feed in the **test** environment (per the [guide](https://s3.amazonaws.com/files.hotpads.com/+guides/Rental+Listing+Bulk+Feed+Guide.pdf)).
- Give them the **test** URL (or test SFTP path) if it differs from production.
- **Monday re-deploys** in test may reset **listing** data; **feed configuration** is retained. Ask **Rental Feed Operations** to re-run the test if you need a republish.

## Move to production

- When the test publish looks correct end-to-end, request **production** with **Rental Feed Operations** via **rentalfeeds@zillow.com**.
- **Switch the URL** they follow to the **production** `https` origin (or prod SFTP path) **without** changing the static path you agreed on, unless you coordinate a migration with them.
- Re-confirm **IP allowlists** and **WAF** rules for Zillow and for **photo** hosts.

## Ongoing

- If listing count can jump or drop by **more than ~20%**, notify Zillow first (see approval doc).
- If photos change in place, **bump the image URL** so Zillow picks up the new asset.
- If you add **new construction** addresses, work with `rentalfeeds@` as early as possible and keep **lat/lon** in the feed for those sites.
