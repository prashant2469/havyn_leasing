# Transport: HTTPS vs SFTP/FTPS

## What Zillow needs

Per the feed guide:

- **Transports:** HTTP, HTTPS, FTPS, SFTP (plain FTP is not accepted).
- **Zillow does not host your file.** They run a per-feed **download** on a schedule.
- The feed file must use a **static, unchanging path and filename** (no date tokens in the path or name). `.zip` or `.gz` compression is allowed for large files.
- For **HTTP/HTTPS**, you provide a **link to the feed** (a stable URL Zillow can fetch).
- For **SFTP/FTPS**, you provide the **path to the file** on your server, plus **credentials/keys** shared through a **secure** channel (the guide references tools like [Password Pusher](https://pwpush.com/)).
- For **IP filtering:** Zillow can provide **proxy IPs** to allow on your firewall/WAF. The same concern applies to **photo URLs** (their downloader is threaded and can trip DDoS rules without allowlisting).

## “Exposed endpoint” (plain language)

When Zillow asks for an **exposed endpoint**, they usually mean one of:

1. **Public HTTPS URL** to a **fixed** path that returns the feed XML (or a compressed file), or  
2. A **network-reachable** SFTP/FTPS **host and path** (not “upload to Zillow’s SFTP”).

Secrets belong in your config or a secure handoff, **not** in the feed file or a public doc.

## Recommendation for this app (Havyn / Next.js)

| Option | When to use |
|--------|-------------|
| **HTTPS (same app)** | Simplest: enable the built-in feed route and give Zillow a stable production URL. Put the **same URL** in every environment you want them to read (test URL for test, prod for prod). Pair with WAF + **Zillow egress IP allowlist** and optional **shared secret** (query or header) so the feed is not world-scrapable. |
| **SFTP/FTPS** | Your security team requires no public feed URL, or you already have a file drop that an **ETL job** writes to. You (or a cron) generate `feed.xml` (or `.gz`) and place it on your server; Zillow pulls from that path. You still need **public HTTPS** for **listing photos** unless you use a signed CDN with long-lived rules Zillow can follow (confirm with your CDN and Zillow). |

## Checklist (fill in before go-live)

- [ ] **Transport chosen:** HTTPS / SFTP / FTPS  
- [ ] **Exact production URL** (HTTPS) *or* **host, port, path, user, key/password** (SFTP/FTPS) — hand off secrets via secure channel.  
- [ ] **Static path** confirmed (no changing filename).  
- [ ] **TLS / host key** and **firewall** rules for Zillow (and for photo servers).  
- [ ] **Feed fetch schedule** vs your update job (guide suggests Zillow fetch **20–30 minutes** after you publish the file so data is current).  
- [ ] **Photo base URL** strategy: unique URL per image version (see [data-inventory](./data-inventory.md)).

**Decision for Havyn (default):** use **HTTPS** to `GET /api/feeds/zillow-rental` in production, protect with env flag + optional token, and allowlist Zillow’s IPs on the edge when they provide them.
