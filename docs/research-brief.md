# Research Brief: Accommodation Deal Discovery Agent

Date: 2026-07-04

## Recommendation

Build the agent around provider adapters, not browser scraping. The first production-grade path should use a paid, contractual hotel/search data API for discovery, then send high-scoring candidates to a manual verification checklist before booking. Travel Scout now uses captured Booking/Accor/public-property evidence, a cached-or-live Codex CLI web-search adapter, a SerpAPI Google Hotels adapter when `SERPAPI_API_KEY` is present, and a fixture adapter for repeatable development.

The preferred architecture is:

1. Scheduled runner: GitHub Actions cron for a repo-hosted setup, or a small hosted worker/serverless cron if secrets and uptime need stronger control.
2. Search adapters: start with SerpAPI Google Hotels or DataForSEO Google Hotels for discovery; evaluate Expedia Rapid, Emerging Travel Group, or Trip.com Connect if partner approval is available.
3. Normalization layer: convert each provider into the same listing model and separate confirmed, inferred, ambiguous, and missing evidence.
4. Scoring and filtering layer: reject hard misses, rank the remaining candidates, and preserve uncertainty.
5. State store: keep stable listing/date keys to avoid repeated alerts.
6. Product surface: use the local UI for settings, source diagnostics, comparisons, and evidence review; keep the CLI for scheduled runs.
7. Human step: inspect the source page before booking; never book or message hosts automatically.

## Source Findings

### Booking.com

Booking.com has an affiliate program with broad accommodation coverage and official partner tooling. Its Connectivity APIs are for Connectivity Partners managing listed properties, including rates, availability, reservations, prices, facilities, and related supply workflows. Booking documents explicit partner expectations and rate limits, and the API docs state the information is subject to the contractual agreement with Booking.com.

Pricing and difficulty: affiliate sign-up is low implementation effort but mainly supports links/widgets rather than reliable amenity-level discovery. Connectivity API access is high difficulty because it is partner/contractual supply-side infrastructure, not a casual demand-search endpoint.

Browser automation / scraping: high anti-bot and policy risk. Booking pages may expose useful data, and Apify has Booking.com actors with published prices such as $0.25-2.50 per 1,000 results for one actor and from $0.70 per 1,000 properties for another, but these are scraper products rather than Booking.com-approved demand APIs. Treat them as fallback research tools only after legal review, not as the recommended system of record.

Conclusion: do not scrape Booking.com directly. Use affiliate/deep-link tooling for outbound traffic, or pursue approved partner/API access if the project becomes commercial enough to justify onboarding. Booking.com should not be the first prototype live source unless approved API access is available.

