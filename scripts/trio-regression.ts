import {
  TRIO_DIVISION_ORDER,
  TRIO_DIVISION_SIZE,
  TRIO_REGULAR_SEASON_GAMEWEEKS,
  isSeasonFiveOrLater,
} from '../src/shared/constants.js';
import {
  getState,
  getTeams,
  getTrioLeagueFixtures,
  getTrioLeagueTable,
  initDatabase,
  loadTrioLeagueFixturesForRange,
  openDatabase,
} from '../src/db/database.js';

function fail(message: string): never {
  throw new Error(`Trio regression failed: ${message}`);
}

function pairKey(left: number, right: number): string {
  return left < right ? `${left}-${right}` : `${right}-${left}`;
}

function run(): void {
  initDatabase();
  const db = openDatabase();
  try {
    const state = getState(db);
    if (!isSeasonFiveOrLater(state.currentSeason)) {
      console.log(`Trio regression skipped for ${state.currentSeason}: trio league starts in S5.`);
      return;
    }

    const expectedTeamCount = TRIO_DIVISION_ORDER.length * TRIO_DIVISION_SIZE;
    const teams = getTeams(db, state.currentSeason);
    if (teams.length !== expectedTeamCount) {
      fail(`expected ${expectedTeamCount} teams, got ${teams.length}`);
    }

    loadTrioLeagueFixturesForRange(db, state.currentSeason, 'GW1', 'GW6');
    const fixtures = getTrioLeagueFixtures(db, state.currentSeason);
    const regularFixtures = fixtures.filter((fixture) => fixture.stage === 'regular');
    const semiFixtures = fixtures.filter((fixture) => fixture.stage === 'playoff_semi');
    const finalFixtures = fixtures.filter((fixture) => fixture.stage === 'playoff_final');

    const expectedRegularPerGw = (TRIO_DIVISION_ORDER.length * TRIO_DIVISION_SIZE) / 2;
    for (let gwIndex = 1; gwIndex <= TRIO_REGULAR_SEASON_GAMEWEEKS; gwIndex += 1) {
      const gw = `GW${gwIndex}`;
      const count = regularFixtures.filter((fixture) => fixture.gw === gw).length;
      if (count !== expectedRegularPerGw) {
        fail(`expected ${expectedRegularPerGw} regular fixtures in ${gw}, got ${count}`);
      }
    }

    if (regularFixtures.some((fixture) => !TRIO_DIVISION_ORDER.includes(fixture.division))) {
      fail('found regular trio fixture in an unexpected division');
    }
    if (regularFixtures.some((fixture) => Number(fixture.gw.replace('GW', '')) > TRIO_REGULAR_SEASON_GAMEWEEKS)) {
      fail('found trio regular-season fixture after GW6');
    }

    const regularPairsByDivision = new Map<string, Set<string>>();
    const regularAppearances = new Map<number, number>();
    regularFixtures.forEach((fixture) => {
      if (fixture.homeTeamId === fixture.awayTeamId) {
        fail(`fixture ${fixture.id} has the same team on both sides`);
      }
      const divisionPairs = regularPairsByDivision.get(fixture.division) ?? new Set<string>();
      const key = pairKey(fixture.homeTeamId, fixture.awayTeamId);
      if (divisionPairs.has(key)) {
        fail(`duplicate regular-season pairing in ${fixture.division}: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
      }
      divisionPairs.add(key);
      regularPairsByDivision.set(fixture.division, divisionPairs);
      regularAppearances.set(fixture.homeTeamId, (regularAppearances.get(fixture.homeTeamId) ?? 0) + 1);
      regularAppearances.set(fixture.awayTeamId, (regularAppearances.get(fixture.awayTeamId) ?? 0) + 1);
    });

    const gw6Table = getTrioLeagueTable(db, state.currentSeason, 'GW6');
    TRIO_DIVISION_ORDER.forEach((division) => {
      const rows = gw6Table.filter((row) => row.division === division);
      if (rows.length !== TRIO_DIVISION_SIZE) {
        fail(`${division} expected ${TRIO_DIVISION_SIZE} table rows at GW6, got ${rows.length}`);
      }
      rows.forEach((row) => {
        const appearances = regularAppearances.get(row.teamId) ?? 0;
        if (appearances !== TRIO_REGULAR_SEASON_GAMEWEEKS) {
          fail(`${row.teamName} expected ${TRIO_REGULAR_SEASON_GAMEWEEKS} trio regular fixtures, got ${appearances}`);
        }
      });
    });

    if (semiFixtures.some((fixture) => fixture.division === TRIO_DIVISION_ORDER[0])) {
      fail('Premier League should not have trio playoff semi-finals');
    }
    if (finalFixtures.some((fixture) => fixture.division === TRIO_DIVISION_ORDER[0])) {
      fail('Premier League should not have trio playoff finals');
    }

    if (semiFixtures.length > 0) {
      if (semiFixtures.length !== 4) {
        fail(`expected 4 trio playoff semi-finals once generated, got ${semiFixtures.length}`);
      }
      if (semiFixtures.some((fixture) => fixture.gw !== 'GW7')) {
        fail('all trio playoff semi-finals must be scheduled in GW7');
      }
      const playoffDivisions = TRIO_DIVISION_ORDER.slice(1);
      playoffDivisions.forEach((division) => {
        const rows = gw6Table
          .filter((row) => row.division === division)
          .slice()
          .sort((left, right) => left.rank - right.rank);
        const expectedPairs = new Set<string>([
          pairKey(rows[1].teamId, rows[4].teamId),
          pairKey(rows[2].teamId, rows[3].teamId),
        ]);
        const actualPairs = new Set<string>(
          semiFixtures
            .filter((fixture) => fixture.division === division)
            .map((fixture) => pairKey(fixture.homeTeamId, fixture.awayTeamId)),
        );
        if (actualPairs.size !== 2) {
          fail(`${division} expected 2 trio playoff semi-finals, got ${actualPairs.size}`);
        }
        expectedPairs.forEach((key) => {
          if (!actualPairs.has(key)) {
            fail(`${division} playoff semi-final bracket does not match 2v5 and 3v4`);
          }
        });
      });
    }

    if (finalFixtures.length > 0) {
      if (finalFixtures.length > 2) {
        fail(`expected at most 2 trio playoff finals, got ${finalFixtures.length}`);
      }
      if (finalFixtures.some((fixture) => fixture.gw !== 'GW8')) {
        fail('all trio playoff finals must be scheduled in GW8');
      }
      if (finalFixtures.some((fixture) => !TRIO_DIVISION_ORDER.slice(1).includes(fixture.division))) {
        fail('trio playoff finals should only exist in Ligue 1 and Bundesliga');
      }
    }

    console.log(`Trio regression checks passed for ${state.currentSeason} ${state.currentGw}.`);
  } finally {
    db.close();
  }
}

run();
