import type {
  ChampionsSpotlightEntry,
  ChampionsSpotlightModel,
  CupSegmentModel,
  CupSegmentRow,
  DivisionKey,
  DivisionRoundupData,
  DivisionRoundupModel,
  DivisionSpec,
  DivisionResultsFixtureRow,
  FixtureDifficulty,
  FormResult,
  JourneyTeam,
  PreviousChampionRow,
  ProfitVolatility,
  RoundupFixture,
  RoundupCupFixture,
  RoundupHistoryRow,
  RoundupTableRow,
  RoundupTeam,
  SpotlightMovement,
  SpotlightPerspective,
} from './roundupTypes';
import { cupFixtureDetailLabel, cupFixtureScoreLabel, cupFixtureTeamsLabel } from '../../lib/cupDisplay';

const DIVISION_SPECS: DivisionSpec[] = [
  { key: 'champions', title: 'Champions Division', shortTitle: 'Champions' },
  { key: 'premier', title: 'Premier Division', shortTitle: 'Premier' },
  { key: 'division-one', title: 'Division One', shortTitle: 'Div 1' },
  { key: 'division-two', title: 'Division Two', shortTitle: 'Div 2' },
  { key: 'division-three', title: 'Division Three', shortTitle: 'Div 3' },
  { key: 'division-four', title: 'Division Four', shortTitle: 'Div 4' },
];

