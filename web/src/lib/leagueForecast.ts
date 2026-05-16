import { buildCompetitionStrength, type OddsCurrentRow, type OddsTeamProfile } from './kickoffOdds';

export type LeagueForecastTrend = {
  windowSize: number;
  rankDelta: number;
  pointsDelta: number;
  profitDelta: number;
} | null;

export type LeagueForecastFixture = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
};

export type LeagueForecastRules = {
  titlePositions?: number[];
  topHalfCutoff?: number | null;
  bottomPositions?: number[];
  promotionPositions?: number[];
  playoffPositions?: number[];
  relegationPositions?: number[];
};

export type LeagueForecastRow = {
  teamId: number;
  predictedRank: number | null;
  predictedPlayed: number;
  predictedWins: number;
  predictedDraws: number;
  predictedLosses: number;
  predictedPoints: number;
  predictedProfit: number;
  predictedSpins: number;
  avgFinish: number | null;
  titleProbability: number;
  topHalfProbability: number;
  bottomProbability: number;
  promotionProbability: number;
  playoffProbability: number;
  relegationProbability: number;
  remainingFixtures: number;
  remainingDifficultyAverage: number | null;
  remainingDifficultyRank: number | null;
  remainingDifficultyLabel: string;
  projectedDelta: number | null;
  modelReasonsUp: string[];
  modelReasonsDown: string[];
};

type SimulationStanding = {
  teamId: number;
  teamName: string;
  points: number;
  projectedProfit: number;
  wins: number;
};

