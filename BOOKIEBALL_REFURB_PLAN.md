# BookieBall Refurb Plan

This file is a local handover note so the refurbishment can continue even if the chat/session ends.

## Current Goal

Refurb the active BookieBall app without breaking the existing competition rules, teams, gameweeks, or SQLite data. The app should still run the same competitions:

- Core division leagues
- BookieBall Cup
- Super Cup
- Master League
- Master Cup
- Trio League
- Tier League
- All-time leagues
- Gameweek entries, predictions, standings, cup progression, and penalty shootout tie resolution

The priority is stronger graphics, clearer navigation, better show-control surfaces, and a much better penalty shootout experience.

## Non-Negotiables

- Do not remove competition logic.
- Do not change which teams belong to each competition unless explicitly requested later.
- Do not change the GW1..GW8 structure.
- Do not break cup/team inclusion rules.
- Keep the app local-first with the existing Express + SQLite backend.
- Use build/type checks after each meaningful implementation pass.

## Phase 1: Stabilize Active Navigation

- Make the dashboard a clear control centre rather than a flat list.
- Keep only actively useful pages prominent.
- Retired/helper pages can remain available if used internally by Kick-Off Show or other pages.
- Fix `/leagues` so it opens `LeaguesHubPage` instead of redirecting straight to `/league`.
- Keep these main launch areas:
  - Run The Show
  - Competitions
  - Reports And Archive
  - Admin Tools

## Phase 2: Penalty Shootout Refurb

Main user pain point: cup ties often end level, penalties are fun, but current graphics look weak.

Planned improvements:

- Replace inline/basic board presentation with a broadcast-style shootout panel.
- Add team badges/colors to both sides.
- Add a proper scorebug with Home/Away, goals, next taker, and winner state.
- Improve shot markers for goals/saves.
- Add a visual goalmouth panel with crowd colors, banners, net, ball, keeper, and result stinger.
- Keep the existing canvas mini-game under the hood so outcome logic stays intact.
- Improve standalone `/penalty-shootout` page layout.
- Ensure global penalty modal still works for real tied fixtures.

## Phase 3: Visual System Upgrade

- Add stronger dashboard hero treatment.
- Add competition-specific visual tones.
- Reduce reliance on generic tiles.
- Start using existing team colors and badges more consistently.
- Keep the current CSS file for now to avoid a risky large split during the first pass, but prepare cleaner sections.

## Phase 4: Testing And Tooling

- Fix `scripts/browser-smoke.mjs` on Windows by spawning `npm.cmd` when needed.
- Update smoke checks so they match active navigation.
- Run:
  - `npm run lint`
  - `npm run build`
  - `npm run test:smoke` if local services can start cleanly

## Phase 5: Larger Future Refactor

These are recommended after the visible refurb pass:

- Split `web/src/styles.css` into feature CSS files.
- Split very large components:
  - `GameshowPage.tsx`
  - `SkyStudioPanel.tsx`
  - `ReportsHubPage.tsx`
  - `SnyNewsNewPage.tsx`
  - `database.ts`
- Move shared API response types into `src/shared`.
- Add an asset manager for team graphics/logos/trophy images.
- Add graphics export cards for results, fixtures, trophy winners, tables, and shock results.
- Add stream overlay/browser-source views for ticker, penalties, fixtures, and tables.

## Current Status - 2026-05-16

First refurb pass completed:

- `/leagues` route now opens `LeaguesHubPage`.
- Dashboard page is now a grouped control-centre layout.
- Standalone `/penalty-shootout` page has the new studio layout.
- `PenaltyShootoutBoard.tsx` now uses a broadcast-style scorebug, team badges/colors, shot markers, goalmouth graphic, and winner actions.
- Penalty results now include keeper dive direction separately from shot target.
- Windows smoke runner now uses the right npm command and process cleanup.
- Smoke checks were updated for active navigation labels.

Second refurb pass completed:

- Added a clear penalty readout for last taker, shot target, keeper move, and outcome.
- Exported the penalty kick type so modal/admin integrations can consume the richer shootout record cleanly.
- Tightened responsive CSS for the dashboard hero, penalty modal, scorebug, shootout grid, readout cards, and aim controls.

Verification after the second pass:

- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:smoke` passed with 23 checks.
- Playwright visual QA captured `/`, `/leagues`, `/cups`, and `/penalty-shootout` at desktop/mobile widths; no horizontal overflow was detected.

## Next Immediate Work

- Do a visual QA pass on one real penalty modal if a tied fixture is available.
- ~~Continue the visual system upgrade on competition pages, especially shared trophy/cup graphics and team color usage.~~ ✅ Completed: TrioLeaguePage, TierLeaguePage, MasterLeaguePage, and LeaguePage now have competition-page-hero headers, CompetitionTrophyMark, competition-metric-row, and are wrapped in competition-page-shell.
- Start planning the CSS split once the active visual surfaces settle.
