# BookieBall

BookieBall is a local-only TypeScript/React gameshow, league, cup and analytics application backed by SQLite. It now contains a multi-season historical archive, seven competition types, a live Kickoff Show, penalty queues, predictions, reporting and an auto-running analytics Command Centre.

## Stack

- Node.js 20+
- TypeScript
- Express API
- Vite + React UI
- SQLite via `better-sqlite3`
- Playwright for browser/layout regression checks
- GitHub Actions CI

## Run locally

- Double-click `BookieBall App.cmd`, or run `npm run dev`.
- API: `http://localhost:5181`
- Web UI: `http://localhost:5180`
- Local database: `~/.bookieball/bookieball.db`
- Create a backup with `npx tsx src/cli.ts backup --label before-change`.

## Core season model

- Seasons run through `GW1..GW8`.
- Advancing beyond GW8 rolls into the next season.
- Historical data is retained rather than overwritten.
- Standard division ranking uses points, then performance tie-break rules.
- Promotion/relegation, playoff and cup logic are resolved by the database domain layer.

## Competitions

BookieBall currently tracks seven competition families:

1. BookieBall League divisions
2. Master League
3. Trio League
4. Tier League
5. BookieBall Cup
6. Master Cup
7. Super Cup

The frontend competition registry lives in `web/src/lib/competitionRegistry.ts`. Historical team views should represent every competition for every season, using `—` when a team did not participate.

## Home Command Centre

Home is an auto-running broadcast-style analytics screen designed to fit a normal laptop browser window without F11. It rotates through:

- each standard division with current-GW fixtures
- Master League with current-GW fixtures
- Trio League groups with current-GW fixtures
- Tier League groups with current-GW fixtures
- all-time points, profit and spins
- power ratings and current profit race
- BookieDor
- all-time H2H spotlights
- live storylines

Long tables and long fixture lists auto-scroll inside their own column. Fixture cards show the current score/profit either side of `VS` plus the all-time W-L-D record between the two teams.

## Team Journey

Team Journey is launched from Home and builds a season-by-season career view across:

- standard league/division and finishing position
- Master League
- Trio League
- Tier League
- BookieBall Cup
- Master Cup
- Super Cup

Canonical frontend history types live in `web/src/lib/historyModels.ts`.

## Kickoff Show

The Kickoff Show is the presentation/gameplay flow. It includes the chooser, fixture presentation, score/profit context, competition views, predictions and entry logging. Laptop mode is designed around internal responsive layouts rather than whole-page zooming.

Current-gameweek data can be prefetched through `web/src/lib/currentGameweekSnapshot.ts`. Gameweek-changing mutations emit application events so expensive warm-up work is triggered when state actually changes rather than continuously polling the whole archive.

## Penalties

The top navigation exposes the penalty queue. It highlights when shootouts are waiting and supports resolving individual ties or letting the computer complete a full shootout. Penalty resolution is competition-aware across Cup, Super Cup, Master Cup and playoff flows.

## Architecture

### Database

`src/db/database.ts` remains the compatibility implementation while the codebase is being split into domain facades under `src/db/domains/`:

- `league.ts`
- `competitions.ts`
- `history.ts`
- `season.ts`

New backend work should import through the domain modules where possible. This allows the large legacy database implementation to be split safely without changing the persisted SQLite schema or historical records.

### Frontend

Important shared infrastructure:

- `web/src/lib/competitionRegistry.ts` — canonical competition definitions
- `web/src/lib/currentGameweekSnapshot.ts` — unified live data loader
- `web/src/lib/appEvents.ts` — app-level events for mutation/gameweek changes
- `web/src/lib/fetchCache.ts` — categorized cache and invalidation
- `web/src/components/broadcast/AutoScrollViewport.tsx` — reusable overflow-aware TV-style scrolling
- `web/src/components/TeamJourneyOverlay.tsx` — historical career presentation

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:cup`
- `npm run test:trio`
- `npm run test:studio`
- `npm run test:smoke`
- `npm run test:layout`
- `npm run test:ci`

`test:layout` opens BookieBall at multiple laptop viewports and fails if Home or the Kickoff Show creates document-level horizontal/vertical overflow. It also verifies Home fixture cards contain a centred `VS` scoreline and an all-time H2H line.

## CI

Pull requests and pushes to `main` run `.github/workflows/ci.yml`, which performs:

- TypeScript checking
- competition regression scripts
- production build
- Chromium installation
- laptop layout regression testing

Do not merge a substantial UI/gameweek refactor while CI is red.

## Data safety

- Runtime data is stored in the local SQLite database under `~/.bookieball`.
- Back up before schema/gameweek lifecycle changes.
- Historical rows should not be hard-deleted during refactors.
- Changes to competition resolution should be covered by a regression script before merge.
- The bundled DB snapshot remains a compatibility/bootstrap asset for now; longer-term it should move to a cleaner release/LFS distribution mechanism rather than normal Git history.
