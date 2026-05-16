import { displayDivisionName, getDivisionOrderForSeason } from '../divisionLabels';

export type TeamHistoryRow = {
  season: string;
  division: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  cupFinish: string;
  superCupFinish: string;
};

export type TrophyRoomPayload = {
  cup: Array<{ season: string; teamName: string }>;
  divisions: Record<string, Array<{ season: string; teamName: string }>>;
  goalsOfSeason: Record<string, Array<{ season: string; teamName: string }>>;
  bookieDor: Array<{ season: string; teamName: string }>;
  masterLeague: Array<{ season: string; teamName: string }>;
  masterCup: Array<{ season: string; teamName: string }>;
  superCup: Array<{ season: string; teamName: string }>;
  tierLeagues: Record<string, Array<{ season: string; teamName: string }>>;
};

export type LegacyHonour = {
  id: string;
  season: string;
  label: string;
  shortLabel: string;
  prestige: number;
  seasonNumber: number;
};

export type TeamLegacySummary = {
  silverware: number;
  leagueTitles: number;
  cupWins: number;
  bestFinish: string;
  honours: LegacyHonour[];
};

function parseSeasonNumber(season: string): number {
  const match = season.match(/(\d+)/);
  if (!match?.[1]) {
    return 0;
  }
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function divisionPrestige(division: string): number {
  const display = displayDivisionName(division);
  if (display === 'Champions Bookies') {
    return 100;
  }
  if (display === 'Premier Bookies') {
    return 90;
  }
  if (display === 'Division 1') {
    return 80;
  }
  if (display === 'Division 2') {
    return 70;
  }
  if (display === 'Division 3') {
    return 60;
  }
  if (display === 'Division 4') {
    return 50;
  }
  return 40;
}

function divisionShortLabel(division: string): string {
  const display = displayDivisionName(division);
  if (display === 'Champions Bookies') {
    return 'Champion';
  }
  return display;
}

function tierLeaguePrestige(division: string): number {
  if (division === 'Legendary') {
    return 88;
  }
  if (division === 'Masters') {
    return 82;
  }
  if (division === 'Elite') {
    return 76;
  }
  if (division === 'Superior') {
    return 70;
  }
  if (division === 'Standard') {
    return 64;
  }
  if (division === 'Average') {
    return 58;
  }
  if (division === 'Poor') {
    return 52;
  }
  if (division === 'Awful') {
    return 46;
  }
  return 40;
}

function winnerLabel(label: string): string {
  return `${label} Winner`;
}

function pushHonours(
  target: LegacyHonour[],
  rows: Array<{ season: string; teamName: string }>,
  teamName: string,
  config: { label: string; shortLabel: string; prestige: number; idPrefix: string },
): void {
  rows
    .filter((row) => row.teamName === teamName)
    .forEach((row, index) => {
      target.push({
        id: `${config.idPrefix}-${row.season}-${index}`,
        season: row.season,
        label: winnerLabel(config.label),
        shortLabel: config.shortLabel,
        prestige: config.prestige,
        seasonNumber: parseSeasonNumber(row.season),
      });
    });
}

function hasHonour(target: LegacyHonour[], season: string, label: string): boolean {
  return target.some((entry) => entry.season === season && entry.label === label);
}

function buildBestFinishFallback(history: TeamHistoryRow[]): string {
  if (history.length === 0) {
    return 'None';
  }

  const ordered = history
    .slice()
    .sort((left, right) => {
      const leftOrder = getDivisionOrderForSeason(left.season);
      const rightOrder = getDivisionOrderForSeason(right.season);
      const leftDivisionIndex = leftOrder.indexOf(left.division);
      const rightDivisionIndex = rightOrder.indexOf(right.division);
      const normalizedLeftDivision = leftDivisionIndex >= 0 ? leftDivisionIndex : Number.MAX_SAFE_INTEGER;
      const normalizedRightDivision = rightDivisionIndex >= 0 ? rightDivisionIndex : Number.MAX_SAFE_INTEGER;
      if (normalizedLeftDivision !== normalizedRightDivision) {
        return normalizedLeftDivision - normalizedRightDivision;
      }
      const normalizedLeftRank = left.rank > 0 ? left.rank : Number.MAX_SAFE_INTEGER;
      const normalizedRightRank = right.rank > 0 ? right.rank : Number.MAX_SAFE_INTEGER;
      if (normalizedLeftRank !== normalizedRightRank) {
        return normalizedLeftRank - normalizedRightRank;
      }
      return parseSeasonNumber(right.season) - parseSeasonNumber(left.season);
    });

  const best = ordered[0];
  if (!best) {
    return 'None';
  }
  const division = displayDivisionName(best.division);
  if (best.rank > 0) {
    return `#${best.rank} in ${division}`;
  }
  return division;
}

export function buildTeamLegacySummary(
  teamName: string,
  history: TeamHistoryRow[],
  trophyRoom: TrophyRoomPayload | null,
): TeamLegacySummary {
  const honours: LegacyHonour[] = [];

  if (trophyRoom) {
    Object.entries(trophyRoom.divisions ?? {}).forEach(([division, rows]) => {
      rows
        .filter((row) => row.teamName === teamName)
        .forEach((row, index) => {
          honours.push({
            id: `division-${division}-${row.season}-${index}`,
            season: row.season,
            label: winnerLabel(displayDivisionName(division)),
            shortLabel: divisionShortLabel(division),
            prestige: divisionPrestige(division),
            seasonNumber: parseSeasonNumber(row.season),
          });
        });
    });

    Object.entries(trophyRoom.tierLeagues ?? {}).forEach(([division, rows]) => {
      rows
        .filter((row) => row.teamName === teamName)
        .forEach((row, index) => {
          honours.push({
            id: `tier-league-${division}-${row.season}-${index}`,
            season: row.season,
            label: winnerLabel(`Tier League: ${division}`),
            shortLabel: `${division} Tier`,
            prestige: tierLeaguePrestige(division),
            seasonNumber: parseSeasonNumber(row.season),
          });
        });
    });

    pushHonours(honours, trophyRoom.cup ?? [], teamName, {
      label: 'BookieBall Cup',
      shortLabel: 'Cup',
      prestige: 85,
      idPrefix: 'cup',
    });
    pushHonours(honours, trophyRoom.masterLeague ?? [], teamName, {
      label: 'Master League',
      shortLabel: 'Master',
      prestige: 95,
      idPrefix: 'master-league',
    });
    pushHonours(honours, trophyRoom.masterCup ?? [], teamName, {
      label: 'Master Cup',
      shortLabel: 'Master Cup',
      prestige: 82,
      idPrefix: 'master-cup',
    });
    pushHonours(honours, trophyRoom.superCup ?? [], teamName, {
      label: 'Super Cup',
      shortLabel: 'Super Cup',
      prestige: 78,
      idPrefix: 'super-cup',
    });
  }

  history
    .filter((row) => row.superCupFinish === 'Winner')
    .forEach((row, index) => {
      const label = winnerLabel('Super Cup');
      if (hasHonour(honours, row.season, label)) {
        return;
      }
      honours.push({
        id: `history-super-cup-${row.season}-${index}`,
        season: row.season,
        label,
        shortLabel: 'Super Cup',
        prestige: 78,
        seasonNumber: parseSeasonNumber(row.season),
      });
    });

  honours.sort((left, right) => (
    right.seasonNumber - left.seasonNumber
    || right.prestige - left.prestige
    || left.label.localeCompare(right.label)
  ));

  const leagueTitles = honours.filter((entry) => (
    entry.id.startsWith('division-')
    || entry.id.startsWith('tier-league-')
  )).length;
  const cupWins = honours.filter((entry) => (
    entry.id.startsWith('cup-')
    || entry.id.startsWith('master-cup-')
    || entry.id.startsWith('super-cup-')
  )).length;
  const masterLeagueTitles = honours.filter((entry) => entry.id.startsWith('master-league-')).length;
  const silverware = leagueTitles + cupWins + masterLeagueTitles;
  const bestFinish = honours[0]?.label ?? buildBestFinishFallback(history);

  return {
    silverware,
    leagueTitles,
    cupWins,
    bestFinish,
    honours,
  };
}
