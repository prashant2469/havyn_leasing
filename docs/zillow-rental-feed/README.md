# Zillow Rental bulk feed (Havyn)

Operational notes and code for the [Zillow Rental Listing Bulk Feed Guide](https://s3.amazonaws.com/files.hotpads.com/+guides/Rental+Listing+Bulk+Feed+Guide.pdf) (`hotPadsItems` XML). Zillow **pulls** your file; they do not host it.

| Doc | Purpose |
|-----|---------|
| [Transport](./transport.md) | HTTPS vs SFTP/FTPS, static path, IP allowlists, what “exposed endpoint” means |
| [Approval & operations](./approval-and-operations.md) | `rentalfeeds@zillow.com`, testing handoff, 20% inventory rule |
| [Data inventory](./data-inventory.md) | How Havyn org/listing/photo data maps to the feed |
| [Test & production](./test-and-production.md) | Test vs prod cutover, what to give Zillow |

**Code:** `src/lib/zillow-rental-feed/*` (XML builder + gzip), `src/server/services/zillow/zillow-rental-feed.service.ts`, public GET ` /api/feeds/zillow-rental ` (when enabled in env).

**Quick check:** `npm run zillow-feed:verify` (no DB) exercises the builder and gzip.
