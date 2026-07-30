# Travel Deal Discovery JS Agent Implementation Plan

This document is the execution source of truth. Keep it current as implementation reality changes.

## Current Objective

Turn the working TypeScript/Node.js checker into a practical local product without weakening its conservative evidence rules. Preserve the current preferred defaults, expose useful configuration in a web UI, keep the CLI working, make source activity and warnings understandable, document real behavior, and publish the complete project to `mistermantas/travel-scout`.

The existing Python prototype remains reference-only. JavaScript/TypeScript via npm is the supported runtime.

## Verification Checklist

Core commands:

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run build`
- [x] `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state`

Report contract:

- [x] `reports/travel-deals.md` is generated.
- [x] `reports/travel-deals.json` is generated.
- [x] JSON report includes city, neighborhood, source, listing name, URL, dates, stay length, total price, nightly equivalent, rating/review count, amenity evidence, transit evidence, confidence score, value score, reasons, and manual verification.
- [x] Markdown report contains the same information in human-readable form.
- [x] Vilnius does not appear as a candidate.
- [x] Accepted candidates obey hard filters.
- [x] EUR 35-50/night candidates require strong value score; EUR 50-80/night candidates can appear with score penalty and console warning.
- [x] Deterministic snapshot report ranks 13 source offers and accepts 8, including cached non-Booking evidence and the penalized EUR 50-80 band.

Final validation sweep:

- [x] Remove generated caches or build artifacts that should not be committed.
- [x] Run all core commands.
- [x] Inspect generated Markdown and JSON reports.
- [x] Confirm documentation matches the JS implementation.

Productization sweep:

- [x] Shared checker service powers both CLI and web server without duplicated ranking logic.
- [x] Config parser validates user-editable settings and supports configurable manual-check amenities.
- [x] `npm start` launches a local Travel Scout UI.
- [x] UI can run cached sources and explicitly opt into Codex CLI web search.
- [x] UI exposes the preferred EUR 35, penalty EUR 50, and hard-cap EUR 80 defaults without changing them.
- [x] UI clearly separates accepted candidates from excluded candidates and shows source/evidence warnings.
- [x] Server/API behavior has automated tests.
- [x] Desktop and mobile browser flows are verified with screenshots.
- [x] `.gitignore` excludes dependencies, build output, local state, and browser artifacts.
- [x] README and operator documentation match the shipped CLI and UI.
- [x] `main` is pushed to `https://github.com/mistermantas/travel-scout.git`.

## Architecture Overview

### Runtime

- Node.js + TypeScript.
- npm scripts for build, test, typecheck, lint, and CLI execution.
- Prefer Node built-ins (`fs/promises`, `node:test`, `assert`, `fetch` if available) unless a dependency meaningfully improves correctness.
- Local HTTP server and framework-free browser UI so installation remains small and the scoring engine stays the center of gravity.

### Suggested File Layout

```text
package.json
tsconfig.json
src/
  cli.ts
  config.ts
  dates.ts
  filtering.ts
  models.ts
  report.ts
  scoring.ts
  store.ts
  transit.ts
  sources/
    base.ts
    accorSnapshot.ts
    apartmentCandidateSnapshot.ts
    bookingSnapshot.ts
    fixture.ts
    serpapiGoogleHotels.ts
test/
  dates.test.ts
  filtering.test.ts
  scoring.test.ts
  transit.test.ts
  report.test.ts
  store.test.ts
data/
  fixture_listings.json
  accor_live_snapshot.json
reports/
  travel-deals.md
  travel-deals.json
```

### Data Model

Core entities:

- `Evidence`: `{ status: "confirmed" | "inferred" | "ambiguous" | "missing", detail: string, source?: string }`
- `CityConfig`: name, aliases, country, center coordinates, central radius, accepted transit modes.
- `DateWindow`: check-in, check-out, nights.
- `Listing`: normalized source listing with price, rating, reviews, amenities, transit evidence, cancellation, URL, raw payload.
- `ScoreBreakdown`: component scores, explicit penalties, total value score, confidence score.
- `DealResult`: listing, score, accepted flag, reasons, manual verification checklist, new/seen flag.

### Adapter Contract

Every source adapter implements:

```ts
interface SourceAdapter {
  name: string;
  search(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]>;
}
```

Adapters must:

- Preserve source URLs.
- Keep raw provider payloads.
- Never claim amenities as confirmed unless directly evidenced.
- Mark weak or missing data conservatively.
- Respect credentials and rate limits.
- Avoid bypassing captchas, authentication, or anti-bot protections.

### CLI Flow