type SimulationOutcome = {
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  count: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash ^= value.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return ((state >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function buildForecastStrength(args: {
  profile: OddsTeamProfile;
  row: OddsCurrentRow;
  teamCount: number;
  trend: LeagueForecastTrend;
}): number {
  const { profile, row, teamCount, trend } = args;
  const base = buildCompetitionStrength(profile, row, teamCount);
  const played = Math.max(1, row.played);
  const pointsPerGame = row.points / played;
  const spinsPerGame = row.spins / played;
  const profitPerGame = row.profit / played;
  const stabilityRate = (row.wins + row.draws) / played;
  const recentHistory = profile.history
    .slice()
    .sort((left, right) => {
      const leftSeason = Number(left.season.replace(/[^0-9]/g, '')) || 0;
      const rightSeason = Number(right.season.replace(/[^0-9]/g, '')) || 0;
      return rightSeason - leftSeason;
    })
    .slice(0, 4);
  const historicalProfitPerGame = recentHistory.length > 0
    ? recentHistory.reduce((sum, season) => sum + (season.profit / Math.max(1, season.played || 7)), 0) / recentHistory.length
    : 0;
  const consistencyBonus = clamp((spinsPerGame - 1.7) * 2.8, -3.5, 6.5);
  const stabilityBonus = clamp((stabilityRate - 0.48) * 10, -4, 6.5);
  const liveProfitBonus = clamp(profitPerGame * 12, -8, 10);
  const livePointsBonus = clamp((pointsPerGame - 1.2) * 9, -5, 7);
  const archiveProfitBonus = clamp(historicalProfitPerGame * 7.5, -4.5, 5.5);
  const persistentLowProfitPenalty = recentHistory.length >= 2 && recentHistory.every((season) => season.profit <= 0)
    ? -4.5
    : 0;
  const dormantPenalty = profitPerGame <= 0 && pointsPerGame <= 1 && spinsPerGame <= 1.6
    ? -5.5
    : 0;
  if (!trend) {
    return base + consistencyBonus + stabilityBonus + liveProfitBonus + livePointsBonus + archiveProfitBonus + persistentLowProfitPenalty + dormantPenalty;
  }

  const trendWindow = Math.max(1, trend.windowSize);
  const trendBonus = clamp(
    (trend.rankDelta * 2.4)
      + ((trend.pointsDelta / trendWindow) * 8.2)
      + clamp((trend.profitDelta / trendWindow) * 3.2, -4.5, 7),
    -8,
    13,
  );
  const momentumBonus = trend.rankDelta > 0 && trend.pointsDelta > 0 && trend.profitDelta >= 0
    ? 4
    : trend.rankDelta < 0 && trend.pointsDelta <= 0 && trend.profitDelta < 0
      ? -3.5
      : 0;

  return (
    base
    + consistencyBonus
    + stabilityBonus
    + liveProfitBonus
    + livePointsBonus
    + archiveProfitBonus
    + persistentLowProfitPenalty
    + dormantPenalty
    + trendBonus
    + momentumBonus
  );
}

function projectProfit(args: {
  row: OddsCurrentRow;
  remainingFixtures: number;
  strength: number;
  averageStrength: number;
  trend: LeagueForecastTrend;
}): number {
  const { row, remainingFixtures, strength, averageStrength, trend } = args;
  const played = Math.max(1, row.played);
  const spinsPerGame = row.spins / played;
  const profitPerGame = row.profit / played;
  const trendProfitRate = trend ? trend.profitDelta / Math.max(1, trend.windowSize) : 0;
  const strengthEdge = (strength - averageStrength) / 24;
  const projectedGain = remainingFixtures * (
    (profitPerGame * 0.72)
    + (trendProfitRate * 0.58)
    + (strengthEdge * 0.65)
    + clamp((spinsPerGame - 1.8) * 0.22, -0.35, 0.55)
  );
  return Number((row.profit + projectedGain).toFixed(2));
}

function projectSpins(args: {
  row: OddsCurrentRow;
  remainingFixtures: number;
  strength: number;
  averageStrength: number;
  trend: LeagueForecastTrend;
}): number {
  const { row, remainingFixtures, strength, averageStrength, trend } = args;
  const played = Math.max(1, row.played);
  const spinsPerGame = row.spins / played;
  const trendLift = trend ? clamp(trend.pointsDelta * 0.08, -0.25, 0.4) : 0;
  const strengthEdge = clamp((strength - averageStrength) / 42, -0.35, 0.45);
  const projectedGain = remainingFixtures * Math.max(0.8, spinsPerGame + trendLift + strengthEdge);
  return Math.max(row.spins, Math.round(row.spins + projectedGain));
}

function compareStandings(left: SimulationStanding, right: SimulationStanding): number {
  if (right.points !== left.points) {
    return right.points - left.points;
  }
  if (right.projectedProfit !== left.projectedProfit) {
    return right.projectedProfit - left.projectedProfit;
  }
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return left.teamName.localeCompare(right.teamName, undefined, { sensitivity: 'base' });
}

function buildForecastFixtureModel(args: {
  homeTeamId: number;
  awayTeamId: number;
  strengths: Map<number, number>;
  currentRowsByTeamId: Map<number, OddsCurrentRow>;
  trendsByTeamId: Map<number, LeagueForecastTrend>;
}): { homeProbability: number; drawProbability: number; awayProbability: number } {
  const { homeTeamId, awayTeamId, strengths, currentRowsByTeamId, trendsByTeamId } = args;
  const homeRow = currentRowsByTeamId.get(homeTeamId) ?? null;
  const awayRow = currentRowsByTeamId.get(awayTeamId) ?? null;
  const homeTrend = trendsByTeamId.get(homeTeamId) ?? null;
  const awayTrend = trendsByTeamId.get(awayTeamId) ?? null;
  const homeStrength = strengths.get(homeTeamId) ?? 50;
  const awayStrength = strengths.get(awayTeamId) ?? 50;
  const homePpg = homeRow ? homeRow.points / Math.max(1, homeRow.played) : 1;
  const awayPpg = awayRow ? awayRow.points / Math.max(1, awayRow.played) : 1;
  const homeProfitRate = homeRow ? homeRow.profit / Math.max(1, homeRow.played) : 0;
  const awayProfitRate = awayRow ? awayRow.profit / Math.max(1, awayRow.played) : 0;
  const homeSpinsRate = homeRow ? homeRow.spins / Math.max(1, homeRow.played) : 1.5;
  const awaySpinsRate = awayRow ? awayRow.spins / Math.max(1, awayRow.played) : 1.5;
  const trendEdge = (
    ((homeTrend?.rankDelta ?? 0) - (awayTrend?.rankDelta ?? 0)) * 0.95
    + (((homeTrend?.pointsDelta ?? 0) - (awayTrend?.pointsDelta ?? 0)) * 0.65)
    + clamp(((homeTrend?.profitDelta ?? 0) - (awayTrend?.profitDelta ?? 0)) * 0.3, -2.4, 2.4)
  );
  const diff = (
    (homeStrength + 2.1)
    - awayStrength
    + ((homePpg - awayPpg) * 3.2)
    + ((homeProfitRate - awayProfitRate) * 4.5)
    + ((homeSpinsRate - awaySpinsRate) * 0.9)
    + trendEdge
  );
  const drawProbability = clamp(0.25 - Math.min(0.1, Math.abs(diff) / 170), 0.14, 0.3);
  const winPool = 1 - drawProbability;
  const homeShare = 1 / (1 + Math.exp(-(diff / 8.5)));
  const homeProbability = clamp(winPool * homeShare, 0.08, 0.8);
  const awayProbability = clamp(winPool - homeProbability, 0.08, 0.8);
  const total = homeProbability + drawProbability + awayProbability;
  return {
    homeProbability: homeProbability / total,
    drawProbability: drawProbability / total,
    awayProbability: awayProbability / total,
  };
}

function probabilityForPositions(counts: number[], positions: number[], simulationCount: number): number {
  const total = positions.reduce((sum, position) => sum + (counts[position - 1] ?? 0), 0);
  return Number(((total / Math.max(1, simulationCount)) * 100).toFixed(1));
}

function buildDifficultyLabel(args: {
  remainingFixtures: number;
  difficultyRank: number | null;
  teamCount: number;
}): string {
  const { remainingFixtures, difficultyRank, teamCount } = args;
  if (remainingFixtures <= 0) {
    return 'Run-in complete';
  }
  if (difficultyRank === null) {
    return 'Run-in forming';
  }
  const softBand = Math.max(1, Math.ceil(teamCount / 3));
  const hardBand = Math.max(1, teamCount - softBand + 1);
  if (difficultyRank <= softBand) {
    return 'Softer run-in';
  }
  if (difficultyRank >= hardBand) {
    return 'Harder run-in';
  }
  return 'Balanced run-in';
}

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons)).slice(0, 3);
}

