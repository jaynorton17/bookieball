type RecoverableCupFixture = {
  gw: string;
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
  homeProfit?: number;
  awayProfit?: number;
  homeSpins?: number;
  awaySpins?: number;
  played?: boolean;
  result?: 'home' | 'away' | 'draw' | 'pending';
  decidedBy?: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
};

type RecoverableEntry = {
  gw: string;
  teamName: string;
  profit: number;
  spins: number | null;
};

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasCompleteCupResult(fixture: RecoverableCupFixture): boolean {
  return numericOrNull(fixture.homeProfit) !== null
    && numericOrNull(fixture.awayProfit) !== null
    && numericOrNull(fixture.homeSpins) !== null
    && numericOrNull(fixture.awaySpins) !== null
    && typeof fixture.played === 'boolean'
    && typeof fixture.result === 'string'
    && typeof fixture.decidedBy === 'string';
}

export function recoverCupFixturesFromEntries<T extends RecoverableCupFixture>(
  fixtures: T[],
  entries: RecoverableEntry[],
  season: string,
): T[] {
  const totals = new Map<string, { profit: number; spins: number; count: number }>();
  entries.forEach((entry) => {
    const key = `${entry.gw}::${entry.teamName}`;
    const row = totals.get(key) ?? { profit: 0, spins: 0, count: 0 };
    row.profit += entry.profit;
    row.spins += entry.spins ?? 0;
    row.count += 1;
    totals.set(key, row);
  });

  const seasonNumber = Number(season.replace(/^S/i, '')) || 0;
  const penaltiesRequired = seasonNumber >= 4;

  return fixtures.map((fixture) => {
    if (hasCompleteCupResult(fixture)) {
      return fixture;
    }

    const homePerf = fixture.homeTeam ? totals.get(`${fixture.gw}::${fixture.homeTeam}`) : null;
    const awayPerf = fixture.awayTeam ? totals.get(`${fixture.gw}::${fixture.awayTeam}`) : null;
    const homeProfit = Number((homePerf?.profit ?? 0).toFixed(2));
    const awayProfit = Number((awayPerf?.profit ?? 0).toFixed(2));
    const homeSpins = homePerf?.spins ?? 0;
    const awaySpins = awayPerf?.spins ?? 0;
    const decidedByBye = fixture.gw === 'GW2' && Boolean((fixture.homeTeam && !fixture.awayTeam) || (!fixture.homeTeam && fixture.awayTeam));
    const hasEntries = (homePerf?.count ?? 0) > 0 || (awayPerf?.count ?? 0) > 0;

    let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
    let decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending' = 'pending';

    if (decidedByBye) {
      result = fixture.homeTeam ? 'home' : 'away';
      decidedBy = 'bye';
    } else if (fixture.homeTeam && fixture.awayTeam && (hasEntries || fixture.winnerTeam)) {
      if (homeProfit > awayProfit) {
        result = 'home';
        decidedBy = 'profit';
      } else if (awayProfit > homeProfit) {
        result = 'away';
        decidedBy = 'profit';
      } else if (homeSpins > awaySpins) {
        result = 'home';
        decidedBy = 'spins';
      } else if (awaySpins > homeSpins) {
        result = 'away';
        decidedBy = 'spins';
      } else if (fixture.winnerTeam === fixture.homeTeam) {
        result = 'home';
        decidedBy = penaltiesRequired ? 'penalties' : 'tie_break';
      } else if (fixture.winnerTeam === fixture.awayTeam) {
        result = 'away';
        decidedBy = penaltiesRequired ? 'penalties' : 'tie_break';
      } else if (hasEntries) {
        result = 'draw';
      }
    }

    return {
      ...fixture,
      homeProfit,
      awayProfit,
      homeSpins,
      awaySpins,
      played: decidedByBye || hasEntries || Boolean(fixture.winnerTeam),
      result,
      decidedBy,
    };
  });
}