1. Parse args: `--config`, `--out`, `--fixture-path`, `--accor-snapshot-path`, `--today`, `--no-write-state`.
2. Load config.
3. Generate date windows for the configured horizon.
4. Exclude configured cities, including Vilnius by default.
5. Instantiate enabled source adapters.
6. Search candidate listings.
7. Evaluate and score listings.
8. Sort accepted candidates ahead of rejected candidates by value and confidence.
9. Write Markdown and JSON reports.
10. Mark accepted results as seen unless `--no-write-state` is set.

### Product Flow

1. `npm start` builds and opens a local HTTP server.
2. The server loads `config.local.json` when present, otherwise `config.example.json`.
3. The browser edits search settings without requiring hand-edited JSON.
4. A cached check runs all enabled snapshot/cache sources quickly.
5. A live web check explicitly enables the slower `codex --search exec` adapter.
6. The API returns accepted and excluded candidates, summary counts, per-source counts, score details, evidence, and warnings.
7. Saving settings writes `config.local.json`; the versioned defaults remain unchanged.

## Milestones

### Milestone 01 - npm/TypeScript Scaffold [x]

Scope:

- Add `package.json`, `tsconfig.json`, source/test directories, and npm scripts.
- Choose minimal dependencies.
- Make all npm commands exist, even if early tests are skeletal.

Key files/modules:

- `package.json`
- `tsconfig.json`
- `src/`
- `test/`

Acceptance criteria:

- `npm install` succeeds.
- `npm run typecheck`, `npm run test`, `npm run build`, and `npm run lint` run.
- `npm run deals -- --help` or equivalent CLI invocation does not crash once CLI exists.

Verification commands:

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run lint`

### Milestone 02 - Core Models, Config, and Date Windows [x]

Scope:

- Implement TypeScript models.
- Load `config.example.json`.
- Generate flexible date windows for the configured horizon; default config covers the next 180 days and 2-6 night stays.

Key files/modules:

- `src/models.ts`
- `src/config.ts`
- `src/dates.ts`
- `test/dates.test.ts`

Acceptance criteria:

- Config exposes all required editable fields.
- Date windows are deterministic with `--today`.
- Vilnius remains excluded by config.

Verification commands:

- `npm run typecheck`
- `npm run test`

### Milestone 03 - Scoring, Filtering, and Transit Confidence [x]

Scope:

- Implement transparent score components and explicit penalties.
- Implement filtering for hard requirements.
- Implement transit confidence from coordinates and source text.

Key files/modules:

- `src/scoring.ts`
- `src/filtering.ts`
- `src/transit.ts`
- `test/scoring.test.ts`
- `test/filtering.test.ts`
- `test/transit.test.ts`

Acceptance criteria:

- Under EUR 35 gets full price score.
- Above the hard maximum is rejected.
- EUR 35-50 requires configurable strong value score.
- EUR 50-80 can appear with an expanded-band score penalty and console warning.
- Missing required amenity rejects.
- Ambiguous/inferred required amenity triggers manual verification and penalty.
- Shared/dorm listings reject by default.
- Transit confidence statuses are deterministic and explained.

Verification commands:

- `npm run typecheck`
- `npm run test`

### Milestone 04 - Source Adapters [x]

Scope:

- Implement `SourceAdapter` interface.
- Implement Accor real-data snapshot adapter using `data/accor_live_snapshot.json`.
- Implement Booking snapshot adapter using captured Booking.com connector search/property-QA evidence.
- Implement apartment candidate snapshot adapter using captured public Hotels.com/Expedia-style evidence.
- Keep fixture adapter using `data/fixture_listings.json` for deterministic synthetic tests only.
- Implement SerpAPI Google Hotels adapter behind `SERPAPI_API_KEY`.

Key files/modules:

- `src/sources/base.ts`
- `src/sources/accorSnapshot.ts`
- `src/sources/fixture.ts`
- `src/sources/serpapiGoogleHotels.ts`
- `test/sources.test.ts`

Acceptance criteria:

- Fixture adapter returns normalized listings.
- Booking snapshot adapter returns real Booking connector candidates, including accepted and rejected apartment-style cases.
- Apartment candidate snapshot adapter returns public apartment-style evidence without implying acceptance when dates/fees/climate evidence are weak.
- Accor snapshot adapter returns at least two real Accor listings inside the next 180 days and keeps hotel-style misses rejected.
- SerpAPI adapter returns empty list with a clear non-fatal path when no key is configured.
- SerpAPI normalization marks amenities and fees conservatively.
- Source adapters are easy to extend.

Verification commands:

- `npm run typecheck`
- `npm run test`

### Milestone 05 - Reports and Seen-State Store [x]

Scope:

- Implement Markdown and JSON report writers.
- Implement JSON seen-state store.
- Preserve report field contract.

Key files/modules:

- `src/report.ts`
- `src/store.ts`
- `test/report.test.ts`
- `test/store.test.ts`

Acceptance criteria:

- Markdown and JSON reports include every required field.
- Seen-state marks accepted listing/date keys.
- `--no-write-state` keeps real-data snapshot runs deterministic.

Verification commands:

- `npm run typecheck`
- `npm run test`

### Milestone 06 - CLI End-to-End Runner [x]

Scope:

- Implement the `npm run deals` command.
- Wire config, windows, sources, scoring, sorting, reports, and state together.

Key files/modules:

- `src/cli.ts`
- `package.json`
- `reports/travel-deals.md`
- `reports/travel-deals.json`

Acceptance criteria:

- `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state` writes both reports.
- Report contains at least two real Accor listings within the next 180 days, with official URLs and source metadata.
- No Python runtime is required for the JS CLI.

Verification commands:

- `npm run build`
- `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state`

### Milestone 07 - Documentation and Scheduling [x]

Scope:

- Update README and `documentation.md` for the JS implementation.
- Keep `docs/research-brief.md` accurate.
- Include GitHub Actions/local cron/hosted worker scheduling instructions.

Key files/modules:

- `README.md`
- `documentation.md`
- `docs/research-brief.md`

Acceptance criteria:

- A human can install, run, test, schedule, and extend the JS agent from docs alone.
- Docs clearly explain that Booking.com/Airbnb scraping is not implemented by default.

Verification commands:

- Manually inspect docs.
- `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state`

### Milestone 08 - Final Sweep [x]

Scope:

- Run full validation.
- Remove unintended generated files.
- Inspect generated reports.
- Update this plan and documentation with final status.

Acceptance criteria:

- Every verification checklist item is checked.
- Final report files exist and satisfy the contract.
- No known critical gaps remain against `prompt.md`.

Verification commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state`

