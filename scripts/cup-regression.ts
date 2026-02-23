import { DIVISION_ORDER } from '../src/shared/constants.js';
import { getCupBracket, getLeagueTable, getState, getTeams, openDatabase } from '../src/db/database.js';

function fail(message: string): never {
  throw new Error(`Cup regression failed: ${message}`);
}

const EXPECTED_DIVISION_SIZE = 4;
const EXPECTED_TEAM_COUNT = 20;

function run(): void {
  const db = openDatabase();
  try {
    const state = getState(db);
    const teams = getTeams(db, state.currentSeason);
    if (teams.length !== EXPECTED_TEAM_COUNT) {
      fail(`expected ${EXPECTED_TEAM_COUNT} teams, got ${teams.length}`);
    }

    const table = getLeagueTable(db, state.currentSeason, state.currentGw);
    DIVISION_ORDER.forEach((division) => {
      const rows = table[division] ?? [];
      if (rows.length !== EXPECTED_DIVISION_SIZE) {
        fail(`division "${division}" expected ${EXPECTED_DIVISION_SIZE} teams, got ${rows.length}`);
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

    console.log(`Cup regression checks passed for ${state.currentSeason} ${state.currentGw}.`);
  } finally {
    db.close();
  }
}

run();
