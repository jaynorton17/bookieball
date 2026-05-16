export type OddsHistoryRow = {
  season: string;
  division: string;
  rank: number;
  points: number;
  profit: number;
  played: number;
  cupFinish: string;
};

export type OddsCurrentRow = {
  teamId: number;
  teamName: string;
  rank: number;
  played: number;
  points: number;
  profit: number;
  spins: number;
  wins: number;
  draws: number;
  losses: number;
};

export type OddsTeamProfile = {
  teamId: number;
  teamName: string;
  preseasonFavorite?: boolean;
  history: OddsHistoryRow[];
};

export type FixtureOddsModel = {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  reason: string;
};

export type OutrightOddsRow = {
  teamId: number;
  teamName: string;
  probability: number;
  odds: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function seasonNumber(season: string): number {
  const match = season.match(/(\d+)/);
  return match?.[1] ? Number(match[1]) : 0;
}

function divisionTier(division: string): number {
  const normalized = division.trim().toLowerCase();
  if (/champion/.test(normalized)) {
    return 1;
  }
  if (/premier(?! league)/.test(normalized)) {
    return 2;
  }
  if (/division\s*1|average|ligue\s*1/.test(normalized)) {
    return 3;
  }
  if (/division\s*2|struggling|bundesliga/.test(normalized)) {
    return 4;
  }
  if (/division\s*3|awful/.test(normalized)) {
    return 5;
  }
  if (/division\s*4/.test(normalized)) {
    return 6;
  }
  if (/premier league/.test(normalized)) {
    return 2;
  }
  return 4;
}

function cupPedigree(history: OddsHistoryRow[]): number {
  return history.reduce((score, row) => {
    if (/winner|champion/i.test(row.cupFinish)) {
      return score + 3;
    }
    if (/runner/i.test(row.cupFinish)) {
      return score + 2;
    }
    if (/semi/i.test(row.cupFinish)) {
      return score + 1;
    }
    return score;
  }, 0);
}

export function buildArchiveStrength(profile: OddsTeamProfile): number {
  const orderedHistory = profile.history
    .slice()
    .sort((left, right) => seasonNumber(right.season) - seasonNumber(left.season))
    .slice(0, 4);
  if (orderedHistory.length === 0) {
    return profile.preseasonFavorite ? 58 : 50;
  }

  let totalWeight = 0;
  let weightedScore = 0;
  orderedHistory.forEach((row, index) => {
    const weight = 1.4 - (index * 0.22);
    const tierScore = Math.max(0, 8 - divisionTier(row.division)) * 4.2;
    const finishScore = Math.max(0, 9 - safeNumber(row.rank)) * 3.1;
    const ppg = safeNumber(row.played) > 0 ? safeNumber(row.points) / safeNumber(row.played) : safeNumber(row.points) / 7;
    const profitPerGame = safeNumber(row.played) > 0 ? safeNumber(row.profit) / safeNumber(row.played) : safeNumber(row.profit) / 7;
    const titleBonus = row.rank === 1 ? 8 : row.rank === 2 ? 3 : 0;
    const rowScore = tierScore + finishScore + (ppg * 9) + clamp(profitPerGame * 6, -6, 12) + titleBonus;
    weightedScore += rowScore * weight;
    totalWeight += weight;
  });

  const base = totalWeight > 0 ? weightedScore / totalWeight : 50;
  return base + (profile.preseasonFavorite ? 4 : 0) + cupPedigree(orderedHistory);
}

export function buildCompetitionStrength(
  profile: OddsTeamProfile,
  currentRow: OddsCurrentRow | null | undefined,
  teamCount: number,
): number {
  const archive = buildArchiveStrength(profile);
  if (!currentRow || currentRow.played <= 0 || teamCount <= 0) {
    return archive;
  }
  const positionFactor = teamCount > 1 ? (teamCount - currentRow.rank) / (teamCount - 1) : 1;
  const ppg = currentRow.points / Math.max(1, currentRow.played);
  const profitPerGame = currentRow.profit / Math.max(1, currentRow.played);
  const currentForm = (positionFactor * 34)
    + (ppg * 11)
    + clamp(profitPerGame * 7, -8, 12)
    + (currentRow.rank === 1 ? 6 : currentRow.rank === 2 ? 3 : 0);
  return (archive * 0.58) + currentForm;
}

function decimalOdds(probability: number): number {
  const safeProbability = clamp(probability, 0.02, 0.88);
  return Number((1 / safeProbability).toFixed(2));
}

function probabilitySummary(diff: number, drawProbability: number): { homeProbability: number; awayProbability: number } {
  const winPool = 1 - drawProbability;
  const homeShare = 1 / (1 + Math.exp(-(diff / 11)));
  const homeProbability = winPool * homeShare;
  return {
    homeProbability,
    awayProbability: winPool - homeProbability,
  };
}

function rankReason(row: OddsCurrentRow | null | undefined): string | null {
  if (!row || row.played <= 0) {
    return null;
  }
  return `rank ${row.rank} with ${row.points} points from ${row.played}`;
}

function archiveReason(profile: OddsTeamProfile): string | null {
  const titles = profile.history.filter((row) => row.rank === 1).length;
  const lastSeason = profile.history
    .slice()
    .sort((left, right) => seasonNumber(right.season) - seasonNumber(left.season))[0] ?? null;
  if (titles > 0 && lastSeason) {
    return `${titles} prior title${titles === 1 ? '' : 's'} and a ${lastSeason.rank === 1 ? 'title-winning' : `#${lastSeason.rank}`} finish in ${lastSeason.season}`;
  }
  if (lastSeason) {
    return `${lastSeason.season} ended #${lastSeason.rank} in ${lastSeason.division}`;
  }
  return null;
}

export function buildFixtureOdds(args: {
  home: OddsTeamProfile;
  away: OddsTeamProfile;
  homeRow?: OddsCurrentRow | null;
  awayRow?: OddsCurrentRow | null;
  teamCount: number;
  competition: 'division' | 'master' | 'trio' | 'cup' | 'master_cup';
  homeSeed?: number | null;
  awaySeed?: number | null;
}): FixtureOddsModel {
  const {
    home,
    away,
    homeRow = null,
    awayRow = null,
    teamCount,
    competition,
    homeSeed = null,
    awaySeed = null,
  } = args;
  const homeStrength = buildCompetitionStrength(home, homeRow, teamCount);
  const awayStrength = buildCompetitionStrength(away, awayRow, teamCount);
  const homeAdvantage = competition === 'division' || competition === 'master' || competition === 'trio' ? 2.4 : 1.1;
  const seedEdge = homeSeed && awaySeed ? clamp((awaySeed - homeSeed) * 0.55, -4, 4) : 0;
  const diff = (homeStrength + homeAdvantage + seedEdge) - awayStrength;
  const drawBase = competition === 'cup' || competition === 'master_cup' ? 0.2 : 0.27;
  const drawProbability = clamp(drawBase - Math.min(0.11, Math.abs(diff) / 150), 0.14, 0.31);
  const summary = probabilitySummary(diff, drawProbability);
  const homeProbability = clamp(summary.homeProbability, 0.08, 0.78);
  const awayProbability = clamp(summary.awayProbability, 0.08, 0.78);
  const normalizedTotal = homeProbability + drawProbability + awayProbability;
  const finalHome = homeProbability / normalizedTotal;
  const finalDraw = drawProbability / normalizedTotal;
  const finalAway = awayProbability / normalizedTotal;

  const reasons: string[] = [];
  const homeRank = rankReason(homeRow);
  const awayRank = rankReason(awayRow);
  if (homeRank && awayRank) {
    reasons.push(`${home.teamName} bring ${homeRank}; ${away.teamName} bring ${awayRank}`);
  } else {
    const homeArchive = archiveReason(home);
    const awayArchive = archiveReason(away);
    if (homeArchive || awayArchive) {
      reasons.push(`${home.teamName}: ${homeArchive ?? 'limited archive'}; ${away.teamName}: ${awayArchive ?? 'limited archive'}`);
    }
  }
  if (homeSeed && awaySeed && homeSeed !== awaySeed) {
    reasons.push(`seed edge favours ${homeSeed < awaySeed ? home.teamName : away.teamName}`);
  }
  if (Math.abs(diff) < 4) {
    reasons.push('ratings are tight, so draw odds stay live');
  } else if (diff > 0) {
    reasons.push(`${home.teamName} rate stronger on current and historical form`);
  } else {
    reasons.push(`${away.teamName} rate stronger on current and historical form`);
  }

  return {
    homeProbability: finalHome,
    drawProbability: finalDraw,
    awayProbability: finalAway,
    homeOdds: decimalOdds(finalHome),
    drawOdds: decimalOdds(finalDraw),
    awayOdds: decimalOdds(finalAway),
    reason: reasons.slice(0, 2).join('. '),
  };
}

export function buildOutrightOdds(
  teams: Array<{ profile: OddsTeamProfile; currentRow?: OddsCurrentRow | null }>,
  teamCount: number,
): OutrightOddsRow[] {
  if (teams.length === 0) {
    return [];
  }
  const weighted = teams.map(({ profile, currentRow }) => ({
    teamId: profile.teamId,
    teamName: profile.teamName,
    strength: Math.exp(buildCompetitionStrength(profile, currentRow, teamCount) / 24),
  }));
  const total = weighted.reduce((sum, row) => sum + row.strength, 0);
  return weighted
    .map((row) => {
      const probability = total > 0 ? row.strength / total : 1 / teams.length;
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        probability,
        odds: decimalOdds(probability),
      };
    })
    .sort((left, right) => left.odds - right.odds || right.probability - left.probability || left.teamName.localeCompare(right.teamName));
}