const EXCLUDED_DIVISION_PATTERN = /(friendl|playoff)/i;
const OFFICIAL_DIVISION_GAMEWEEK_COUNT = 7;

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSeasonNumber(season: string): number | null {
  const match = season.match(/(\d+)/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatProfit(value: number): string {
  return safeNumber(value).toFixed(2);
}

function divisionSpecFromLabel(label: string): DivisionSpec | null {
  if (!label) {
    return null;
  }
  const normalized = normalizeLabel(label);
  if (EXCLUDED_DIVISION_PATTERN.test(normalized)) {
    return null;
  }
  if (/champion/.test(normalized)) {
    return DIVISION_SPECS[0];
  }
  if (/premier/.test(normalized)) {
    return DIVISION_SPECS[1];
  }
  if (/division\s*1|div\s*1|average/.test(normalized)) {
    return DIVISION_SPECS[2];
  }
  if (/division\s*2|div\s*2|struggling/.test(normalized)) {
    return DIVISION_SPECS[3];
  }
  if (/division\s*3|div\s*3|awful/.test(normalized)) {
    return DIVISION_SPECS[4];
  }
  if (/division\s*4|div\s*4/.test(normalized)) {
    return DIVISION_SPECS[5];
  }
  return null;
}

function fixtureStatusLabel(fixture: RoundupFixture): string {
  if (fixture.result === 'home') {
    return `${fixture.homeTeam} won`;
  }
  if (fixture.result === 'away') {
    return `${fixture.awayTeam} won`;
  }
  if (fixture.result === 'draw') {
    return 'Draw';
  }
  return 'Upcoming';
}

function fixtureScoreLabel(fixture: RoundupFixture): string {
  if (fixture.result === 'pending') {
    return 'vs';
  }
  return `${formatProfit(fixture.homeProfit)} - ${formatProfit(fixture.awayProfit)}`;
}

function buildFixtureRows(fixtures: RoundupFixture[]): DivisionResultsFixtureRow[] {
  return fixtures.map((fixture) => ({
    id: String(fixture.id),
    fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
    score: fixtureScoreLabel(fixture),
    status: fixtureStatusLabel(fixture),
  }));
}

type JourneySeedRow = RoundupTableRow & { ballColor: string | null; ringColor: string | null; textColor: string | null };
type TeamFixtureSnapshot = {
  fixtureId: number;
  gwNumber: number;
  opponentName: string;
  result: FormResult;
  teamProfit: number;
  opponentProfit: number;
  margin: number;
};

function buildJourneyTeams(
  rows: JourneySeedRow[],
  fixtures: RoundupFixture[],
  currentGwNumber: number,
): JourneyTeam[] {
  const effectiveGwNumber = Math.min(OFFICIAL_DIVISION_GAMEWEEK_COUNT, Math.max(1, currentGwNumber));
  const teamRows = rows.slice(0, 4);
  if (teamRows.length === 0) {
    return [];
  }

  const teamIds = teamRows.map((row) => row.teamId);
  const teamCount = teamRows.length;
  const alphabeticalStartRows = teamRows
    .slice()
    .sort((left, right) => left.teamName.localeCompare(right.teamName));
  const initialRankByTeamId = new Map<number, number>(
    alphabeticalStartRows.map((row, index) => [row.teamId, index + 1]),
  );
  const rankByTeamId = new Map<number, number>();
  const statsByTeamId = new Map<number, { points: number; profit: number; wins: number; losses: number; draws: number }>();
  const teamNameById = new Map<number, string>();
  const teamIdByName = new Map<string, number>();
  const historyByTeamId = new Map<number, number[]>();

  teamRows.forEach((row, index) => {
    const initialRank = Math.max(1, Math.min(teamCount, initialRankByTeamId.get(row.teamId) ?? index + 1));
    rankByTeamId.set(row.teamId, initialRank);
    teamNameById.set(row.teamId, row.teamName);
    teamIdByName.set(normalizeLabel(row.teamName), row.teamId);
    statsByTeamId.set(row.teamId, { points: 0, profit: 0, wins: 0, losses: 0, draws: 0 });
    historyByTeamId.set(row.teamId, [initialRank]);
  });

  const fixturesByWeek = new Map<number, RoundupFixture[]>();
  fixtures.forEach((fixture) => {
    const gwNumber = parseGwNumber(fixture.gw);
    if (gwNumber < 1 || gwNumber > effectiveGwNumber) {
      return;
    }
    const weekFixtures = fixturesByWeek.get(gwNumber) ?? [];
    weekFixtures.push(fixture);
    fixturesByWeek.set(gwNumber, weekFixtures);
  });

  for (let week = 1; week <= effectiveGwNumber; week += 1) {
    const weekFixtures = fixturesByWeek.get(week) ?? [];
    weekFixtures.forEach((fixture) => {
      if (fixture.result === 'pending') {
        return;
      }
      const homeId = teamIdByName.get(normalizeLabel(fixture.homeTeam));
      const awayId = teamIdByName.get(normalizeLabel(fixture.awayTeam));
      if (!homeId || !awayId || !statsByTeamId.has(homeId) || !statsByTeamId.has(awayId)) {
        return;
      }
      const homeStats = statsByTeamId.get(homeId);
      const awayStats = statsByTeamId.get(awayId);
      if (!homeStats || !awayStats) {
        return;
      }

      homeStats.profit += safeNumber(fixture.homeProfit);
      awayStats.profit += safeNumber(fixture.awayProfit);

      if (fixture.result === 'home') {
        homeStats.points += 3;
        homeStats.wins += 1;
        awayStats.losses += 1;
      } else if (fixture.result === 'away') {
        awayStats.points += 3;
        awayStats.wins += 1;
        homeStats.losses += 1;
      } else {
        homeStats.points += 1;
        awayStats.points += 1;
        homeStats.draws += 1;
        awayStats.draws += 1;
      }
    });

    const rankedTeamIds = teamIds.slice().sort((leftId, rightId) => {
      const left = statsByTeamId.get(leftId);
      const right = statsByTeamId.get(rightId);
      if (!left || !right) {
        return leftId - rightId;
      }
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.profit !== left.profit) {
        return right.profit - left.profit;
      }
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      const leftPrevious = rankByTeamId.get(leftId) ?? teamCount;
      const rightPrevious = rankByTeamId.get(rightId) ?? teamCount;
      if (leftPrevious !== rightPrevious) {
        return leftPrevious - rightPrevious;
      }
      return (teamNameById.get(leftId) ?? '').localeCompare(teamNameById.get(rightId) ?? '');
    });

    rankedTeamIds.forEach((teamId, index) => {
      const rank = index + 1;
      rankByTeamId.set(teamId, rank);
      const history = historyByTeamId.get(teamId) ?? [];
      history.push(rank);
      historyByTeamId.set(teamId, history);
    });
  }

  teamRows.forEach((row, index) => {
    const history = historyByTeamId.get(row.teamId) ?? [index + 1];
    const latest = history[history.length - 1] ?? row.rank ?? index + 1;
    while (history.length < effectiveGwNumber + 1) {
      history.push(latest);
    }
    if (effectiveGwNumber >= 0) {
      history[effectiveGwNumber] = Math.max(1, Math.min(teamCount, safeNumber(row.rank) || latest));
    }
    historyByTeamId.set(row.teamId, history);
  });

  return teamRows
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      ballColor: row.ballColor,
      ringColor: row.ringColor,
      textColor: row.textColor,
      ranks: (historyByTeamId.get(row.teamId) ?? [row.rank]).map((rank) => Math.max(1, Math.min(teamCount, Math.round(rank)))),
    }));
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  return mean(values.map((value) => (value - avg) ** 2));
}

function isCupWinner(cupFinish: string): boolean {
  return /(winner|champion)/i.test(cupFinish.trim());
}

