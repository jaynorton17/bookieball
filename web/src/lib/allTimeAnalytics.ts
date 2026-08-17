import { api } from './api';

type HistoricalFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number] & { season: string };
type TeamBase = Awaited<ReturnType<typeof api.teams>>[number];

export type TeamAllTimeAnalytics = {
  teamId: number;
  teamName: string;
  elo: number;
  peakElo: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  winRate: number;
  dominanceIndex: number;
  giantKillerWins: number;
  favouriteOpponent: { teamId: number; teamName: string; wins: number; losses: number; draws: number } | null;
  bogeyOpponent: { teamId: number; teamName: string; wins: number; losses: number; draws: number } | null;
};

export type RivalryAnalytics = {
  teamAId: number;
  teamAName: string;
  teamBId: number;
  teamBName: string;
  meetings: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  closeness: number;
  rivalryScore: number;
};

function expected(a: number, b: number): number { return 1 / (1 + 10 ** ((b - a) / 400)); }
function normalize(value: number, min: number, max: number): number { return max <= min ? 0.5 : (value - min) / (max - min); }

export async function loadAllTimeAnalytics(): Promise<{ teams: TeamAllTimeAnalytics[]; rivalries: RivalryAnalytics[] }> {
  const [state, teams, allTime] = await Promise.all([api.state(), api.teams(), api.allTimeLeagues()]);
  const currentSeason = Math.max(1, Number(state.currentSeason.replace('S', '')) || 1);
  const seasonIds = Array.from({ length: currentSeason }, (_, index) => `S${index + 1}`);
  const history = (await Promise.all(seasonIds.map(async (season) => {
    const fixtures = await api.leagueFixtures(undefined, true, season).catch(() => []);
    return fixtures.map((fixture) => ({ ...fixture, season }));
  }))).flat().filter((fixture) => fixture.played && fixture.result !== 'pending') as HistoricalFixture[];

  const teamByName = new Map<string, TeamBase>(teams.map((team) => [team.name, team]));
  const ratings = new Map<number, number>(teams.map((team) => [team.id, 1500]));
  const peaks = new Map<number, number>(teams.map((team) => [team.id, 1500]));
  const giantKillerWins = new Map<number, number>(teams.map((team) => [team.id, 0]));
  const opponentRecords = new Map<number, Map<number, { wins: number; losses: number; draws: number }>>();

  const sortedHistory = history.slice().sort((a, b) => {
    const seasonA = Number(a.season.replace('S', '')) || 0;
    const seasonB = Number(b.season.replace('S', '')) || 0;
    const gwA = Number(a.gw.replace('GW', '')) || 0;
    const gwB = Number(b.gw.replace('GW', '')) || 0;
    return seasonA - seasonB || gwA - gwB || a.id - b.id;
  });

  const getOpponent = (teamId: number, opponentId: number) => {
    let byOpponent = opponentRecords.get(teamId);
    if (!byOpponent) { byOpponent = new Map(); opponentRecords.set(teamId, byOpponent); }
    let record = byOpponent.get(opponentId);
    if (!record) { record = { wins: 0, losses: 0, draws: 0 }; byOpponent.set(opponentId, record); }
    return record;
  };

  for (const fixture of sortedHistory) {
    const home = teamByName.get(fixture.homeTeam);
    const away = teamByName.get(fixture.awayTeam);
    if (!home || !away) continue;
    const homeRating = ratings.get(home.id) ?? 1500;
    const awayRating = ratings.get(away.id) ?? 1500;

    // A giant-killer win is a win while entering the meeting at least 75 Elo below the opponent.
    if (fixture.result === 'home' && awayRating - homeRating >= 75) giantKillerWins.set(home.id, (giantKillerWins.get(home.id) ?? 0) + 1);
    if (fixture.result === 'away' && homeRating - awayRating >= 75) giantKillerWins.set(away.id, (giantKillerWins.get(away.id) ?? 0) + 1);

    const homeScore = fixture.result === 'home' ? 1 : fixture.result === 'draw' ? 0.5 : 0;
    const awayScore = 1 - homeScore;
    const k = 24;
    const nextHome = homeRating + k * (homeScore - expected(homeRating, awayRating));
    const nextAway = awayRating + k * (awayScore - expected(awayRating, homeRating));
    ratings.set(home.id, nextHome); ratings.set(away.id, nextAway);
    peaks.set(home.id, Math.max(peaks.get(home.id) ?? 1500, nextHome));
    peaks.set(away.id, Math.max(peaks.get(away.id) ?? 1500, nextAway));

    const homeRecord = getOpponent(home.id, away.id);
    const awayRecord = getOpponent(away.id, home.id);
    if (fixture.result === 'home') { homeRecord.wins += 1; awayRecord.losses += 1; }
    else if (fixture.result === 'away') { awayRecord.wins += 1; homeRecord.losses += 1; }
    else { homeRecord.draws += 1; awayRecord.draws += 1; }
  }

  const allTimeById = new Map(allTime.pointsTable.map((row) => [row.teamId, row]));
  const pointValues = allTime.pointsTable.map((row) => row.points);
  const profitValues = allTime.pointsTable.map((row) => row.profit);
  const eloValues = teams.map((team) => ratings.get(team.id) ?? 1500);
  const minPoints = Math.min(...pointValues, 0); const maxPoints = Math.max(...pointValues, 1);
  const minProfit = Math.min(...profitValues, 0); const maxProfit = Math.max(...profitValues, 1);
  const minElo = Math.min(...eloValues, 1500); const maxElo = Math.max(...eloValues, 1501);

  const analytics = teams.map<TeamAllTimeAnalytics>((team) => {
    const row = allTimeById.get(team.id);
    const played = row?.played ?? 0; const wins = row?.wins ?? 0; const draws = row?.draws ?? 0; const losses = row?.losses ?? 0;
    const points = row?.points ?? 0; const profit = row?.profit ?? 0; const elo = ratings.get(team.id) ?? 1500;
    const winRate = played ? wins / played : 0;
    const dominanceIndex = 100 * (normalize(elo, minElo, maxElo) * 0.35 + normalize(points, minPoints, maxPoints) * 0.3 + winRate * 0.2 + normalize(profit, minProfit, maxProfit) * 0.15);
    const records = [...(opponentRecords.get(team.id)?.entries() ?? [])];
    const favourite = records.slice().sort((a, b) => (b[1].wins - b[1].losses) - (a[1].wins - a[1].losses) || b[1].wins - a[1].wins)[0];
    const bogey = records.slice().sort((a, b) => (b[1].losses - b[1].wins) - (a[1].losses - a[1].wins) || b[1].losses - a[1].losses)[0];
    const toOpponent = (entry: typeof favourite) => {
      if (!entry) return null;
      const opponent = teams.find((candidate) => candidate.id === entry[0]);
      return opponent ? { teamId: opponent.id, teamName: opponent.name, ...entry[1] } : null;
    };
    return {
      teamId: team.id, teamName: team.name, elo, peakElo: peaks.get(team.id) ?? elo, played, wins, draws, losses, points, profit, winRate, dominanceIndex,
      giantKillerWins: giantKillerWins.get(team.id) ?? 0,
      favouriteOpponent: toOpponent(favourite), bogeyOpponent: toOpponent(bogey),
    };
  }).sort((a, b) => b.dominanceIndex - a.dominanceIndex);

  const rivalries: RivalryAnalytics[] = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const a = teams[i]; const b = teams[j]; const record = opponentRecords.get(a.id)?.get(b.id);
      if (!record) continue;
      const meetings = record.wins + record.losses + record.draws;
      if (!meetings) continue;
      const winGap = Math.abs(record.wins - record.losses);
      const closeness = Math.max(0, 1 - winGap / meetings);
      rivalries.push({ teamAId: a.id, teamAName: a.name, teamBId: b.id, teamBName: b.name, meetings, teamAWins: record.wins, teamBWins: record.losses, draws: record.draws, closeness, rivalryScore: meetings * (0.6 + 0.4 * closeness) });
    }
  }
  rivalries.sort((a, b) => b.rivalryScore - a.rivalryScore);
  return { teams: analytics, rivalries };
}