function buildModelReasons(args: {
  row: OddsCurrentRow;
  trend: LeagueForecastTrend;
  remainingFixtures: number;
  remainingDifficultyLabel: string;
  projectedDelta: number | null;
}): {
  up: string[];
  down: string[];
} {
  const { row, trend, remainingFixtures, remainingDifficultyLabel, projectedDelta } = args;
  const played = Math.max(1, row.played);
  const pointsPerGame = row.points / played;
  const profitPerGame = row.profit / played;
  const spinsPerGame = row.spins / played;
  const stabilityRate = (row.wins + row.draws) / played;

  const up: string[] = [];
  const down: string[] = [];

  if (projectedDelta !== null && projectedDelta >= 2) {
    up.push('strong projected climb');
  } else if (projectedDelta !== null && projectedDelta <= -2) {
    down.push('model expects a slide');
  }

  if (trend) {
    if (trend.rankDelta >= 1 || trend.pointsDelta >= 2) {
      up.push('recent climb');
    }
    if (trend.profitDelta > 0) {
      up.push('profit trend is up');
    }
    if (trend.rankDelta <= -1 || trend.pointsDelta <= 0) {
      down.push('recent form has cooled');
    }
    if (trend.profitDelta < 0) {
      down.push('profit pace is fading');
    }
  }

  if (pointsPerGame >= 1.7) {
    up.push('strong points pace');
  } else if (pointsPerGame <= 0.9) {
    down.push('low points return');
  }

  if (profitPerGame >= 0.45) {
    up.push('healthy profit pace');
  } else if (profitPerGame < 0) {
    down.push('poor profit pace');
  }

  if (spinsPerGame >= 2.4) {
    up.push('active spins every week');
  } else if (spinsPerGame <= 1.2) {
    down.push('low weekly spin floor');
  }

  if (stabilityRate >= 0.55) {
    up.push('steady week-to-week returns');
  } else if (stabilityRate <= 0.3) {
    down.push('too many losing weeks');
  }

  if (remainingFixtures > 0) {
    if (remainingDifficultyLabel === 'Softer run-in') {
      up.push('softer run-in');
    } else if (remainingDifficultyLabel === 'Harder run-in') {
      down.push('hardest remaining schedule');
    }
  }

  return {
    up: uniqueReasons(up),
    down: uniqueReasons(down),
  };
}