function teamFixturesFromDivision(teamName: string, fixtures: RoundupFixture[], currentGwNumber: number): TeamFixtureSnapshot[] {
  const normalizedTeamName = normalizeLabel(teamName);
  return fixtures
    .map((fixture) => {
      const fixtureGw = parseGwNumber(fixture.gw);
      if (fixtureGw < 1 || fixtureGw > currentGwNumber) {
        return null;
      }
      const isHome = normalizeLabel(fixture.homeTeam) === normalizedTeamName;
      const isAway = normalizeLabel(fixture.awayTeam) === normalizedTeamName;
      if (!isHome && !isAway) {
        return null;
      }
      if (fixture.result === 'pending') {
        return null;
      }
      const teamProfit = isHome ? safeNumber(fixture.homeProfit) : safeNumber(fixture.awayProfit);
      const opponentProfit = isHome ? safeNumber(fixture.awayProfit) : safeNumber(fixture.homeProfit);
      let result: FormResult = 'D';
      if (fixture.result === 'draw') {
        result = 'D';
      } else if ((fixture.result === 'home' && isHome) || (fixture.result === 'away' && isAway)) {
        result = 'W';
      } else {
        result = 'L';
      }
      return {
        fixtureId: fixture.id,
        gwNumber: fixtureGw,
        opponentName: isHome ? fixture.awayTeam : fixture.homeTeam,
        result,
        teamProfit,
        opponentProfit,
        margin: teamProfit - opponentProfit,
      };
    })
    .filter((value): value is TeamFixtureSnapshot => value !== null)
    .sort((left, right) => {
      if (left.gwNumber !== right.gwNumber) {
        return left.gwNumber - right.gwNumber;
      }
      return left.fixtureId - right.fixtureId;
    });
}

function formLast3FromSnapshots(snapshots: TeamFixtureSnapshot[]): FormResult[] {
  return snapshots.slice(-3).map((snapshot) => snapshot.result);
}

function formLast5FromSnapshots(snapshots: TeamFixtureSnapshot[]): FormResult[] {
  return snapshots.slice(-5).map((snapshot) => snapshot.result);
}

function losingStreakFromSnapshots(snapshots: TeamFixtureSnapshot[]): number {
  let streak = 0;
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index]?.result !== 'L') {
      break;
    }
    streak += 1;
  }
  return streak;
}

function biggestWinLoss(snapshots: TeamFixtureSnapshot[]): { biggestWin: string; biggestLoss: string } {
  if (snapshots.length === 0) {
    return {
      biggestWin: 'No completed wins yet',
      biggestLoss: 'No completed losses yet',
    };
  }
  const best = snapshots.reduce((selected, candidate) => (candidate.margin > selected.margin ? candidate : selected), snapshots[0]);
  const worst = snapshots.reduce((selected, candidate) => (candidate.margin < selected.margin ? candidate : selected), snapshots[0]);
  const biggestWin = best.margin > 0
    ? `${formatSigned(best.margin)} vs ${best.opponentName} (GW${best.gwNumber})`
    : 'No completed wins yet';
  const biggestLoss = worst.margin < 0
    ? `${formatSigned(worst.margin)} vs ${worst.opponentName} (GW${worst.gwNumber})`
    : 'No completed losses yet';
  return { biggestWin, biggestLoss };
}

function trajectoryLabel(ranks: number[]): string {
  if (ranks.length < 3) {
    return 'Consistent';
  }
  const recent = ranks.slice(-4);
  const delta = recent[0] - recent[recent.length - 1];
  const allSame = recent.every((rank) => rank === recent[0]);
  if (delta >= 2) {
    return 'Late Surge';
  }
  if (delta === 1) {
    return 'Upward Momentum';
  }
  if (delta <= -2) {
    return 'Early Collapse';
  }
  if (delta === -1) {
    return 'Slipping';
  }
  if (allSame) {
    return 'Consistent';
  }
  return 'Stalling';
}

function movementArrow(startPosition: number, currentPosition: number): SpotlightMovement {
  if (currentPosition < startPosition) {
    return 'up';
  }
  if (currentPosition > startPosition) {
    return 'down';
  }
  return 'flat';
}

function difficultyFromScore(score: number | null, teamCount: number): FixtureDifficulty {
  if (score === null) {
    return 'balanced';
  }
  const midpoint = (teamCount + 1) / 2;
  if (score <= midpoint - 0.35) {
    return 'easy';
  }
  if (score >= midpoint + 0.35) {
    return 'hard';
  }
  return 'balanced';
}

function volatilityFromVariance(value: number): ProfitVolatility {
  if (value < 0.18) {
    return 'Stable';
  }
  if (value < 0.55) {
    return 'Swingy';
  }
  return 'Boom/Bust';
}

function spotlightPerspective(rank: number, teamCount: number): SpotlightPerspective {
  if (rank <= 1) {
    return 'leader';
  }
  if (rank >= teamCount) {
    return 'bottom';
  }
  if (rank <= Math.min(3, teamCount - 1)) {
    return 'chaser';
  }
  return 'mid';
}

function tagLineFromContext(args: {
  rank: number;
  teamCount: number;
  movement: SpotlightMovement;
  losingStreak: number;
  profit: number;
  maxProfit: number;
}): string {
  const { rank, teamCount, movement, losingStreak, profit, maxProfit } = args;
  if (rank === 1) {
    return 'Title Contender';
  }
  if (losingStreak >= 2 || rank === teamCount) {
    return 'Under Pressure';
  }
  if (profit >= maxProfit && profit > 0) {
    return 'Profit Machine';
  }
  if (movement === 'up' && rank > 1) {
    return 'Quietly Climbing';
  }
  if (rank >= teamCount - 1) {
    return 'Hanging On';
  }
  return 'The Comeback Story';
}

