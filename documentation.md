# Travel Scout Operator Runbook

Travel Scout is a TypeScript/Node.js accommodation deal checker with a local web UI and CLI. Both surfaces call the same checker service, source adapters, filters, scoring model, and report writers.

## Setup

```bash
npm install
```

Node.js 20 or newer is recommended.

## Run

Web UI:

```bash
npm start
```

Open `http://127.0.0.1:4173`. Use `npm start -- --port 4300` when the default port is occupied.

CLI:

```bash
npm run deals -- --config config.example.json --out reports
```

Deterministic snapshot:

```bash
npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state
```

Full verification:

```bash
npm run verify
```

## UI Acceptance Flow

1. Start the server and confirm the Accepted view loads cached results.
2. Confirm the summary shows accepted, checked, cities, and date-window counts.
3. Confirm source chips show checked and accepted counts separately.
4. Expand a deal and inspect five amenity rows, transit evidence, source URL, reasons, and manual checks.
5. Switch to Excluded and inspect rejection reasons.
6. Filter `Lisbon`; Morgan-Jupiter Apartments should show the EUR 50+ expanded-band warning under the sample data.
7. Change cities or price bands and run **Check deals**.
8. Save settings and confirm `config.local.json` is created.
9. Verify the same flow at a 390px-wide viewport.

Cached checks write the normal reports but do not mutate seen-state. UI saves are the only operation that writes `config.local.json`.

## Default Behavior

- Preferred: EUR 35/night.
- Strong-value band: above EUR 35 through EUR 50.
- Expanded band: above EUR 50 through EUR 80, with score penalty and yellow warning.
- Price remains preliminary when fees or taxes are unclear.
- Climate control, kitchen/kitchenette, stovetop, and utensils require direct confirmation.
- Blackout covering defaults to `manual_check_amenities`, so weak evidence warns instead of rejecting.
- Rating minimum: 8.0/10 or 4.5/5.
- Review confidence threshold: 25.
- Private accommodations only.
- Vilnius excluded.

The deterministic 2026-07-04 snapshot produces 13 ranked candidates and 8 accepted source offers. The current-date UI count can differ as configured windows move.

## Source Operations

`booking_snapshot`, `apartment_candidate_snapshot`, and `accor_snapshot` read checked-in data. `websearch_cli` reads `data/websearch_cli_results.json` unless live search is explicitly enabled. `serpapi_google_hotels` returns no candidates when `SERPAPI_API_KEY` is absent.

Live Codex web search:

```bash
ENABLE_CODEX_WEBSEARCH=1 npm run deals -- --config config.example.json --out reports --no-write-state
```

The UI **Search web** action enables the same adapter for that request. It searches each selected city separately and can take several minutes. Source failures are isolated and appear in source diagnostics; other providers still return results.

## Report Contract

`reports/travel-deals.json` and `reports/travel-deals.md` include:

- accepted/excluded state and new/seen state
- city, area, source, property, URL, dates, stay length
- total and nightly price
- rating and review count
- amenity and transit evidence
- value, confidence, and score breakdown
- acceptance/rejection reasons
- manual verification checklist
- source metadata and evidence URLs where available

The CLI console intentionally prints accepted deals only. Use the reports or UI Excluded tab for rejected candidates.

## Architecture

```text
browser -> src/server.ts -> src/checker.ts -> source adapters
                                      |-> filtering + scoring
                                      |-> reports + seen-state
cli -------------------------------> src/checker.ts
```

Key files:

- `public/`: framework-free responsive UI.
- `src/server.ts`: health, bootstrap, check, save-config, and static routes.
- `src/checker.ts`: source execution, failure isolation, evaluation, ranking, summaries, reports, state.
- `src/config.ts`: raw config parser, validation, normalization, serialization.
- `src/sources/`: provider adapters.
- `src/filtering.ts`, `src/scoring.ts`: decision and ranking logic.
- `test/`: 41 focused Node tests at the time of this productization pass.

## State and Local Files

- `config.example.json`: versioned preferred defaults.
- `config.local.json`: UI-saved settings; ignored by Git.
- `data/seen_results.json`: accepted listing/date keys; ignored by Git.
- `data/websearch_cli_results.json`: versioned sample/cache used by normal runs.
- `output/playwright/`: local browser evidence; ignored by Git.

## Scheduling

GitHub Actions runs from repository root using `.github/workflows/travel-deals.yml`. It installs with `npm ci`, runs verification, generates the report, and uploads report artifacts.

Use local cron for a personal machine or hosted/serverless cron for stronger uptime. Keep source credentials in environment variables or repository secrets.

## Troubleshooting

- UI does not start: run `npm run build`, then check whether port 4173 is occupied.
- UI shows a source error: open the source chip; other sources should still have completed.
- No web-search results: confirm `websearch_cli` is selected and the `codex` CLI is authenticated and on `PATH`.
- SerpAPI is empty: confirm `SERPAPI_API_KEY`, quota, and that the source is enabled.
- A candidate disappeared: its snapshot date may have moved outside the configured horizon.
- A price looks incomplete: inspect the yellow preliminary-price warning and verify checkout manually.
- Config save fails: the server error names the invalid field or contradictory range.
- Repeated CLI alerts: inspect the configured `state_path` and use `--no-write-state` for deterministic runs.
