# Zillow approval and day-to-day operations

## Business approval (required)

- All **new** feeds need approval from the **Zillow Rentals** team before you rely on production publishing.
- Contact: **rentalfeeds@zillow.com** for questions and process.
- Public overview: [Rentals feed integrations (Zillow Group developers)](https://www.zillowgroup.com/developers/api/rentals/rentals-feed-integrations/).

**You must complete (outside this repo):**

- [ ] Intake / approval for a **rental listing feed** to the Zillow Rental Network.  
- [ ] Kickoff with **Rental Integrations** for **test** environment configuration.  
- [ ] Align on **timeline** (documentation often cites **4–6 weeks** for feed testing; confirm with Zillow).  
- [ ] **Production** promotion: after successful test, contact **Rental Feed Operations** at **rentalfeeds@zillow.com** to move the feed to production (per the guide).

## Testing handoff (do this, not that)

- When the feed is ready to test, **email rentalfeeds@zillow.com** and ask **Rental Integrations** to configure the feed in the **test** environment.
- **Do not email the feed file** as the primary delivery. For HTTPS, provide the **link**; for SFTP/FTPS, provide **path** (and credentials via a secure method).
- Test environment note from the guide: the **testing platform re-deploys every Monday morning** and **feed listing data is reset**; **feed and API configuration** are **retained**. If you need a re-run, contact **Rental Feed Operations** to have the test feed run again.

## The 20% inventory swing rule

- If listing count in the feed **rises or drops by more than ~20%** vs the prior run, the new file may be **held** until Zillow **confirms** the change is intentional (fraud/inventory protection).
- **Before** large one-time changes (onboarding, portfolio sale, etc.), **email Zillow in advance** so they expect the swing.
- If your inventory size is **stable and known**, you can ask about **min/max** listing bounds on their side (per the guide).

## Ongoing expectations

- Feed is a **snapshot** of what should be live: **omit** a listing to remove it on the next successful processing.
- **Only real data** in test and production (no placeholder copy).
- **For-sale and for-rent** at the same time: Zillow will not list as rent while sale conflicts exist (purchaser must resolve with listing agent per guide).
- **Partial feeds** (pricing/availability only, tied to **Zillow Rental Manager**): different product path — ask **rentalfeeds@zillow.com** if you need that; it is **not** the same as the full bulk XML in this integration.

## Email template (copy/paste)

**Subject:** Rental bulk feed — request test configuration

**Body (edit placeholders):**

> Hi Zillow Rental Integrations,  
>  
> We are ready to test our rental listing bulk feed for **[company / org name]**.  
>  
> - **Transport:** [HTTPS / SFTP / FTPS]  
> - **Feed location:** [URL or path on our server]  
> - **Our contact for technical questions:** [name, email, phone]  
> - **Note:** [e.g. new construction with lat/lon in feed; expected large inventory change on YYYY-MM-DD]  
>  
> Please configure this feed in the **test** environment and let us know the next steps.  
>  
> Thank you,  
> [Name]
