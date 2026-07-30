# Travel Scout

Travel Scout finds evidence-backed accommodation deals for flexible 2-6 night stays in European cities. The product is a mobile-first React app with Capacitor iOS/Android shells, a Node checker API, and a CLI that prints accepted deals and writes complete Markdown/JSON reports.

It does not book, message hosts, bypass anti-bot controls, or pretend missing amenities are confirmed.

## Start the App

Requirements: Node.js 22+ and npm. Capacitor 8 requires Node 22.

Development, with Vite on port 4173 and the checker API on port 4174:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

Production build and local server:

```bash
npm start
```

The first screen is Explore, with checked-in cached results available before an API is configured. The app supports:

- Ranked accepted stays with the EUR 35/50/80 price bands visible.
- A local shortlist that persists on the device.
- Full amenity, transit, manual-check, score, and source evidence.
- A deliberate excluded-offer view with rejection reasons.
- Dedicated search settings for cities, dates, prices, quality, amenities, and sources.
- Fast cached checks and a separate explicit Codex web-search action.
- Loading, cached/offline, empty, source-error, and API-connected states.

The app uses relative `/api` routes in browser development and production. A native build uses `VITE_API_BASE_URL` when set. Without it, the app remains useful with the checked-in result snapshot and labels that state `Cached snapshot`; it does not claim the Node checker runs on-device.

## Run on iOS or Android

Create `.env.local` when a device should call a hosted or LAN-accessible checker:

```bash
VITE_API_BASE_URL=https://travel-api.example.com
```

Build and sync both native projects:

```bash
npm run cap:sync
```

Open or run a platform:

```bash
npm run cap:open:ios
npm run cap:open:android
npm run cap:run:ios
npm run cap:run:android
```

`ios/` and `android/` are committed native shells. Capacitor consumes `web-dist/`, which is generated and ignored. Xcode is required for iOS. Android Studio, a JDK, and the Android SDK are required for Android.

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

Edit `config.example.json` for versioned defaults or use Settings. App settings persist in local storage; when the checker API is reachable they are also saved to ignored `config.local.json`. Important fields:

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

Tests cover config validation, date windows, filtering, scoring, transit, source normalization, source failure isolation, reports, state persistence, HTTP API behavior, CORS, and production app serving. `npm audit` is expected to report zero vulnerabilities.

## Scheduling

`.github/workflows/travel-deals.yml` runs verification and a cached report on a daily cron, then uploads Markdown/JSON artifacts. Add `SERPAPI_API_KEY` as a repository secret if that source is enabled.

For a personal machine, schedule the CLI with cron. For stronger uptime and secret management, use a hosted worker or serverless cron. Do not schedule unattended Codex web search until its runtime and cost fit the selected city/window count.

## Project Layout

```text
app/                React mobile app
public/             App icons and destination imagery
resources/          Source artwork for native icon and splash assets
web-dist/           Generated Vite bundle, ignored
ios/                Capacitor iOS project
android/            Capacitor Android project
capacitor.config.ts Native app and webDir contract
vite.config.ts      App build and API development proxy
src/server.ts       HTTP API and production app server
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