function averageFinish(rows: RoundupHistoryRow[]): number | null {
  const validRanks = rows.map((row) => safeNumber(row.rank)).filter((rank) => rank > 0);
  if (validRanks.length === 0) {
    return null;
  }
  return mean(validRanks);
}

function buildProjectionLine(args: {
  entry: Omit<ChampionsSpotlightEntry, 'projectionLine' | 'titleProbability'>;
  currentGwNumber: number;
  seasonLength: number;
  gapToLeader: number | null;
}): string {
  const { entry, currentGwNumber, seasonLength, gapToLeader } = args;
  const remainingFixtures = Math.max(0, seasonLength - currentGwNumber);
  const pointsPace = entry.points / Math.max(1, currentGwNumber);
  const projectedPoints = Math.round(entry.points + (remainingFixtures * pointsPace));
  if (entry.perspective === 'leader') {
    if (entry.gapToSecond !== null && entry.gapToSecond <= 2) {
      return `If they maintain current pace, they finish on ${projectedPoints} points, but the margin for error is shrinking.`;
    }
    return `If they maintain current pace, they finish on ${projectedPoints} points.`;
  }
  if (entry.perspective === 'bottom') {
    const pointsNeeded = Math.max(0, (entry.gapToSafety ?? 0) + 1);
    const winsNeeded = Math.max(1, Math.ceil(pointsNeeded / 3));
    return `They need ${winsNeeded} wins from the remaining fixtures to stay in touch with safety.`;
  }
  if (entry.difficulty === 'hard') {
    return 'Their final fixtures are statistically the toughest run-in in the Champions group.';
  }
  if (gapToLeader !== null && gapToLeader > 0) {
    const winsNeeded = Math.max(1, Math.ceil(gapToLeader / 3));
    return `Within striking distance, but they likely need ${winsNeeded} wins to close the title gap.`;
  }
  if (entry.averageFinish !== null && entry.averageFinish > 2.5) {
    return 'History suggests they fade after the mid-season push, so this next stretch is decisive.';
  }
  return `Projection trend: ${entry.teamName} are on course for ${projectedPoints} points if current output holds.`;
}

function buildCupRowId(prefix: string, fixtureId: number): string {
  return `${prefix}-${fixtureId}`;
}

function buildCupSegmentModel(args: {
  currentGwNumber: number;
  cupFixtures: RoundupCupFixture[];
}): CupSegmentModel | null {
  const { currentGwNumber, cupFixtures } = args;
  if (cupFixtures.length === 0) {
    return null;
  }

  const sorted = cupFixtures.slice().sort((left, right) => {
    const leftGw = parseGwNumber(left.gw);
    const rightGw = parseGwNumber(right.gw);
    if (leftGw !== rightGw) {
      return leftGw - rightGw;
    }
    if (left.round !== right.round) {
      return left.round - right.round;
    }
    return left.matchNumber - right.matchNumber;
  });

  const currentRoundFixtures = sorted.filter((fixture) => parseGwNumber(fixture.gw) === currentGwNumber);
  let selectedFixtures = currentRoundFixtures;
  if (selectedFixtures.length === 0) {
    const latestCompletedGw = Math.max(
      0,
      ...sorted
        .map((fixture) => parseGwNumber(fixture.gw))
        .filter((gwNumber) => gwNumber <= currentGwNumber),
    );
    selectedFixtures = sorted.filter((fixture) => parseGwNumber(fixture.gw) === latestCompletedGw);
  }
  if (selectedFixtures.length === 0) {
    selectedFixtures = sorted.slice(-Math.min(8, sorted.length));
  }

  const activeRoundName = selectedFixtures[0]?.roundName ?? 'Cup Round';
  const activeGw = selectedFixtures[0]?.gw ?? `GW${Math.max(1, currentGwNumber)}`;

  const buildRow = (fixture: RoundupCupFixture): CupSegmentRow => {
    const fixtureLabel = cupFixtureTeamsLabel(fixture);
    const score = cupFixtureScoreLabel(fixture);
    const detail = cupFixtureDetailLabel(fixture);
    return {
      id: buildCupRowId('fixture', fixture.id),
      fixtureId: fixture.id,
      gw: fixture.gw,
      roundName: fixture.roundName,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      winnerTeam: fixture.winnerTeam,
      homeProfit: Number.isFinite(fixture.homeProfit) ? fixture.homeProfit : null,
      awayProfit: Number.isFinite(fixture.awayProfit) ? fixture.awayProfit : null,
      score,
      detail,
      played: fixture.played,
      decidedBy: fixture.decidedBy,
      fixture: fixtureLabel,
      status: fixture.played ? `${score} • ${detail}` : detail,
    };
  };

  const rowsByFixtureId = new Map(sorted.map((fixture) => [fixture.id, buildRow(fixture)]));
  const selectedIds = new Set(selectedFixtures.map((fixture) => fixture.id));
  const selectedRows = sorted
    .filter((fixture) => selectedIds.has(fixture.id))
    .map((fixture) => rowsByFixtureId.get(fixture.id))
    .filter((row): row is CupSegmentRow => Boolean(row));

  const results = selectedRows.filter((row) => Boolean(row.winnerTeam));
  const upcoming = selectedRows.filter((row) => !row.winnerTeam);

  return {
    title: 'Cup Update',
    roundLabel: `${activeRoundName} • ${activeGw}`,
    results,
    upcoming,
    allRows: sorted
      .map((fixture) => rowsByFixtureId.get(fixture.id))
      .filter((row): row is CupSegmentRow => Boolean(row)),
  };
}