### Milestone 09 - Shared Checker and Config Contract [x]

Scope:

- Extract source orchestration, ranking, summaries, and report persistence from the CLI into a reusable checker service.
- Add runtime config validation and serialization.
- Replace the hardcoded blackout exception with `manual_check_amenities`, defaulting to `blackout_window_covering`.
- Report per-source candidate and accepted counts.

Acceptance criteria:

- CLI output and report behavior remain compatible.
- Invalid config fails with actionable field-specific errors.
- Both CLI and future HTTP server call the same checker service.
- Blackout remains warning-only under the preferred defaults.

Verification commands:

- `npm run typecheck`
- `npm run test`
- `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state`

### Milestone 10 - Local Web UI and API [x]

Scope:

- Add a Node HTTP server with config, check, save, health, and static-asset routes.
- Build a responsive operational dashboard in `public/`.
- Expose cities, stay lengths, price bands, horizon, rating/reviews, transit, room policy, amenities, and sources.
- Add cached and explicit live-web-search actions.
- Show accepted candidates by default, with an intentional excluded-candidate view.

Acceptance criteria:

- `npm start` serves the application on a configurable local port.
- Initial results load without credentials or live network search.
- Settings can be edited, checked, reset, and saved locally.
- Candidate rows expose price, score, dates, source, evidence, and manual checks.
- Loading, empty, error, and disabled-live-source states are handled.

Verification commands:

- `npm run typecheck`
- `npm run test`
- `curl http://127.0.0.1:4173/api/health`
- Desktop and mobile browser acceptance flow.

### Milestone 11 - Documentation, Repository Hygiene, and GitHub [x]

Scope:

- Rewrite README around the actual CLI and UI.
- Update the operator runbook, research brief, and long-horizon decision log.
- Add repository hygiene and a useful GitHub Actions verification workflow.
- Initialize Git, commit the full intended project, set `main`, add the requested remote, and push.

Acceptance criteria:

- A new operator can install, run the UI, run the CLI, enable live web search, interpret warnings, and test the project from the README alone.
- Generated dependencies/build/local state/browser artifacts are not committed.
- GitHub `main` matches the fully verified local source.

Verification commands:

- `npm run verify`
- `git status -sb`
- `git ls-remote --heads origin main`

## Risk Register

1. OTA/API compliance risk

- Risk: Booking.com/Airbnb scraping may be brittle or violate terms.
- Mitigation: Do not implement those scrapers by default. Use Accor snapshot, fixture tests, and SerpAPI adapter; document approved future adapters.

