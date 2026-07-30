# Capacitor App Implementation Contract

Now rebuild the working JavaScript/npm travel-deal checker as a mobile-first React/Vite/Capacitor product end to end.

## Non-Negotiable Constraints

- Do not stop after each milestone to ask for confirmation when the scope is already clear.
- Treat `plans.md` as authoritative.
- Keep moving through the milestones until the TypeScript/npm implementation is complete and verified.
- Do not replace the requested JS/npm build with more Python work.
- Do not implement brittle Booking.com or Airbnb scraping by default.
- Do not book anything, message hosts, bypass captchas, bypass authentication, ignore rate limits, or work around anti-bot protections.
- Do not treat the web UI as a separate demo with duplicate scoring logic; both surfaces must use the same checker service.
- Keep the user's preferred defaults intact unless a future explicit request changes them.
- Do not modify `/Users/mantas/Git/uncwo/savoristic` or `/Users/mantas/Git/uncwo/resapienti/resapienti-pwa`.
- Do not claim the Node checker runs inside the native app. Use the HTTP API when configured and checked-in cached results otherwise.
- Do not make settings the first screen.
- Do not add descriptions to deal cards. Show price, place, dates, score, warnings, save state, and source through compact UI.
- Do not use fake property imagery. Generated city imagery is destination-level presentation only.

## Execution Rules

- Re-read `prompt.md`, `plans.md`, `implement.md`, and `documentation.md` before starting work.
- If a milestone is too broad, split it in `plans.md` before coding.
- Make small, reviewable changes.
- Prefer deterministic tests over broad end-to-end assumptions.
- When fixing a bug, write a failing test first when practical.
- After every milestone:
  - run that milestone's verification commands
  - fix failures immediately
  - add or update tests for the core behavior
  - update `plans.md` status and decision log
  - update `documentation.md` to match shipped behavior
- After every meaningful visual change, inspect desktop and phone screenshots before claiming the UI is ready.
- If reality differs from the plan, update the plan before or alongside the code.

## Quality Bar

- TypeScript should be strict enough to catch shape errors in source adapters and reports.
- Runtime errors should be clear and actionable.
- Missing API credentials should not crash fixture/demo runs.
- Report generation should be deterministic for `--today` and `--no-write-state`.
- Scoring must be transparent and inspectable in JSON output.
- Manual verification must be explicit for ambiguous or inferred evidence.
- Safe-area handling, touch targets, narrow-screen layout, offline/cached state, reduced motion, and text fitting must be verified.
- Capacitor packages and native projects must remain version-aligned.

## Completion Criteria

The work is complete only when:

- `npm install` succeeds.
- `npm run lint` succeeds.
- `npm run typecheck` succeeds.
- `npm run test` succeeds.
- `npm run build` succeeds.
- `npm run deals -- --config config.example.json --out reports --today 2026-07-04 --no-write-state` succeeds.
- `reports/travel-deals.md` and `reports/travel-deals.json` exist and satisfy the required output contract.
- README and `documentation.md` describe the JS/npm implementation accurately.
- `plans.md` shows all necessary milestones complete and records meaningful decisions.
- `npm start` serves a verified desktop/mobile web UI.
- `npm run dev` starts the React app and checker API.
- `npm run cap:sync` successfully builds and syncs iOS and Android.
- Explore, Saved, Settings, offer detail, excluded offers, and source status are complete mobile flows.
- Native startup uses cached results when no API base URL is configured and says so plainly.
- Invalid browser-edited configuration is rejected with an actionable message.
- Cached and live-web-search actions are distinct.
- The intended repository contents are committed and pushed to `mistermantas/travel-scout` on `main`.

Do not declare completion until the final validation sweep proves the current state satisfies `prompt.md`.