function buildChampionsSpotlightModel(args: {
  currentSeason: string;
  currentGwNumber: number;
  currentSeasonLength: number;
  championsDivision: DivisionRoundupData | undefined;
  allFixtures: RoundupFixture[];
  histories: Record<number, RoundupHistoryRow[]>;
}): ChampionsSpotlightModel | null {
  const { currentSeason, currentGwNumber, currentSeasonLength, championsDivision, allFixtures, histories } = args;
  if (!championsDivision || championsDivision.tableRows.length === 0) {
    return null;
  }

  const championsRows = championsDivision.tableRows.slice().sort((left, right) => left.rank - right.rank);
  const teamCount = championsRows.length;
  const maxProfit = Math.max(...championsRows.map((row) => safeNumber(row.profit)));
  const rankByTeamName = new Map(championsRows.map((row) => [normalizeLabel(row.teamName), row.rank]));
  const pointsByTeamId = new Map(championsRows.map((row) => [row.teamId, safeNumber(row.points)]));
  const profitsByTeamId = new Map(championsRows.map((row) => [row.teamId, safeNumber(row.profit)]));
  const championsFixtures = allFixtures
    .filter((fixture) => divisionSpecFromLabel(fixture.division)?.key === 'champions')
    .sort((left, right) => {
      const leftGw = parseGwNumber(left.gw);
      const rightGw = parseGwNumber(right.gw);
      if (leftGw !== rightGw) {
        return leftGw - rightGw;
      }
      return left.id - right.id;
    });

  const previousSeasonNumber = (parseSeasonNumber(currentSeason) ?? 0) - 1;
  const previousSeasonLabel = previousSeasonNumber > 0 ? `S${previousSeasonNumber}` : null;

  const baseEntries: Array<Omit<ChampionsSpotlightEntry, 'projectionLine' | 'titleProbability'>> = championsRows.map((row) => {
    const teamHistory = (histories[row.teamId] ?? []).filter((historyRow) => !EXCLUDED_DIVISION_PATTERN.test(normalizeLabel(historyRow.division)));
    const championsHistory = teamHistory.filter((historyRow) => divisionSpecFromLabel(historyRow.division)?.key === 'champions');
    const snapshots = teamFixturesFromDivision(row.teamName, championsFixtures, currentGwNumber);
    const formLast3 = formLast3FromSnapshots(snapshots);
    const formLast5 = formLast5FromSnapshots(snapshots);
    const losingStreak = losingStreakFromSnapshots(snapshots);
    const bigResults = biggestWinLoss(snapshots);
    const journey = championsDivision.journeyTeams.find((team) => team.teamId === row.teamId);
    const journeyRanks = journey?.ranks ?? [row.rank];
    const startPosition = journeyRanks[0] ?? row.rank;
    const highestPosition = Math.min(...journeyRanks);
    const currentPosition = journeyRanks[Math.min(currentGwNumber, journeyRanks.length - 1)] ?? row.rank;
    const movement = movementArrow(startPosition, currentPosition);
    const movementLabel = trajectoryLabel(journeyRanks);
    const pointsAbove = championsRows.find((candidate) => candidate.rank === row.rank - 1)?.points ?? null;
    const pointsBelow = championsRows.find((candidate) => candidate.rank === row.rank + 1)?.points ?? null;
    const second = championsRows.find((candidate) => candidate.rank === 2);
    const safety = championsRows.find((candidate) => candidate.rank === teamCount - 1);
    const gapAbove = pointsAbove === null ? null : pointsAbove - row.points;
    const gapBelow = pointsBelow === null ? null : row.points - pointsBelow;
    const gapToSecond = row.rank === 1 && second ? row.points - second.points : null;
    const gapToSafety = row.rank === teamCount && safety ? safety.points - row.points : null;
    const teamSeasonProfits = snapshots.map((snapshot) => snapshot.teamProfit);
    const volatilityScore = variance(teamSeasonProfits);
    const remainingFixtures = championsFixtures.filter((fixture) => {
      const fixtureGw = parseGwNumber(fixture.gw);
      if (fixtureGw < currentGwNumber) {
        return false;
      }
      if (fixtureGw === currentGwNumber && fixture.result !== 'pending') {
        return false;
      }
      const normalizedName = normalizeLabel(row.teamName);
      return normalizeLabel(fixture.homeTeam) === normalizedName || normalizeLabel(fixture.awayTeam) === normalizedName;
    });
    const difficultySamples = remainingFixtures
      .map((fixture) => {
        const opponentName = normalizeLabel(fixture.homeTeam) === normalizeLabel(row.teamName)
          ? fixture.awayTeam
          : fixture.homeTeam;
        const opponentRank = rankByTeamName.get(normalizeLabel(opponentName));
        return opponentRank ?? null;
      })
      .filter((value): value is number => value !== null);
    const difficultyScore = difficultySamples.length > 0 ? mean(difficultySamples) : null;
    const difficulty = difficultyFromScore(difficultyScore, teamCount);
    const allTimeLeagueTitles = teamHistory.filter((historyRow) => historyRow.rank === 1).length;
    const championsLeagueTitles = championsHistory.filter((historyRow) => historyRow.rank === 1).length;
    const cupWins = teamHistory.filter((historyRow) => isCupWinner(historyRow.cupFinish)).length;
    const avgFinish = averageFinish(teamHistory);
    const historicalProfitRecord = Math.max(0, ...teamHistory.map((historyRow) => safeNumber(historyRow.profit)));
    const allTimeSpins = teamHistory.reduce((sum, historyRow) => sum + safeNumber(historyRow.spins), 0);
    const defendingChampion = Boolean(
      previousSeasonLabel
      && championsHistory.some((historyRow) => historyRow.season === previousSeasonLabel && historyRow.rank === 1),
    );
    let legacyLine = `${championsLeagueTitles} Champions title${championsLeagueTitles === 1 ? '' : 's'} in club history`;
    if (championsLeagueTitles === 0) {
      legacyLine = 'Still chasing first Champions title';
    } else if (defendingChampion) {
      legacyLine = 'Defending Champions';
    } else if (championsLeagueTitles >= 3) {
      legacyLine = 'Most decorated side in Champions history';
    }
    const perspective = spotlightPerspective(row.rank, teamCount);
    const controlIndex = row.rank === 1
      ? Number(((gapToSecond ?? 0) + ((row.profit - (profitsByTeamId.get(second?.teamId ?? -1) ?? row.profit)) / 2)).toFixed(2))
      : null;

    return {
      teamId: row.teamId,
      teamName: row.teamName,
      ballColor: row.ballColor,
      ringColor: row.ringColor,
      textColor: row.textColor,
      rank: row.rank,
      points: row.points,
      profit: row.profit,
      wins: row.wins,
      losses: row.losses,
      goalDiff: row.goalDiff,
      formLast3,
      formLast5,
      tagLine: tagLineFromContext({
        rank: row.rank,
        teamCount,
        movement,
        losingStreak,
        profit: row.profit,
        maxProfit,
      }),
      perspective,
      gapAbove,
      gapBelow,
      gapToSecond,
      gapToSafety,
      biggestWin: bigResults.biggestWin,
      biggestLoss: bigResults.biggestLoss,
      controlIndex,
      losingStreak,
      startPosition,
      highestPosition,
      currentPosition,
      movement,
      movementLabel,
      allTimeLeagueTitles,
      championsLeagueTitles,
      cupWins,
      averageFinish: avgFinish,
      historicalProfitRecord,
      allTimeSpins,
      legacyLine,
      difficulty,
      difficultyScore,
      volatility: volatilityFromVariance(volatilityScore),
      volatilityScore,
    };
  });

  const baseEntryById = new Map(baseEntries.map((entry) => [entry.teamId, entry]));
  const first = championsRows.find((row) => row.rank === 1)?.teamId ?? null;
  const second = championsRows.find((row) => row.rank === 2)?.teamId ?? null;
  const lowest = championsRows.slice().sort((left, right) => right.rank - left.rank)[0]?.teamId ?? null;
  const mover = baseEntries
    .slice()
    .sort((left, right) => {
      const leftShift = Math.abs(left.startPosition - left.currentPosition);
      const rightShift = Math.abs(right.startPosition - right.currentPosition);
      if (rightShift !== leftShift) {
        return rightShift - leftShift;
      }
      return left.rank - right.rank;
    })[0]?.teamId ?? null;
  const mostProfitable = championsRows.slice().sort((left, right) => right.profit - left.profit)[0]?.teamId ?? null;

  const orderedUniqueTeamIds: number[] = [];
  [first, second, lowest, mover, mostProfitable].forEach((teamId) => {
    if (teamId === null || orderedUniqueTeamIds.includes(teamId)) {
      return;
    }
    orderedUniqueTeamIds.push(teamId);
  });

  const spotlightEntries = orderedUniqueTeamIds
    .map((teamId) => baseEntryById.get(teamId))
    .filter((value): value is Omit<ChampionsSpotlightEntry, 'projectionLine' | 'titleProbability'> => value !== undefined)
    .map((entry) => {
      const leaderPoints = pointsByTeamId.get(first ?? -1) ?? entry.points;
      const gapToLeader = leaderPoints - entry.points;
      const projectionLine = buildProjectionLine({
        entry,
        currentGwNumber,
        seasonLength: Math.max(currentSeasonLength, championsDivision.seasonLength),
        gapToLeader: gapToLeader > 0 ? gapToLeader : null,
      });
      return {
        ...entry,
        projectionLine,
        titleProbability: null as number | null,
      };
    });

  if (currentGwNumber >= 5 && spotlightEntries.length > 0) {
    const weights = spotlightEntries.map((entry) => {
      const score = (entry.points * 2.1) + (entry.profit * 0.18) + ((teamCount - entry.rank) * 1.3);
      return Math.exp(score / 10);
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    spotlightEntries.forEach((entry, index) => {
      const probability = total > 0 ? (weights[index] / total) * 100 : 0;
      entry.titleProbability = Number(probability.toFixed(1));
    });
  }

  return {
    introTitle: 'Champions League Spotlight',
    miniTable: championsRows,
    entries: spotlightEntries,
  };
}

function buildPreviousChampions(
  currentSeason: string,
  teamById: Map<number, RoundupTeam>,
  histories: Record<number, RoundupHistoryRow[]>,
): PreviousChampionRow[] {
  const winnersBySeasonAndDivision = new Map<string, PreviousChampionRow>();
  const currentSeasonNumber = parseSeasonNumber(currentSeason);

  Object.entries(histories).forEach(([teamIdKey, teamHistory]) => {
    const teamId = Number(teamIdKey);
    if (!Number.isFinite(teamId) || !Array.isArray(teamHistory)) {
      return;
    }
    teamHistory.forEach((row) => {
      if (!row || row.rank !== 1) {
        return;
      }
      const divisionSpec = divisionSpecFromLabel(row.division);
      if (!divisionSpec) {
        return;
      }
      const seasonNumber = parseSeasonNumber(row.season);
      if (seasonNumber !== null && currentSeasonNumber !== null && seasonNumber >= currentSeasonNumber) {
        return;
      }
      if (seasonNumber === null && row.season === currentSeason) {
        return;
      }

      const wins = safeNumber(row.wins);
      const draws = safeNumber(row.draws);
      const losses = safeNumber(row.losses);
      const played = Math.max(0, wins + draws + losses);
      const dominance = played > 0
        ? `${Math.round((wins / played) * 100)}% win rate`
        : 'No completed record';

      const entry: PreviousChampionRow = {
        season: row.season,
        division: divisionSpec.title,
        teamName: teamById.get(teamId)?.name ?? `Team ${teamId}`,
        points: safeNumber(row.points),
        profit: safeNumber(row.profit),
        wins,
        draws,
        losses,
        dominance,
      };
      const key = `${row.season}::${divisionSpec.key}`;
      const existing = winnersBySeasonAndDivision.get(key);
      if (!existing || entry.points > existing.points || (entry.points === existing.points && entry.profit > existing.profit)) {
        winnersBySeasonAndDivision.set(key, entry);
      }
    });
  });

  const divisionOrder = new Map<DivisionKey, number>(DIVISION_SPECS.map((spec, index) => [spec.key, index]));

  return Array.from(winnersBySeasonAndDivision.values()).sort((left, right) => {
    const leftSeason = parseSeasonNumber(left.season);
    const rightSeason = parseSeasonNumber(right.season);
    if (leftSeason !== null && rightSeason !== null && leftSeason !== rightSeason) {
      return rightSeason - leftSeason;
    }
    if (left.season !== right.season) {
      return right.season.localeCompare(left.season);
    }
    const leftKey = divisionSpecFromLabel(left.division)?.key;
    const rightKey = divisionSpecFromLabel(right.division)?.key;
    const leftOrder = leftKey ? (divisionOrder.get(leftKey) ?? 0) : 0;
    const rightOrder = rightKey ? (divisionOrder.get(rightKey) ?? 0) : 0;
    return leftOrder - rightOrder;
  });
}

export function parseGwNumber(value: string): number {
  const match = value.match(/(\d+)/);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

export function buildDivisionRoundupModel(args: {
  currentSeason: string;
  currentGw: string;
  teams: RoundupTeam[];
  leagueTable: Record<string, RoundupTableRow[]>;
  fixtures: RoundupFixture[];
  histories: Record<number, RoundupHistoryRow[]>;
  cupFixtures: RoundupCupFixture[];
}): DivisionRoundupModel {
  const {
    currentSeason,
    currentGw,
    teams,
    leagueTable,
    fixtures,
    histories,
    cupFixtures,
  } = args;
  const currentGwNumber = Math.min(OFFICIAL_DIVISION_GAMEWEEK_COUNT, parseGwNumber(currentGw));
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const filteredFixtures = fixtures
    .filter((fixture) => !EXCLUDED_DIVISION_PATTERN.test(normalizeLabel(fixture.division)))
    .sort((left, right) => {
      const leftGw = parseGwNumber(left.gw);
      const rightGw = parseGwNumber(right.gw);
      if (leftGw !== rightGw) {
        return leftGw - rightGw;
      }
      return left.id - right.id;
    });

  const globalSeasonLength = Math.min(
    OFFICIAL_DIVISION_GAMEWEEK_COUNT,
    Math.max(currentGwNumber, ...filteredFixtures.map((fixture) => parseGwNumber(fixture.gw))),
  );

  const divisions: DivisionRoundupData[] = DIVISION_SPECS.map((divisionSpec) => {
    const divisionRows = Object.entries(leagueTable)
      .filter(([divisionLabel]) => divisionSpecFromLabel(divisionLabel)?.key === divisionSpec.key)
      .flatMap(([, rows]) => rows ?? []);

    const rowByTeamId = new Map<number, RoundupTableRow>();
    divisionRows.forEach((row) => {
      if (!row || !Number.isFinite(row.teamId)) {
        return;
      }
      const existing = rowByTeamId.get(row.teamId);
      if (!existing || row.rank < existing.rank) {
        rowByTeamId.set(row.teamId, row);
      }
    });

    const selectedRows = Array.from(rowByTeamId.values())
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }
        if (right.points !== left.points) {
          return right.points - left.points;
        }
        if (right.profit !== left.profit) {
          return right.profit - left.profit;
        }
        return left.teamName.localeCompare(right.teamName);
      })
      .slice(0, 4);

    const rowsWithColors = selectedRows.map((row) => {
      const team = teamById.get(row.teamId);
      return {
        ...row,
        ballColor: team?.ballColor ?? null,
        ringColor: team?.ringColor ?? null,
        textColor: team?.textColor ?? null,
        goalDiff: Number.isFinite(row.wins) && Number.isFinite(row.losses) ? row.wins - row.losses : null,
      };
    });

    const divisionFixtures = filteredFixtures.filter((fixture) => divisionSpecFromLabel(fixture.division)?.key === divisionSpec.key);
    const divisionSeasonLength = Math.min(
      OFFICIAL_DIVISION_GAMEWEEK_COUNT,
      Math.max(globalSeasonLength, ...divisionFixtures.map((fixture) => parseGwNumber(fixture.gw)), currentGwNumber),
    );

    const fixturesByWeek = new Map<number, RoundupFixture[]>();
    divisionFixtures.forEach((fixture) => {
      const gwNumber = parseGwNumber(fixture.gw);
      const weekFixtures = fixturesByWeek.get(gwNumber) ?? [];
      weekFixtures.push(fixture);
      fixturesByWeek.set(gwNumber, weekFixtures);
    });

    const currentWeekForFixtures = Math.max(1, currentGwNumber);
    const previousWeek = Math.max(1, currentGwNumber - 1);
    const isNewSeason = currentGwNumber <= 1;
    const isSeasonComplete = divisionSeasonLength > 0 && currentGwNumber >= divisionSeasonLength;

    const previousResults = isNewSeason
      ? []
      : (fixturesByWeek.get(previousWeek) ?? []).filter((fixture) => fixture.result !== 'pending');

    const weekFixtures = fixturesByWeek.get(currentWeekForFixtures) ?? [];
    const pendingFixtures = weekFixtures.filter((fixture) => fixture.result === 'pending');
    const activeFixtures = pendingFixtures.length > 0 ? pendingFixtures : weekFixtures;

    const resultsTitle = isNewSeason ? 'New Season' : `Results - Game Week ${previousWeek}`;
    const fixturesTitle = isSeasonComplete ? 'Season Completed' : `Fixtures - Game Week ${currentWeekForFixtures}`;

    return {
      key: divisionSpec.key,
      title: divisionSpec.title,
      shortTitle: divisionSpec.shortTitle,
      tableRows: rowsWithColors,
      journeyTeams: buildJourneyTeams(rowsWithColors, divisionFixtures, currentGwNumber),
      currentGwNumber,
      seasonLength: divisionSeasonLength,
      resultsTitle,
      fixturesTitle,
      isNewSeason,
      isSeasonComplete,
      resultsRows: buildFixtureRows(previousResults),
      fixtureRows: buildFixtureRows(isSeasonComplete ? [] : activeFixtures),
    };
  });

  const championsSpotlight = buildChampionsSpotlightModel({
    currentSeason,
    currentGwNumber,
    currentSeasonLength: globalSeasonLength,
    championsDivision: divisions.find((division) => division.key === 'champions'),
    allFixtures: filteredFixtures,
    histories,
  });
  const cupSegment = buildCupSegmentModel({
    currentGwNumber,
    cupFixtures,
  });

  return {
    divisions,
    previousChampions: buildPreviousChampions(currentSeason, teamById, histories),
    championsSpotlight,
    cupSegment,
  };
}