Sources:
- [Booking.com Connectivity APIs](https://developers.booking.com/connectivity/docs)
- [Booking.com Affiliate Program](https://www.booking.com/affiliate-program/v2/index.html)
- [Apify Simple Booking Scraper](https://apify.com/dtrungtin/simple-booking-scraper)
- [Apify Booking.com Scraper API](https://apify.com/pro100chok/booking-all-in-one-scraper/api/python)

### Airbnb

Airbnb publishes API Terms for organizations with API access and explicitly restricts permitted use. The terms also state that undocumented APIs may not be used. Public, general-purpose accommodation search access is not a dependable assumption for this use case.

Pricing and difficulty: access is partner-gated; without an approved program, the practical cost is not just API spend but business approval. Data quality would likely be high for approved access, but unsuitable for a personal prototype.

Browser automation / scraping: high policy and anti-bot risk. Do not use undocumented endpoints or captcha workarounds.

Conclusion: do not build an Airbnb scraper or undocumented API client. Treat Airbnb as manual verification only unless approved partner access is granted.

Source:
- [Airbnb API Terms of Service](https://www.airbnb.com/help/article/3418)

### Expedia Rapid

Expedia Rapid is positioned as a developer product for custom end-to-end travel booking experiences, including a Rapid Lodging API, interactive tools, and SDKs.

Pricing and difficulty: likely partner-contract pricing and moderate-to-high implementation difficulty. Data quality and booking-path reliability should be strong after approval, but onboarding is heavier than a search API.

Conclusion: strong production candidate if the project can obtain partner approval. It is more suitable for a commercial integration than a casual personal scraper.

Source:
- [Expedia Group Rapid API Developer Hub](https://developers.expediagroup.com/docs/rapid)

### SerpAPI Google Hotels

SerpAPI exposes Google Hotels results through `engine=google_hotels` and returns structured hotel/vacation-rental search data. This is a lower-effort discovery layer than browser automation, but it is still a search-result data provider rather than a direct supplier contract. Amenity depth can be thin, especially for stovetops, utensils, and blackout curtains.

Pricing and difficulty: low implementation difficulty. SerpAPI lists Google Hotels among supported APIs and publishes month-to-month pricing, including a free tier, $25/month for 1,000 searches, $75/month for 5,000 searches, $150/month for 15,000 searches, and higher plans. Each successful search counts as a credit, so broad city/date sweeps need batching and caps.

Conclusion: best first live adapter for prototype discovery. Use it to find candidates, then require manual verification for hard amenities.

Source:
- [SerpAPI Google Hotels API](https://serpapi.com/google-hotels-api)
- [SerpAPI Pricing](https://serpapi.com/pricing)

### DataForSEO Google Hotels

DataForSEO provides Google Hotel Searches API tasks with JSON POST payloads and documented throughput of up to 2000 API calls per minute. Its queue/live modes make it more batch-friendly than browser automation.

Pricing and difficulty: moderate implementation difficulty because it uses task payloads and queue/live modes. Current Google Hotels pricing is per hotel entity/SERP: $0.0008 standard queue, $0.0016 priority queue, and $0.004 live mode, according to the pricing page. This is better suited to systematic batch discovery than interactive browsing.

Conclusion: strong alternative to SerpAPI if cost, account access, or batch workflow fits better.

Source:
- [DataForSEO Google Hotel Searches API](https://docs.dataforseo.com/v3/business_data-google-hotel_searches-live/)
- [DataForSEO Google Hotels Pricing](https://dataforseo.com/pricing/business-data/google-hotels-api)

### Emerging Travel Group Affiliate API

Emerging Travel Group documents an Affiliate API with static content, hotel search, booking, post-booking, contracts, and documents endpoints.

Pricing and difficulty: likely partner-contract pricing and moderate implementation difficulty. Worth evaluating if the API exposes apartment-style amenities deeply enough for kitchenette, stovetop, utensils, and blackout filtering.

Conclusion: worth evaluating for production if affiliate approval is straightforward and European apartment-style inventory is good enough.

Source:
- [Emerging Travel Group Affiliate API](https://docs.emergingtravel.com/docs/affiliate-api/)

### Trip.com / Trip.com Connect

Trip.com has both an affiliate program and a Connect/API presence. The affiliate program advertises broad inventory, including 1.7 million accommodation options, while Trip.com Connect describes hotel API capabilities under custom contract specifications.

Pricing and difficulty: affiliate links are lower effort but may not provide reliable amenity-level discovery. Connect/API access likely requires contract approval and is moderate-to-high implementation difficulty. It is defensible as a future production source if approved access can return structured hotel details, availability, fees, and amenity metadata.

Conclusion: evaluate after SerpAPI/DataForSEO if Trip.com inventory is attractive for the target cities and partner access is realistic.

Sources:
- [Trip.com Affiliate Program](https://www.trip.com/partners)
- [Trip.com Connect](https://connect.trip.com/)

### OpenAI / Hermes-Style Agent Workflow

OpenAI's Agents SDK is useful when the application owns orchestration, tool execution, approvals, and state. For this use case, the scheduled runner should remain deterministic code; an LLM/agent step can summarize reports, deduplicate semantically similar candidates, or draft manual review notes. It should not browse booking sites, bypass anti-bot controls, book, or message hosts.

Conclusion: optional second layer, not the scheduler or source of truth.

Source:
- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents)

## Option Comparison

| Option | Reliability | Compliance posture | Cost | Fit |
| --- | --- | --- | --- | --- |
| GitHub Actions cron + API adapters | High | Good if provider terms are followed | Low runner cost, paid API calls | Best default |
| Local cron | Medium | Same as adapters | Low | Good for personal use, weaker uptime |
| Hosted worker/serverless cron | High | Same as adapters | Low to medium | Best when secrets and uptime matter |
| Codex-generated scheduled script | Medium | Depends on source adapters | Low | Good for iteration, not ideal as unattended production |
| Playwright browser automation | Low to medium | Risky for OTAs unless explicitly allowed | Low direct cost, high maintenance | Avoid for Booking.com/Airbnb |
| OpenAI/Hermes-style agent workflow | Medium | Safe only when used for analysis, not scraping | API cost | Useful as a reviewer/summarizer |
| Expedia/ETG direct affiliate APIs | High | Best after approval | Partner/API cost | Best production path |
| SerpAPI/DataForSEO Google Hotels | Medium to high | Lower operational risk than self-scraping | Paid per search/result | Best prototype path |
| Apify Booking.com actors | Medium operationally, uncertain legally | Requires legal/ToS review | Published per-result/compute-unit pricing | Fallback research only |

## Transit Accessibility Confidence

The prototype assigns transit confidence conservatively:

- Confirmed: coordinates fall inside the configured central radius, or source text explicitly mentions an accepted mode for the city.
- Inferred: location text mentions stations, rail, metro, tram, or similar access without enough detail.
- Ambiguous: area/neighborhood is present, but there is no hard transit evidence.
- Missing: no useful location or transit data.

For production, this should be upgraded with a transit API or OpenStreetMap/GTFS lookup that checks walking distance to accepted stops and estimated commute time to central areas.

## Rating Threshold

The default threshold is 8.0/10 or 4.5/5. The threshold is intentionally strict because the price target is unusually low for European capitals, which raises the risk of hidden tradeoffs. Review count is a confidence input, not always a hard rejection: a low-review property can survive only if the hard requirements are well evidenced and the manual checklist remains explicit.

Listings above EUR 35/night but at or below the configured penalty threshold, currently EUR 50/night, must also meet the configured `min_value_score_for_over_preferred_price` threshold. Listings between the penalty threshold and the hard maximum, currently EUR 80/night, are allowed for discovery but receive an explicit score penalty and console warning so they appear below stronger cheaper options.

## Prototype Scope

Implemented now:

- Configurable cities, excluded cities, price bands, stay lengths, date horizon, rating/review thresholds, required amenities, transit confidence, and sources.
- Configurable warning-only amenities, with blackout covering warning-only by default.
- Flexible windows for the configured horizon, defaulting to the next 180 days.
- Fixture source for deterministic runs.
- SerpAPI Google Hotels adapter for live search when configured.
- Codex CLI web-search adapter with cached default behavior and explicit live refresh across public provider/property pages.
- Booking.com connector snapshot adapter using captured search/property-QA evidence rather than scraping.
- Public apartment-candidate snapshot adapter for Hotels.com/Expedia-style evidence.
- Accor connector snapshot adapter that demonstrates hotel-style candidates being rejected when kitchen requirements are not met.
- Normalization model with confirmed/inferred/ambiguous/missing evidence.
- Transparent value and confidence scoring.
- Explicit amenity uncertainty, unclear-fee, suspicious-price, and thin-review penalties.
- Markdown and JSON reports.
- State file for repeated-alert suppression.
- Shared checker service with per-source failure isolation and source diagnostics.
- Responsive local web UI with editable settings, accepted/all/excluded views, sorting, filtering, evidence expansion, and explicit live-search action.
- Runtime config validation and ignored local config persistence.
- Unit tests for date generation, scoring, filtering, config, source normalization/failure isolation, report generation, seen-state behavior, transit confidence, strict rejection cases, and HTTP API behavior.
- Deterministic default report with 13 ranked source offers and 8 accepted offers, while preserving excluded near-misses with explicit reasons.

Not implemented yet:

- Approved Booking.com, Airbnb, Expedia Rapid, or ETG credentials.
- Real transit-time lookup.
- Email/Slack alert delivery.
- Booking or host messaging, by design.
