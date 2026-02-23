# bookieball

Local-only Node.js CLI + web app for running a GW1..GW8 gameshow league and cup.

## Stack

- Node.js 20+
- TypeScript
- CLI: commander
- API: Express
- UI: Vite + React
- DB: SQLite (`better-sqlite3`)

## Local data

- DB directory: `~/.bookieball`
- DB file: `~/.bookieball/bookieball.db`
- Built-in seed is the exact 20-team list you provided (name, url, colors).
- Optional override file: `~/.bookieball/teams.json` (20 rows, supports `team_id`, `name`, `url`, `ball_color`, `ring_color`, `text_color`).
- Template file in repo: `teams.seed.example.json`.

## Commands

- `npm install`
- `npm run init`
  - Creates `~/.bookieball`
  - Creates DB, runs migrations, seeds settings and teams
  - Assigns divisions (4/4/4/4/4)
  - Generates cup draw scaffold from GW2 to GW6
- `npm run dev`
  - Starts API on `5181`
  - Starts Vite UI on `5180`
  - Opens browser automatically
- `npm run reset`
  - Deletes DB and re-runs init
- `npx tsx src/cli.ts backup --label pre-upgrade`
  - Creates a timestamped DB backup in `~/.bookieball/backups`

You can also run the CLI directly:

- `npx tsx src/cli.ts init`
- `npx tsx src/cli.ts start`
- `npx tsx src/cli.ts reset --yes`

## Game logic implemented

- Gameweeks: `GW1..GW8` only (no dates)
- Season rollover after GW8: increments season (`S1 -> S2`) and resets GW to `GW1`
- Division ranking is fixture-based by points (Win=3, Draw=1, Loss=0), then profit, then wins, then random
- Season-end promotion/relegation: bottom of each higher division swaps with top of next lower division
- Cup:
  - GW1 runs the cup draw ceremony (20 teams + 12 byes), with no BYE vs BYE pairings
  - GW2 Round of 32, GW3 Round of 16, GW4 Quarterfinals, GW5 Semifinals, GW6 Final
  - Winner by GW profit, then random tiebreak for equal profit
  - A GW's cup result is only finalized after advancing to the next GW

## Web pages

- Home:
  - Cup Draw
  - League Table & More
  - Trophy Room
  - Start the Gameshow
- Cup Draw (separate screen):
  - GW1-only start button
  - Draws from one pool of 32 balls (20 teams + 12 BYEs)
  - Reveals pairings two-at-a-time: Team A then Team B => `Team A vs Team B`
  - BYE never plays BYE
  - Shows a visual bracket tree from GW2 to GW6
  - No tabs opened, no logging
- Gameshow:
  - On GW1, requires cup draw to be completed first
  - Selected ball/team appears first, then team URL opens after 3 seconds
  - 5-second fullscreen countdown
  - Animated 20-ball tombola panel
  - Random team draw + division + current GW cup opponent
  - Auto-opens team URL in new tab
  - Logging panel (Free Spins / Bonus) writes entries to DB
- League Table & More:
  - Division tables
  - Manual add entry
  - Cup bracket GW2..GW6
  - Trophy room (cup + each division winners)
  - Team drill-down stats (season, all-time, cup wins, league titles)
- Matchday Wall:
  - Live fixture wall, streaks, shock-of-week, and spotlight fixture cards
- Reporting Desk:
  - Storylines, rivalry desk, snapshot compare cards, and report-pack export

## API endpoints

- `GET /api/state`
- `GET /api/teams`
- `GET /api/league-table`
- `GET /api/league-fixtures`
- `GET /api/league-movement`
- `GET /api/cup`
- `GET /api/cup/status`
- `POST /api/cup/start-draw`
- `GET /api/team/:id/stats`
- `GET /api/team/:id/history`
- `POST /api/team/history-bulk`
- `GET /api/team-ratings`
- `GET /api/achievements`
- `GET /api/head-to-head`
- `GET /api/trophy-room`
- `POST /api/gameshow/draw`
- `GET /api/predictions`
- `POST /api/predictions`
- `POST /api/predictions/lock`
- `POST /api/predictions/unlock`
- `GET /api/predictions/scoreboard`
- `POST /api/entries`
- `GET /api/entries`
- `PATCH /api/entries/:id`
- `GET /api/report/storylines`
- `GET /api/report/rivalry-desk`
- `GET /api/report/snapshot-compare`
- `GET /api/report/pack`
- `POST /api/admin/advance-gw`
- `POST /api/admin/load-league-fixtures`
- `POST /api/admin/set-gw`

## Notes

- No Google Sheets or external services are used.
- Everything persists in local SQLite.
- Frontend API base can be overridden with `VITE_API_BASE` (defaults to `http://localhost:5181/api`).
