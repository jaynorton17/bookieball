export type CupDisplayFixture = {
  gw?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  winnerTeam?: string | null;
  homeProfit?: number | null;
  awayProfit?: number | null;
  homeSpins?: number | null;
  awaySpins?: number | null;
  played?: boolean | null;
  result?: 'home' | 'away' | 'draw' | 'pending' | null;
  decidedBy?: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending' | null;
};

export function formatSignedProfit(value: number | null | undefined): string {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  const sign = safe > 0 ? '+' : '';
  return `${sign}${safe.toFixed(2)}`;
}

export function cupFixtureTeamsLabel(fixture: CupDisplayFixture): string {
  const allowBye = String(fixture.gw ?? '').toUpperCase() === 'GW2';
  const home = fixture.homeTeam ?? (allowBye && fixture.awayTeam ? 'BYE' : 'TBD');
  const away = fixture.awayTeam ?? (allowBye && fixture.homeTeam ? 'BYE' : 'TBD');
  return `${home} vs ${away}`;
}

export function cupFixtureScoreLabel(fixture: CupDisplayFixture): string {
  if (!fixture.homeTeam || !fixture.awayTeam) {
    return 'Bracket pending';
  }
  if (!Number.isFinite(fixture.homeProfit) || !Number.isFinite(fixture.awayProfit)) {
    return fixture.played ? 'Score unavailable' : 'Tie pending';
  }
  return `${formatSignedProfit(fixture.homeProfit)} vs ${formatSignedProfit(fixture.awayProfit)}`;
}

export function cupFixtureDetailLabel(fixture: CupDisplayFixture): string {
  if (fixture.decidedBy === 'bye') {
    return `${fixture.winnerTeam ?? fixture.homeTeam ?? fixture.awayTeam ?? 'Team'} advanced by BYE`;
  }
  if (fixture.winnerTeam) {
    if (fixture.decidedBy === 'spins') {
      return `Winner: ${fixture.winnerTeam} on spins (${fixture.homeSpins ?? 0}-${fixture.awaySpins ?? 0})`;
    }
    if (fixture.decidedBy === 'penalties') {
      return `Winner: ${fixture.winnerTeam} on penalties`;
    }
    if (fixture.decidedBy === 'tie_break') {
      return `Winner: ${fixture.winnerTeam} on tie-break`;
    }
    return `Winner: ${fixture.winnerTeam}`;
  }
  if (fixture.played) {
    return 'Level on profit and spins, awaiting penalties';
  }
  if (fixture.homeTeam && fixture.awayTeam) {
    return 'Tie pending';
  }
  return 'Awaiting bracket';
}
