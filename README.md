# Travel Scout

Travel Scout finds evidence-backed accommodation deals for flexible 2-6 night stays in European cities. It has a local web UI for comparing offers and editing settings, plus a CLI that prints accepted deals and writes complete Markdown/JSON reports.

It does not book, message hosts, bypass anti-bot controls, or pretend missing amenities are confirmed.

## Start the UI

Requirements: Node.js 20+ and npm.

```bash
npm install
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

The first screen uses cached source data, so it works without API keys. From the UI you can:

- Compare accepted offers by value, price, rating, or confidence.
- Open the intentional Excluded view for rejection reasons.
- Inspect amenity and transit evidence before opening a provider page.
- Select cities, stays, date horizon, price bands, quality thresholds, amenities, and sources.
- Save personal settings to ignored `config.local.json`.
- Run a fast cached check or explicitly start the slower Codex CLI web search.

Use another port with:

```bash
npm start -- --port 4300
```

## Run the CLI

```bash
npm run deals -- --config config.example.json --out reports
```

Repeatable snapshot run:

```bash
npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state
```

The console prints accepted deals only. The full candidate set, including exclusions and reasons, is written to:

- `reports/travel-deals.md`
- `reports/travel-deals.json`

The deterministic command currently ranks 13 candidates and accepts 8. Those include offers from Booking snapshot evidence and cached Hotels.com web-search evidence. A provider-specific duplicate may appear when the same property has separate prices or evidence from different sources; source offers are intentionally preserved rather than silently merged.

## Preferred Defaults

The checked-in defaults preserve the choices made during development:

| Setting | Default |
| --- | --- |
| Preferred nightly price | EUR 35 |
| Score-penalty threshold | EUR 50 |
| Preliminary hard maximum | EUR 80 |
| Stay lengths | 2, 3, 4, 5, 6 nights |
| Date horizon | 0-6 months, sampled every 21 days |
| Rating | 8.0/10 or 4.5/5 |
| Review confidence threshold | 25 |
| Transit confidence | 0.55 |
| Shared rooms | Off |
| Blackout covering | Warning/manual check |
| Climate, kitchen, stovetop, utensils | Direct evidence required |

EUR 35-50 offers must clear the configured value-score floor. EUR 50-80 offers remain visible with a score penalty and yellow warning, so they rank below stronger cheaper options.

Taxes, cleaning fees, service fees, and city taxes can be unclear during discovery. That does not reject a candidate; it lowers the score and creates a checkout-total warning. The displayed price is preliminary until manually verified.

## Sources

Default sources:

- `booking_snapshot`: captured Booking connector search and property-QA evidence.
- `websearch_cli`: cached public web-search results by default; optional live Codex CLI refresh.
- `apartment_candidate_snapshot`: captured Hotels.com/Expedia-style public evidence.
- `accor_snapshot`: captured official Accor availability.

Optional sources:

- `serpapi_google_hotels`: live Google Hotels discovery with `SERPAPI_API_KEY`.
- `fixture`: synthetic data for tests and demos only.

Each adapter runs independently. If one source fails, Travel Scout keeps results from the others and exposes the source error in the UI or console.

### Refresh With Codex Web Search

In the UI, enable `Codex web search` under Sources and press **Search web**.

CLI equivalent:

```bash
ENABLE_CODEX_WEBSEARCH=1 npm run deals -- \
  --config config.example.json \
  --out reports \
  --no-write-state
```

The adapter runs `codex --search exec` once per selected city, validates structured output, updates `data/websearch_cli_results.json`, then sends every candidate through the normal filters. It searches public Booking, Hotels.com/Expedia, official property pages, and other defensible sources. It can take several minutes.

Useful controls:

```bash
WEBSEARCH_CITY_LIMIT=1
WEBSEARCH_WINDOWS_PER_CITY=8
WEBSEARCH_CLI_TIMEOUT_MS=300000
WEBSEARCH_CACHE_PATH=/tmp/travel-scout-websearch.json
CODEX_CLI_PATH=/opt/homebrew/bin/codex
WEBSEARCH_CODEX_REASONING_EFFORT=low
```

### SerpAPI

```bash
export SERPAPI_API_KEY="..."
```

Then enable `serpapi_google_hotels` in the UI or `sources_enabled`. Google Hotels often lacks proof for individual climate control, stovetop, utensils, and blackout covering, so normalization remains conservative.

## Configuration

Edit `config.example.json` for versioned defaults or use the UI and save a local config. Important fields:

- `cities`, `excluded_cities`
- `preferred_nightly_price_eur`, `price_penalty_threshold_eur`, `max_nightly_price_eur`
- `stay_lengths`, `date_horizon`
- `minimum_rating`, `minimum_review_count`
- `required_amenities`, `manual_check_amenities`
- `acceptable_transit`
- `sources_enabled`
- `allow_shared_rooms`
- `min_value_score_for_over_preferred_price`
- `report_top_n`, `state_path`

Server-side validation rejects contradictory price bands, empty city/source/stay selections, invalid ranges, and manual-check amenities that are not required.

## Evidence and Scoring

Amenity and transit claims use four states:

- `confirmed`: the source directly supports the claim.
- `inferred`: likely but not directly stated.
- `ambiguous`: conflicting or incomplete evidence.
- `missing`: no usable evidence.

The value score combines price, rating, reviews, amenity evidence, transit, stay fit, cancellation flexibility, and source reliability. Penalties cover unclear fees, weak amenity evidence, sparse reviews, suspicious prices, and the EUR 50-80 expanded band. The JSON report includes the complete score breakdown.

Accepted means “worth checking,” not “safe to book blindly.” Always verify live availability, final checkout total, cancellation terms, room type, and warning-only amenities.

## Verify

```bash
npm run verify
```

Individual commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests cover config validation, date windows, filtering, scoring, transit, source normalization, source failure isolation, reports, state persistence, and HTTP API behavior.

## Scheduling

`.github/workflows/travel-deals.yml` runs verification and a cached report on a daily cron, then uploads Markdown/JSON artifacts. Add `SERPAPI_API_KEY` as a repository secret if that source is enabled.

For a personal machine, schedule the CLI with cron. For stronger uptime and secret management, use a hosted worker or serverless cron. Do not schedule unattended Codex web search until its runtime and cost fit the selected city/window count.

## Project Layout

```text
public/             Local web UI
src/server.ts       HTTP API and static server
src/checker.ts      Shared source/ranking orchestration
src/cli.ts          Console entry point
src/sources/        Source adapters
src/filtering.ts    Acceptance and warning rules
src/scoring.ts      Transparent value/confidence model
test/               Node test suite
data/               Snapshots, fixtures, web-search cache
reports/            Sample Markdown/JSON output
docs/               Source and architecture research
```

The older `travel_deals/` Python prototype remains as historical reference. The supported product is the TypeScript/npm implementation.

See `docs/research-brief.md` for provider/API risk and architecture research, and `documentation.md` for the operator runbook.
