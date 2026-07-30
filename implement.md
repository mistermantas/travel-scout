# Implementation Contract

Now implement the JavaScript/npm travel-deal discovery agent end to end.

## Non-Negotiable Constraints

- Do not stop after each milestone to ask for confirmation when the scope is already clear.
- Treat `plans.md` as authoritative.
- Keep moving through the milestones until the TypeScript/npm implementation is complete and verified.
- Do not replace the requested JS/npm build with more Python work.
- Do not implement brittle Booking.com or Airbnb scraping by default.
- Do not book anything, message hosts, bypass captchas, bypass authentication, ignore rate limits, or work around anti-bot protections.
- Do not treat the web UI as a separate demo with duplicate scoring logic; both surfaces must use the same checker service.
- Keep the user's preferred defaults intact unless a future explicit request changes them.

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
- If reality differs from the plan, update the plan before or alongside the code.

## Quality Bar

- TypeScript should be strict enough to catch shape errors in source adapters and reports.
- Runtime errors should be clear and actionable.
- Missing API credentials should not crash fixture/demo runs.
- Report generation should be deterministic for `--today` and `--no-write-state`.
- Scoring must be transparent and inspectable in JSON output.
- Manual verification must be explicit for ambiguous or inferred evidence.

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
- Invalid browser-edited configuration is rejected with an actionable message.
- Cached and live-web-search actions are distinct.
- The intended repository contents are committed and pushed to `mistermantas/travel-scout` on `main`.

Do not declare completion until the final validation sweep proves the current state satisfies `prompt.md`.
