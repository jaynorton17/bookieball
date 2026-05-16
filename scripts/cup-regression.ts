import { getDivisionOrderForSeason, getDivisionSlotsForSeason } from '../src/shared/constants.js';
import {
  ensureCupProgress,
  getCupBracket,
  getCupTieFixturesForRange,
  getLeagueTable,
  getState,
  getTeams,
  openDatabase,
  setCupFixtureWinner,
  setCurrentState,
  setGameweekLock,
} from '../src/db/database.js';

function fail(message: string): never {
  throw new Error(`Cup regression failed: ${message}`);
}

function assertManualPenaltyWinnerSurvivesProgressRefresh(db: ReturnType<typeof openDatabase>): void {
  const state = getState(db);
  db.exec('BEGIN');
  try {
    const homeResult = db.prepare(
      `
      INSERT INTO teams (team_id, name, url, ball_color, ring_color, text_color)
      VALUES ('regression-home', 'Regression Home', 'https://example.com/home', '#111111', '#222222', '#ffffff')
      `,
    ).run();
    const awayResult = db.prepare(
      `
      INSERT INTO teams (team_id, name, url, ball_color, ring_color, text_color)
      VALUES ('regression-away', 'Regression Away', 'https://example.com/away', '#333333', '#444444', '#ffffff')
      `,
    ).run();
    const homeId = Number(homeResult.lastInsertRowid);
    const awayId = Number(awayResult.lastInsertRowid);
    setCurrentState(db, state.currentSeason, 'GW2');
    setGameweekLock(db, state.currentSeason, 'GW2', false);
    db.prepare(
      `
      INSERT INTO entries (season, gw, team_id, entry_type, profit, spins, no_win)
      VALUES (?, 'GW2', ?, 'regression', 0, 1, 0)
      `,
    ).run(state.currentSeason, homeId);
    db.prepare(
      `
      INSERT INTO entries (season, gw, team_id, entry_type, profit, spins, no_win)
      VALUES (?, 'GW2', ?, 'regression', 0, 1, 0)
      `,
    ).run(state.currentSeason, awayId);
    const result = db.prepare(
      `
      INSERT INTO cup_fixtures (season, gw, round_name, home_team_id, away_team_id, winner_team_id, is_manual)
      VALUES (?, 'GW2', 'Regression Penalty', ?, ?, NULL, 1)
      `,
    ).run(state.currentSeason, homeId, awayId);
    const fixtureId = Number(result.lastInsertRowid);

    setCupFixtureWinner(db, state.currentSeason, fixtureId, homeId, 'regression');
    ensureCupProgress(db, state.currentSeason, 'GW2');

    const row = db.prepare('SELECT winner_team_id FROM cup_fixtures WHERE id = ?').get(fixtureId) as { winner_team_id: number | null };
    if (row.winner_team_id !== homeId) {
      fail('manual penalty winner was cleared by cup progress refresh');
    }
    const stillQueued = getCupTieFixturesForRange(db, state.currentSeason, 'GW2').some((tie) => tie.fixtureId === fixtureId);
    if (stillQueued) {
      fail('manual penalty winner remained in the penalty queue');
    }
  } finally {
    db.exec('ROLLBACK');
  }
}

function run(): void {
  const db = openDatabase();
  try {
    const state = getState(db);
    const teams = getTeams(db, state.currentSeason);
    const expectedDivisionOrder = getDivisionOrderForSeason(state.currentSeason);
    const expectedDivisionSlots = getDivisionSlotsForSeason(state.currentSeason);
    const expectedTeamCount = Object.values(expectedDivisionSlots).reduce((sum, count) => sum + count, 0);
    if (teams.length !== expectedTeamCount) {
      fail(`expected ${expectedTeamCount} teams, got ${teams.length}`);
    }

    const table = getLeagueTable(db, state.currentSeason, state.currentGw);
    expectedDivisionOrder.forEach((division) => {
      const rows = table[division] ?? [];
      const expectedDivisionSize = expectedDivisionSlots[division] ?? 0;
      if (rows.length !== expectedDivisionSize) {
        fail(`division "${division}" expected ${expectedDivisionSize} teams, got ${rows.length}`);
      }
    });

    const cup = getCupBracket(db, state.currentSeason, state.currentGw);
    if (cup.length > 0) {
      const byGw = new Map<string, number>();
      cup.forEach((fixture) => {
        byGw.set(fixture.gw, (byGw.get(fixture.gw) ?? 0) + 1);
      });
      const expectedByGw: Array<[string, number]> = [
        ['GW2', 16],
        ['GW3', 8],
        ['GW4', 4],
        ['GW5', 2],
        ['GW6', 1],
      ];
      expectedByGw.forEach(([gw, expected]) => {
        const count = byGw.get(gw) ?? 0;
        if (count !== expected) {
          fail(`cup fixture count mismatch for ${gw}: expected ${expected}, got ${count}`);
        }
      });
      const invalidBye = cup.find((fixture) => fixture.gw === 'GW2' && !fixture.homeTeam && !fixture.awayTeam);
      if (invalidBye) {
        fail('found invalid GW2 BYE vs BYE fixture');
      }
    }

    assertManualPenaltyWinnerSurvivesProgressRefresh(db);
    console.log(`Cup regression checks passed for ${state.currentSeason} ${state.currentGw}.`);
  } finally {
    db.close();
  }
}

run();
