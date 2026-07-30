# Travel Deal Discovery JS Agent

You are Codex acting as a senior TypeScript/Node.js engineer and product-minded systems designer. Build the actual JavaScript/npm implementation of the travel-deal discovery agent in `/Users/mantas/Git/uncwo/travel`.

This repo currently contains a Python prototype. Treat it as reference behavior, not as the final implementation. Build a clean TypeScript/Node.js project with npm commands, tests, and a one-command CLI runner.

## Product Goal

Create a reliable scheduled travel-deal discovery agent for short-stay accommodation deals in European capitals and second-order cities. It must search flexible 2-6 night stays with no fixed dates, prioritize properties under EUR 35/night, require strong value through EUR 50/night, and allow preliminary prices through EUR 80/night with an explicit score penalty.

The current productization phase must also deliver a usable local web control panel. Preserve the conversation-adjusted defaults: EUR 35 preferred, EUR 50 score-penalty threshold, EUR 80 preliminary-price hard cap, and blackout window covering as a visible manual-check warning rather than an automatic rejection. Keep CLI output focused on accepted deals.

Target cities include Warsaw, Krakow, Berlin, Cologne/Koln/Köln, Munich, Lisbon, and similar European capitals or second-order cities. Vilnius must be excluded by default.

The system must avoid brittle, legally risky scraping. Prefer official APIs, affiliate feeds, paid search APIs, or compliant integrations. Do not automate Booking.com or Airbnb with Playwright unless a future human explicitly confirms the workflow is compliant and robust.

## Hard Accommodation Requirements

Each accepted candidate must satisfy or explicitly flag uncertainty for:

- EUR 80/night preliminary-price hard cap by total nightly equivalent.
- Prefer EUR 35/night or lower.
- Stay length between 2 and 6 nights.
- Private accommodation by default; reject dorm beds, shared rooms, and misleading private-room-only listings unless config explicitly allows them.
- Individual adjustable air conditioning or climate control, preferably heating and cooling.
- Kitchen or kitchenette.
- Stovetop.
- Basic utensils included or strongly indicated.
- Blackout curtains, blackout shades, shutters, or equivalent as a visible manual-check requirement by default.
- Good rating, defaulting to 8.0+/10 or 4.5+/5.
- Enough reviews to be trustworthy, defaulting to at least 25 reviews.

Never hallucinate listing attributes. Separate `confirmed`, `inferred`, `ambiguous`, and `missing` evidence.

## Geographic Rules

Include central city areas and outer areas only when they are easily reachable by public transport.

Transit confidence must be an explicit field:

- `confirmed`: coordinates fall inside the configured central radius, or source text explicitly mentions accepted transit for that city.
- `inferred`: source text mentions station, rail, metro, tram, U-Bahn, S-Bahn, subway, commuter rail, or similar access.
- `ambiguous`: neighborhood is known, but no strong transit evidence is present.
- `missing`: no useful location/transit evidence.

City-specific accepted modes:

- Berlin: S-Bahn, U-Bahn, tram, regional rail.
- Lisbon: metro, commuter rail, reliable public transport.
- Warsaw: metro, SKM, KM, tram, reliable public transport.
- Cologne/Koln/Köln, Munich, Krakow, similar cities: S-Bahn, U-Bahn, tram, metro, commuter rail.

## Data Source Strategy

Implement a source-adapter architecture. Include:

1. A real Accor availability snapshot adapter populated from the official Accor connector.
2. A deterministic fixture adapter used only by tests and synthetic demos.
3. A live SerpAPI Google Hotels adapter enabled by `SERPAPI_API_KEY`.
4. Clear extension points for future Expedia Rapid, DataForSEO, Emerging Travel Group, Trip.com, Booking.com affiliate, or approved partner adapters.

The live adapter must fail gracefully when credentials are missing. It must mark weak amenity evidence conservatively, especially for individual climate control, stovetop, utensils, blackout curtains, and unclear fees.

## Required npm Experience

Create a JavaScript/TypeScript npm project with commands similar to:

```bash
npm install
npm run deals -- --config config.example.json --out reports
npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state
npm run test
npm run typecheck
npm run lint
npm run build
```

Use TypeScript. Prefer built-in Node APIs where practical. Keep dependencies conservative and justified.

## Required Outputs

The CLI must write:

- `reports/travel-deals.md`
- `reports/travel-deals.json`

For each deal candidate, include:

- City
- Neighborhood/area
- Source
- Listing name
- URL
- Dates tested
- Stay length
- Total price
- Nightly equivalent
- Rating and review count
- Amenity evidence:
  - adjustable climate control
  - kitchen/kitchenette
  - stovetop
  - utensils
  - blackout curtains/shades/shutters
- Transit accessibility evidence
- Confidence score
- Value score
- Why it is a good deal or why it was rejected
- What must be manually verified before booking

## Scoring Model

Implement transparent score components:

- Price score, strongly favoring under EUR 35/night.
- Rating score.
- Review-count confidence.
- Amenity match confidence.
- Public-transport accessibility.
- Stay-length availability.
- Cancellation/refund flexibility if available.
- Source reliability.
- Explicit penalty for missing, inferred, or ambiguous amenity data.
- Explicit penalty for suspiciously low prices, poor review count, and unclear fees.

Listings above the preferred EUR 35/night target but at or below EUR 50/night must meet a configurable minimum value score, default `70`. Listings above EUR 50/night through EUR 80/night receive an expanded-band score penalty and warning.

## Persistence

Store previously seen result keys in a JSON state file to avoid repeated alerts. Make the state path configurable. Support `--no-write-state` for deterministic demo/test runs.

## Documentation and Research

Preserve and improve:

- `docs/research-brief.md`: source/API comparison, legal/ToS risk, browser automation feasibility, data quality, rate limits, reliability, pricing, implementation difficulty, and architecture recommendation.
- `README.md`: how to run, schedule, add sources, interpret results, and troubleshoot.
- `documentation.md`: operator runbook for the long-horizon task.

## Completion Bar

The final JavaScript/npm implementation is done only when:

- npm scripts work from `/Users/mantas/Git/uncwo/travel`.
- The default run produces Markdown and JSON reports with at least two real sourced listings inside the next 180 days.
- Tests cover date windows, scoring, filtering, transit confidence, source normalization, reporting, and seen-state behavior.
- Documentation is accurate for the JS implementation.
- No command relies on Python for core runtime behavior.
- `npm start` launches a responsive local UI backed by the same checker used by the CLI.
- The UI exposes useful configuration, source activity, accepted/excluded views, evidence, and warnings.
- Cached results work by default; live Codex CLI web search is explicit.
- The verified project is published on `main` at `mistermantas/travel-scout`.

## Process Requirements

1. Re-read `prompt.md`, `plans.md`, `implement.md`, and `documentation.md` before starting.
2. Treat `plans.md` as the execution source of truth.
3. Do NOT start broad coding until `plans.md` exists and is coherent.
4. Work milestone by milestone.
5. After each milestone, run the milestone verification commands and update `plans.md` and `documentation.md`.
6. If reality differs from the plan, update the plan before or alongside the code change.

Start now. Plan first. Then build until the npm implementation is genuinely complete and verified.
