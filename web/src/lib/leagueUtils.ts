export type LeagueFixture = {
  id: number;
  gw: string;
  division: string;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

export type LeagueTable = Record<
  string,
  Array<{
    teamId: number;
    teamName: string;
    division: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    profit: number;
    spins: number;
    rank: number;
  }>
>;

export type TeamRating = {
  teamId: number;
  teamName: string;
  entries: number;
  wins: number;
  profit: number;
  avgProfit: number;
  winRate: number;
  rating: number;
};

export type UpsetInfo = {
  level: 'huge' | 'watch';
  favorite: string;
  underdog: string;
  gap: number;
};

export function buildRatingTiers(ratings: TeamRating[]): { top: Set<string>; bottom: Set<string> } {
  const sorted = [...ratings].sort((a, b) => b.rating - a.rating);
  const top = new Set(sorted.slice(0, 5).map((team) => team.teamName));
  const bottom = new Set(sorted.slice(-5).map((team) => team.teamName));
  return { top, bottom };
}

export function classifyUpset(
  homeTeam: string | null,
  awayTeam: string | null,
  ratings: TeamRating[],
): UpsetInfo | null {
  if (!homeTeam || !awayTeam) {
    return null;
  }
  const ratingMap = new Map(ratings.map((rating) => [rating.teamName, rating]));
  const home = ratingMap.get(homeTeam);
  const away = ratingMap.get(awayTeam);
  if (!home || !away) {
    return null;
  }
  const favorite = home.rating >= away.rating ? home : away;
  const underdog = home.rating >= away.rating ? away : home;
  const gap = Number((favorite.rating - underdog.rating).toFixed(2));
  const tiers = buildRatingTiers(ratings);

  if (tiers.top.has(favorite.teamName) && tiers.bottom.has(underdog.teamName)) {
    return { level: 'huge', favorite: favorite.teamName, underdog: underdog.teamName, gap };
  }
  if (gap >= 1.5) {
    return { level: 'huge', favorite: favorite.teamName, underdog: underdog.teamName, gap };
  }
  if (gap >= 0.75) {
    return { level: 'watch', favorite: favorite.teamName, underdog: underdog.teamName, gap };
  }
  return null;
}

export function gwToNumber(gw: string): number {
  const num = Number(gw.replace('GW', ''));
  return Number.isFinite(num) ? num : 99;
}

export function buildTeamResults(fixtures: LeagueFixture[]): Map<string, Array<'W' | 'D' | 'L'>> {
  const ordered = fixtures
    .filter((fixture) => fixture.result !== 'pending')
    .slice()
    .sort((a, b) => gwToNumber(a.gw) - gwToNumber(b.gw) || a.id - b.id);

  const map = new Map<string, Array<'W' | 'D' | 'L'>>();
  const pushResult = (team: string, result: 'W' | 'D' | 'L') => {
    const list = map.get(team) ?? [];
    list.push(result);
    map.set(team, list);
  };

  ordered.forEach((fixture) => {
    if (fixture.result === 'draw') {
      pushResult(fixture.homeTeam, 'D');
      pushResult(fixture.awayTeam, 'D');
    } else if (fixture.result === 'home') {
      pushResult(fixture.homeTeam, 'W');
      pushResult(fixture.awayTeam, 'L');
    } else if (fixture.result === 'away') {
      pushResult(fixture.homeTeam, 'L');
      pushResult(fixture.awayTeam, 'W');
    }
  });

  return map;
}

function longestStreak(results: Array<'W' | 'D' | 'L'>, match: (result: 'W' | 'D' | 'L') => boolean): number {
  let max = 0;
  let current = 0;
  for (const result of results) {
    if (match(result)) {
      current += 1;
      if (current > max) {
        max = current;
      }
    } else {
      current = 0;
    }
  }
  return max;
}

function comebackStreak(results: Array<'W' | 'D' | 'L'>): number {
  let max = 0;
  let i = 0;
  while (i < results.length) {
    if (results[i] === 'L') {
      let lossLen = 0;
      while (i < results.length && results[i] === 'L') {
        lossLen += 1;
        i += 1;
      }
      if (lossLen >= 2) {
        let winLen = 0;
        while (i < results.length && results[i] === 'W') {
          winLen += 1;
          i += 1;
        }
        if (winLen > max) {
          max = winLen;
        }
      }
    } else {
      i += 1;
    }
  }
  return max;
}

export function computeStreakLeaders(fixtures: LeagueFixture[]): {
  hot: { teamName: string; streak: number } | null;
  winless: { teamName: string; streak: number } | null;
  comeback: { teamName: string; streak: number } | null;
} {
  const results = buildTeamResults(fixtures);
  let hot: { teamName: string; streak: number } | null = null;
  let winless: { teamName: string; streak: number } | null = null;
  let comebackLeader: { teamName: string; streak: number } | null = null;

  results.forEach((list, teamName) => {
    const winStreak = longestStreak(list, (r) => r === 'W');
    const winlessStreak = longestStreak(list, (r) => r !== 'W');
    const comebackLen = comebackStreak(list);

    if (!hot || winStreak > hot.streak) {
      hot = { teamName, streak: winStreak };
    }
    if (!winless || winlessStreak > winless.streak) {
      winless = { teamName, streak: winlessStreak };
    }
    if (!comebackLeader || comebackLen > comebackLeader.streak) {
      comebackLeader = { teamName, streak: comebackLen };
    }
  });

  return {
    hot: hot?.streak ? hot : null,
    winless: winless?.streak ? winless : null,
    comeback: comebackLeader?.streak ? comebackLeader : null,
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickRivalryFixtures(fixtures: LeagueFixture[], season: string, gw: string): LeagueFixture[] {
  const byDivision = new Map<string, LeagueFixture[]>();
  fixtures
    .filter((fixture) => fixture.gw === gw)
    .forEach((fixture) => {
      const list = byDivision.get(fixture.division) ?? [];
      list.push(fixture);
      byDivision.set(fixture.division, list);
    });

  const picks: LeagueFixture[] = [];
  byDivision.forEach((list, division) => {
    if (list.length === 0) {
      return;
    }
    const key = `${season}:${gw}:${division}`;
    const idx = hashString(key) % list.length;
    picks.push(list[idx]);
  });
  return picks;
}

export function computeShockOfWeek(
  fixtures: LeagueFixture[],
  table: LeagueTable,
  gw: string,
): { division: string; winner: string; loser: string; rankGap: number; profitMargin: number } | null {
  const rankMap = new Map<string, number>();
  Object.values(table).forEach((rows) => rows.forEach((row) => rankMap.set(row.teamName, row.rank)));

  const currentFixtures = fixtures.filter((fixture) => fixture.gw === gw && fixture.result !== 'pending');
  let best: { division: string; winner: string; loser: string; rankGap: number; profitMargin: number; score: number } | null = null;

  currentFixtures.forEach((fixture) => {
    if (fixture.result === 'draw') {
      return;
    }
    const winner = fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam;
    const loser = fixture.result === 'home' ? fixture.awayTeam : fixture.homeTeam;
    const winnerRank = rankMap.get(winner) ?? 0;
    const loserRank = rankMap.get(loser) ?? 0;
    if (!winnerRank || !loserRank || winnerRank <= loserRank) {
      return;
    }
    const rankGap = winnerRank - loserRank;
    const profitMargin = Number(Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2));
    const score = rankGap * 1000 + profitMargin;
    if (!best || score > best.score) {
      best = { division: fixture.division, winner, loser, rankGap, profitMargin, score };
    }
  });

  if (!best) {
    return null;
  }

  return {
    division: best.division,
    winner: best.winner,
    loser: best.loser,
    rankGap: best.rankGap,
    profitMargin: best.profitMargin,
  };
}

export function computeMomentumIndex(fixtures: LeagueFixture[], windowSize = 3): Map<string, number> {
  const results = buildTeamResults(fixtures);
  const map = new Map<string, number>();
  results.forEach((list, team) => {
    const tail = list.slice(-windowSize);
    const score = tail.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
    map.set(team, score);
  });
  return map;
}

export function computeClutchLeaders(
  fixtures: LeagueFixture[],
  threshold = 5,
): Array<{ teamName: string; wins: number; played: number; winRate: number }> {
  const stats = new Map<string, { wins: number; played: number }>();
  fixtures.forEach((fixture) => {
    if (fixture.result === 'pending') {
      return;
    }
    const margin = Math.abs(fixture.homeProfit - fixture.awayProfit);
    if (margin > threshold) {
      return;
    }
    const home = stats.get(fixture.homeTeam) ?? { wins: 0, played: 0 };
    const away = stats.get(fixture.awayTeam) ?? { wins: 0, played: 0 };
    home.played += 1;
    away.played += 1;
    if (fixture.result === 'home') {
      home.wins += 1;
    } else if (fixture.result === 'away') {
      away.wins += 1;
    }
    stats.set(fixture.homeTeam, home);
    stats.set(fixture.awayTeam, away);
  });

  return Array.from(stats.entries())
    .map(([teamName, data]) => ({
      teamName,
      wins: data.wins,
      played: data.played,
      winRate: data.played > 0 ? Number((data.wins / data.played).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);
}

export function computeSpinEfficiency(
  entries: Array<{ teamName: string; profit: number; spins: number | null }>,
): Array<{ teamName: string; efficiency: number; spins: number }> {
  const totals = new Map<string, { profit: number; spins: number }>();
  entries.forEach((entry) => {
    const item = totals.get(entry.teamName) ?? { profit: 0, spins: 0 };
    item.profit += entry.profit ?? 0;
    item.spins += entry.spins ?? 0;
    totals.set(entry.teamName, item);
  });
  return Array.from(totals.entries())
    .map(([teamName, data]) => ({
      teamName,
      spins: data.spins,
      efficiency: data.spins > 0 ? Number(((data.profit / data.spins) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.efficiency - a.efficiency || b.spins - a.spins);
}

export function computeGiantKillers(
  fixtures: LeagueFixture[],
  ratings: TeamRating[],
): Array<{ teamName: string; upsets: number }> {
  const counts = new Map<string, number>();
  fixtures.forEach((fixture) => {
    if (fixture.result === 'pending') {
      return;
    }
    const upset = classifyUpset(fixture.homeTeam, fixture.awayTeam, ratings);
    if (!upset) {
      return;
    }
    const winner = fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam;
    if (winner === upset.underdog) {
      counts.set(winner, (counts.get(winner) ?? 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([teamName, upsets]) => ({ teamName, upsets }))
    .sort((a, b) => b.upsets - a.upsets);
}

export function computePostGwRecap(
  gw: string,
  fixtures: LeagueFixture[],
  entries: Array<{ teamName: string; profit: number; spins: number | null; gw: string }>,
  ratings: TeamRating[],
): {
  topProfits: Array<{ teamName: string; profit: number }>;
  biggestUpset: { winner: string; loser: string; gap: number } | null;
  closestFinish: { fixture: string; margin: number } | null;
} {
  const gwEntries = entries.filter((entry) => entry.gw === gw);
  const profitTotals = new Map<string, number>();
  gwEntries.forEach((entry) => {
    profitTotals.set(entry.teamName, (profitTotals.get(entry.teamName) ?? 0) + entry.profit);
  });
  const topProfits = Array.from(profitTotals.entries())
    .map(([teamName, profit]) => ({ teamName, profit: Number(profit.toFixed(2)) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  let biggestUpset: { winner: string; loser: string; gap: number } | null = null;
  const gwFixtures = fixtures.filter((fixture) => fixture.gw === gw && fixture.result !== 'pending');
  gwFixtures.forEach((fixture) => {
    const upset = classifyUpset(fixture.homeTeam, fixture.awayTeam, ratings);
    if (!upset) {
      return;
    }
    const winner = fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam;
    const loser = fixture.result === 'home' ? fixture.awayTeam : fixture.homeTeam;
    if (winner !== upset.underdog) {
      return;
    }
    if (!biggestUpset || upset.gap > biggestUpset.gap) {
      biggestUpset = { winner, loser, gap: upset.gap };
    }
  });

  let closestFinish: { fixture: string; margin: number } | null = null;
  gwFixtures.forEach((fixture) => {
    const margin = Math.abs(fixture.homeProfit - fixture.awayProfit);
    if (fixture.result === 'draw') {
      return;
    }
    if (!closestFinish || margin < closestFinish.margin) {
      closestFinish = {
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        margin: Number(margin.toFixed(2)),
      };
    }
  });

  return { topProfits, biggestUpset, closestFinish };
}
