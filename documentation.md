# Travel Scout Operator Runbook

Travel Scout is a TypeScript/Node.js accommodation deal checker being delivered through a React/Vite web app, Capacitor iOS/Android shells, and a CLI. The browser and configured native app call the same checker API. Native startup falls back to versioned checked-in results when no API is reachable.

## Setup

```bash
npm install
```

Node.js 22 or newer is required by Capacitor 8.

## Run

Development app and API:

```bash
npm run dev
```

Vite runs at `http://127.0.0.1:4173` and proxies `/api` to the checker at port 4174.

Production app and API:

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

Native shells:

```bash
npm run cap:sync
npm run cap:open:ios
npm run cap:open:android
```

Set `VITE_API_BASE_URL` at build time when iOS or Android should call a deployed or LAN-accessible checker API. With no API URL, native startup uses `reports/travel-deals.json` bundled by Vite and displays `Cached snapshot`.

## Mobile App Acceptance Flow

1. Open Explore and confirm accepted checked-in deals are visible before any setup.
2. Scan price, city, dates, score, source, and warnings without opening a detail view.
3. Save a deal, open Saved, and confirm it persists after reload.
4. Open a deal and inspect five amenity rows, transit evidence, reasons, manual checks, and the source URL.
5. Open excluded offers and inspect rejection reasons.
6. Open source status without crowding the primary deal list.
7. Change cities or price bands in Settings and run a cached check.
8. Run live web search only from its explicit action.
9. Verify the flow at 390x844 and 1440x1000.
10. Disconnect or stop the API and confirm the cached/native state remains usable and accurately labeled.

Cached checks write the normal reports but do not mutate seen-state. App preferences and shortlist IDs persist in local storage. When the API is reachable, a settings save also writes `config.local.json`.

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
React/Vite browser -----> src/server.ts -> src/checker.ts -> source adapters
Capacitor + API URL ----/                         |-> filtering + scoring
Capacitor offline -> checked-in report            |-> reports + seen-state
CLI -------------------------------------------> src/checker.ts
```

Key files after the Capacitor rebuild:

- `app/`: React app source.
- `public/travel-scout-city-morning.jpg`: generated destination-level image used by Explore.
- `resources/`: editable compass icon and launch-screen source artwork.
- `web-dist/`: Vite production bundle consumed by the server and Capacitor.
- `capacitor.config.ts`: native app identity and web bundle contract.
- `ios/`, `android/`: generated native projects.
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

## Native Boundary

Capacitor packages the React app, not the Node process. `VITE_API_BASE_URL` is therefore the only live-checker route on a device. The API sends permissive CORS headers for browser/WebView clients; deployments should add authentication and a restricted origin policy before exposing private source credentials publicly.

The bundled report is intentionally read-only fallback data. A failed native API call leaves those results visible and returns an actionable connection message rather than clearing the screen.

Verified native commands on 2026-07-30:

- `npm run cap:sync`
- Xcode unsigned `iphonesimulator` Debug build
- Android `assembleDebug` with Android Studio's bundled JDK

## Scheduling

GitHub Actions runs from repository root using `.github/workflows/travel-deals.yml`. It installs with `npm ci`, runs verification, generates the report, and uploads report artifacts.

Use local cron for a personal machine or hosted/serverless cron for stronger uptime. Keep source credentials in environment variables or repository secrets.

## Troubleshooting

- Development app does not start: check ports 4173 and 4174, then run `npm run dev`.
- Production app does not start: run `npm run build`, then check whether port 4173 is occupied.
- Native app only shows cached data: set a reachable `VITE_API_BASE_URL`, rebuild, and run `npm run cap:sync`.
- Android sync cannot find SDK/JDK: open `android/` in Android Studio and configure its SDK/JDK.
- iOS cannot build: open `ios/App/App.xcodeproj` or run `npm run cap:open:ios` on macOS with Xcode installed.
- UI shows a source error: open the source chip; other sources should still have completed.
- No web-search results: confirm `websearch_cli` is selected and the `codex` CLI is authenticated and on `PATH`.
- SerpAPI is empty: confirm `SERPAPI_API_KEY`, quota, and that the source is enabled.
- A candidate disappeared: its snapshot date may have moved outside the configured horizon.
- A price looks incomplete: inspect the yellow preliminary-price warning and verify checkout manually.
- Config save fails: the server error names the invalid field or contradictory range.
- Repeated CLI alerts: inspect the configured `state_path` and use `--no-write-state` for deterministic runs.