export function buildLeagueForecastTable(args: {
  rows: OddsCurrentRow[];
  profilesByTeamId: Map<number, OddsTeamProfile>;
  trendsByTeamId?: Map<number, LeagueForecastTrend>;
  remainingFixtures: LeagueForecastFixture[];
  simulationCount?: number;
  seedKey?: string;
  rules?: LeagueForecastRules;
}): Map<number, LeagueForecastRow> {
  const {
    rows,
    profilesByTeamId,
    trendsByTeamId = new Map<number, LeagueForecastTrend>(),
    remainingFixtures,
    simulationCount = 600,
    seedKey = 'bookieball-forecast',
    rules = {},
  } = args;

  if (rows.length === 0) {
    return new Map<number, LeagueForecastRow>();
  }

  const currentRowsByTeamId = new Map(rows.map((row) => [row.teamId, row]));
  const strengths = new Map<number, number>();
  rows.forEach((row) => {
    const profile = profilesByTeamId.get(row.teamId);
    if (!profile) {
      strengths.set(row.teamId, 50);
      return;
    }
    strengths.set(row.teamId, buildForecastStrength({
      profile,
      row,
      teamCount: rows.length,
      trend: trendsByTeamId.get(row.teamId) ?? null,
    }));
  });

  const averageStrength = Array.from(strengths.values()).reduce((sum, value) => sum + value, 0) / Math.max(1, strengths.size);
  const remainingFixtureCounts = new Map<number, number>();
  const remainingOpponentStrengthTotals = new Map<number, number>();
  remainingFixtures.forEach((fixture) => {
    remainingFixtureCounts.set(fixture.homeTeamId, (remainingFixtureCounts.get(fixture.homeTeamId) ?? 0) + 1);
    remainingFixtureCounts.set(fixture.awayTeamId, (remainingFixtureCounts.get(fixture.awayTeamId) ?? 0) + 1);
    remainingOpponentStrengthTotals.set(
      fixture.homeTeamId,
      (remainingOpponentStrengthTotals.get(fixture.homeTeamId) ?? 0) + (strengths.get(fixture.awayTeamId) ?? averageStrength),
    );
    remainingOpponentStrengthTotals.set(
      fixture.awayTeamId,
      (remainingOpponentStrengthTotals.get(fixture.awayTeamId) ?? 0) + (strengths.get(fixture.homeTeamId) ?? averageStrength),
    );
  });

  const remainingDifficultyAverageByTeamId = new Map<number, number | null>();
  rows.forEach((row) => {
    const remainingCount = remainingFixtureCounts.get(row.teamId) ?? 0;
    if (remainingCount <= 0) {
      remainingDifficultyAverageByTeamId.set(row.teamId, null);
      return;
    }
    remainingDifficultyAverageByTeamId.set(
      row.teamId,
      (remainingOpponentStrengthTotals.get(row.teamId) ?? 0) / remainingCount,
    );
  });

  const difficultyRankByTeamId = new Map<number, number>();
  rows
    .map((row) => ({
      teamId: row.teamId,
      average: remainingDifficultyAverageByTeamId.get(row.teamId) ?? averageStrength,
    }))
    .sort((left, right) => left.average - right.average)
    .forEach((entry, index) => {
      difficultyRankByTeamId.set(entry.teamId, index + 1);
    });

  const projectedProfitByTeamId = new Map<number, number>();
  const projectedSpinsByTeamId = new Map<number, number>();
  rows.forEach((row) => {
    projectedProfitByTeamId.set(
      row.teamId,
      projectProfit({
        row,
        remainingFixtures: remainingFixtureCounts.get(row.teamId) ?? 0,
        strength: strengths.get(row.teamId) ?? 50,
        averageStrength,
        trend: trendsByTeamId.get(row.teamId) ?? null,
      }),
    );
    projectedSpinsByTeamId.set(
      row.teamId,
      projectSpins({
        row,
        remainingFixtures: remainingFixtureCounts.get(row.teamId) ?? 0,
        strength: strengths.get(row.teamId) ?? 50,
        averageStrength,
        trend: trendsByTeamId.get(row.teamId) ?? null,
      }),
    );
  });

  const fixtureModels = remainingFixtures
    .map((fixture) => {
      const homeRow = currentRowsByTeamId.get(fixture.homeTeamId) ?? null;
      const awayRow = currentRowsByTeamId.get(fixture.awayTeamId) ?? null;
      if (!homeRow || !awayRow) {
        return null;
      }
      return {
        fixture,
        odds: buildForecastFixtureModel({
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          strengths,
          currentRowsByTeamId,
          trendsByTeamId,
        }),
      };
    })
    .filter((fixture): fixture is NonNullable<typeof fixture> => fixture !== null);

  const finishSums = new Map<number, number>();
  const finalPointsSums = new Map<number, number>();
  const finishCounts = new Map<number, number[]>();
  const outcomeCounts = new Map<number, Map<string, SimulationOutcome>>();
  const topHalfCutoff = Math.max(1, Math.min(rows.length, rules.topHalfCutoff ?? Math.ceil(rows.length / 2)));
  const titlePositions = rules.titlePositions && rules.titlePositions.length > 0 ? rules.titlePositions : [1];
  const bottomPositions = rules.bottomPositions && rules.bottomPositions.length > 0 ? rules.bottomPositions : [rows.length];
  const promotionPositions = rules.promotionPositions ?? [];
  const playoffPositions = rules.playoffPositions ?? [];
  const relegationPositions = rules.relegationPositions ?? [];
  rows.forEach((row) => {
    finishSums.set(row.teamId, 0);
    finalPointsSums.set(row.teamId, 0);
    finishCounts.set(row.teamId, Array.from({ length: rows.length }, () => 0));
    outcomeCounts.set(row.teamId, new Map<string, SimulationOutcome>());
  });

  for (let simulation = 0; simulation < simulationCount; simulation += 1) {
    const random = buildSeededRandom(hashSeed(`${seedKey}:${simulation}`));
    const pointsByTeamId = new Map(rows.map((row) => [row.teamId, row.points]));
    const winsByTeamId = new Map(rows.map((row) => [row.teamId, row.wins]));
    const drawsByTeamId = new Map(rows.map((row) => [row.teamId, row.draws]));
    const lossesByTeamId = new Map(rows.map((row) => [row.teamId, row.losses]));

    fixtureModels.forEach(({ fixture, odds }) => {
      const roll = random();
      if (roll < odds.homeProbability) {
        pointsByTeamId.set(fixture.homeTeamId, (pointsByTeamId.get(fixture.homeTeamId) ?? 0) + 3);
        winsByTeamId.set(fixture.homeTeamId, (winsByTeamId.get(fixture.homeTeamId) ?? 0) + 1);
        lossesByTeamId.set(fixture.awayTeamId, (lossesByTeamId.get(fixture.awayTeamId) ?? 0) + 1);
        return;
      }
      if (roll < odds.homeProbability + odds.drawProbability) {
        pointsByTeamId.set(fixture.homeTeamId, (pointsByTeamId.get(fixture.homeTeamId) ?? 0) + 1);
        pointsByTeamId.set(fixture.awayTeamId, (pointsByTeamId.get(fixture.awayTeamId) ?? 0) + 1);
        drawsByTeamId.set(fixture.homeTeamId, (drawsByTeamId.get(fixture.homeTeamId) ?? 0) + 1);
        drawsByTeamId.set(fixture.awayTeamId, (drawsByTeamId.get(fixture.awayTeamId) ?? 0) + 1);
        return;
      }
      pointsByTeamId.set(fixture.awayTeamId, (pointsByTeamId.get(fixture.awayTeamId) ?? 0) + 3);
      winsByTeamId.set(fixture.awayTeamId, (winsByTeamId.get(fixture.awayTeamId) ?? 0) + 1);
      lossesByTeamId.set(fixture.homeTeamId, (lossesByTeamId.get(fixture.homeTeamId) ?? 0) + 1);
    });

    const standings = rows
      .map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        points: pointsByTeamId.get(row.teamId) ?? row.points,
        projectedProfit: projectedProfitByTeamId.get(row.teamId) ?? row.profit,
        wins: winsByTeamId.get(row.teamId) ?? row.wins,
      }))
      .sort(compareStandings);

    standings.forEach((standing, index) => {
      finishSums.set(standing.teamId, (finishSums.get(standing.teamId) ?? 0) + index + 1);
      finalPointsSums.set(standing.teamId, (finalPointsSums.get(standing.teamId) ?? 0) + standing.points);
      const counts = finishCounts.get(standing.teamId);
      if (counts) {
        counts[index] += 1;
      }
      const played = (currentRowsByTeamId.get(standing.teamId)?.played ?? 0) + (remainingFixtureCounts.get(standing.teamId) ?? 0);
      const wins = winsByTeamId.get(standing.teamId) ?? 0;
      const draws = drawsByTeamId.get(standing.teamId) ?? 0;
      const losses = lossesByTeamId.get(standing.teamId) ?? 0;
      const outcomeKey = `${index + 1}|${standing.points}|${wins}|${draws}|${losses}`;
      const teamOutcomes = outcomeCounts.get(standing.teamId);
      if (teamOutcomes) {
        const existing = teamOutcomes.get(outcomeKey);
        if (existing) {
          existing.count += 1;
        } else {
          teamOutcomes.set(outcomeKey, {
            rank: index + 1,
            played,
            wins,
            draws,
            losses,
            points: standing.points,
            count: 1,
          });
        }
      }
    });
  }

  return new Map(rows.map((row) => {
    const counts = finishCounts.get(row.teamId) ?? [];
    let bestIndex = row.rank > 0 ? row.rank - 1 : 0;
    let bestCount = counts[bestIndex] ?? -1;
    counts.forEach((count, index) => {
      if (count > bestCount) {
        bestCount = count;
        bestIndex = index;
      }
    });

    const avgFinishRaw = (finishSums.get(row.teamId) ?? 0) / Math.max(1, simulationCount);
    const avgPointsRaw = (finalPointsSums.get(row.teamId) ?? row.points * simulationCount) / Math.max(1, simulationCount);
    const representativeOutcome = Array.from(outcomeCounts.get(row.teamId)?.values() ?? [])
      .filter((outcome) => outcome.rank === bestIndex + 1)
      .sort((left, right) => (
        right.count - left.count
        || Math.abs(left.points - avgPointsRaw) - Math.abs(right.points - avgPointsRaw)
        || right.points - left.points
      ))[0]
      ?? Array.from(outcomeCounts.get(row.teamId)?.values() ?? [])
        .sort((left, right) => (
          right.count - left.count
          || Math.abs(left.points - avgPointsRaw) - Math.abs(right.points - avgPointsRaw)
          || right.points - left.points
        ))[0]
      ?? {
        rank: bestIndex + 1,
        played: row.played + (remainingFixtureCounts.get(row.teamId) ?? 0),
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        points: Math.round(avgPointsRaw),
        count: 0,
      };
    const predictedPlayed = representativeOutcome.played;
    const predictedWins = representativeOutcome.wins;
    const predictedDraws = representativeOutcome.draws;
    const predictedLosses = representativeOutcome.losses;
    const predictedPoints = representativeOutcome.points;
    const predictedProfit = projectedProfitByTeamId.get(row.teamId) ?? row.profit;
    const predictedSpins = projectedSpinsByTeamId.get(row.teamId) ?? row.spins;
    const firstPlaceCount = counts[0] ?? 0;
    const bottomCount = counts[counts.length - 1] ?? 0;
    const remainingFixturesForTeam = remainingFixtureCounts.get(row.teamId) ?? 0;
    const remainingDifficultyAverage = remainingDifficultyAverageByTeamId.get(row.teamId) ?? null;
    const remainingDifficultyRank = difficultyRankByTeamId.get(row.teamId) ?? null;
    const projectedDelta = row.rank - (bestIndex + 1);
    const remainingDifficultyLabel = buildDifficultyLabel({
      remainingFixtures: remainingFixturesForTeam,
      difficultyRank: remainingDifficultyRank,
      teamCount: rows.length,
    });
    const reasons = buildModelReasons({
      row,
      trend: trendsByTeamId.get(row.teamId) ?? null,
      remainingFixtures: remainingFixturesForTeam,
      remainingDifficultyLabel,
      projectedDelta,
    });

    return [
      row.teamId,
      {
        teamId: row.teamId,
        predictedRank: bestIndex + 1,
        predictedPlayed,
        predictedWins,
        predictedDraws,
        predictedLosses,
        predictedPoints,
        predictedProfit: Number(predictedProfit.toFixed(2)),
        predictedSpins,
        avgFinish: Number.isFinite(avgFinishRaw) ? Number(avgFinishRaw.toFixed(2)) : null,
        titleProbability: Number(((firstPlaceCount / Math.max(1, simulationCount)) * 100).toFixed(1)),
        topHalfProbability: probabilityForPositions(
          counts,
          Array.from({ length: topHalfCutoff }, (_, index) => index + 1),
          simulationCount,
        ),
        bottomProbability: Number(((bottomCount / Math.max(1, simulationCount)) * 100).toFixed(1)),
        promotionProbability: probabilityForPositions(counts, promotionPositions, simulationCount),
        playoffProbability: probabilityForPositions(counts, playoffPositions, simulationCount),
        relegationProbability: probabilityForPositions(counts, relegationPositions, simulationCount),
        remainingFixtures: remainingFixturesForTeam,
        remainingDifficultyAverage: remainingDifficultyAverage === null ? null : Number(remainingDifficultyAverage.toFixed(1)),
        remainingDifficultyRank,
        remainingDifficultyLabel,
        projectedDelta,
        modelReasonsUp: reasons.up,
        modelReasonsDown: reasons.down,
      },
    ] satisfies [number, LeagueForecastRow];
  }));
}