2. Amenity evidence risk

- Risk: Search APIs may not expose stovetop, utensils, blackout curtains, or individual climate control.
- Mitigation: Evidence statuses must be conservative. Missing evidence rejects; ambiguous evidence creates manual verification and score penalties.

3. False-value risk

- Risk: EUR 35-50/night listings become accepted too easily.
- Mitigation: Enforce `min_value_score_for_over_preferred_price`, default `70`.

4. Date-window explosion

- Risk: Too many city/date combinations make live API usage expensive.
- Mitigation: Configurable horizon and step size; cap per-source result count; document cost implications.

5. JS rewrite drift

- Risk: New implementation diverges from already verified Python behavior.
- Mitigation: Port behavior through focused tests and compare report shape against real Accor snapshot and fixture cases.

6. Long-running web search in an HTTP request

- Risk: A full multi-city Codex web search can take several minutes and appear stalled.
- Mitigation: Keep cached checks as the default, label live search as slow, limit it to currently selected cities, enforce timeouts, and return clear errors.

7. User config corruption

- Risk: Browser-edited settings could create contradictory price bands or unusable date windows.
- Mitigation: Validate all numeric ranges and ordering server-side before any source runs or config is saved.

8. Duplicate property variants

- Risk: The same property can appear through multiple sources and look like accidental duplication.
- Mitigation: Preserve source-specific offers, expose source labels clearly, and include deterministic source counts rather than silently collapsing potentially different prices/evidence.

## Demo / Acceptance Flow

0:00-0:30

- Run `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state`.

0:30-1:30

- Open `reports/travel-deals.md` and show the two real Accor Warsaw listings, official Accor URLs, source evidence, prices, and rejection reasons for missing apartment-style amenities.

1:30-2:30

- Open `reports/travel-deals.json` and show score breakdown, evidence statuses, transit confidence, penalties, and manual verification.

2:30-3:00

- Run `npm run test`, `npm run typecheck`, and `npm run build`.

Product UI:

- Run `npm start`.
- Confirm the accepted view immediately shows cached deals and the EUR 35/50/80 bands.
- Open a deal and inspect amenity evidence, transit evidence, warnings, source URL, and score breakdown.
- Switch to excluded candidates and confirm rejection reasons are visible only in that intentional view.
- Edit price/stay/city/source settings, run a cached check, reset defaults, and save a local config.
- Verify the same flow at desktop and mobile widths.

## Decision Log

- Initial decision: Build TypeScript/Node.js implementation with npm commands while preserving the Python prototype as reference only.
- Initial decision: Use fixture source as deterministic baseline and SerpAPI Google Hotels as first live adapter because it is lower-risk than OTA browser scraping.
- Implemented decision: Default config now uses `accor_snapshot`, populated from the official Accor live-rate connector, so normal reports are real sourced data rather than fixture data.
- Initial decision: Keep evidence conservative and manual-verification-first; the agent never books or messages hosts.
- Implemented decision: Use TypeScript plus Node built-ins and only `typescript`/`@types/node` dev dependencies.
- Implemented decision: Use Node's built-in `node:test` runner; `npm run test` builds first and then runs compiled tests.
- Implemented decision: Keep `lint` as `tsc --noEmit` because no formatting/lint dependency is needed for this small package.
- Implemented decision: `npm run deals` builds first, then runs `dist/src/cli.js`, so the CLI works from source after `npm install`.
- Productization decision: Preserve the existing EUR 35 preferred, EUR 50 penalty, and EUR 80 maximum defaults from the conversation.
- Productization decision: Keep source-specific offers separate because OTA prices and evidence can differ; make duplicates understandable through explicit source attribution.
- Productization decision: Use a framework-free local HTTP/UI layer and share the core checker service with the CLI.
- Productization decision: Cached search is the default interaction. Live Codex CLI web search requires an explicit user action because it is slow and network-dependent.
- Implemented decision: Run enabled adapters with `Promise.allSettled`; expose source errors while retaining successful provider results.
- Implemented decision: Store browser-saved settings in ignored `config.local.json`, leaving `config.example.json` as the stable preferred defaults.
- Implemented decision: Use Lucide's local UMD bundle for UI icons so the control panel has no runtime CDN dependency.
- Verified decision: Desktop and 390px mobile browser checks completed with no console errors or horizontal overflow; cached checks, evidence expansion, tabs, filtering, and the mobile settings action bar all worked.
- Published decision: Initialize the requested empty public repository directly on `main`; root commit `82490fc` contains the complete verified project and sample reports.
