import { animate, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { StudioSlide } from './SlideDeck';
import { TeamBadge } from './TeamBadge';
import type { SsnDivisionJourneyTeam } from './SsnDivisionJourneyChart';
import {
  isWeeklyStatusInPlay,
  isWeeklyStatusResolved,
  type WeeklyFixtureStatusCode,
  weeklyStatusTone,
} from '../lib/statusCodes';

export type TeamRivalryData = {
  opponent: string;
  record: string;
  profitImpact: string;
  winnerHighlight: string;
};

export type TeamRecentResult = {
  id: string;
  competition: 'League' | 'Cup' | 'Super Cup';
  fixture: string;
  score: string;
  outcome: string;
  profitImpact: string;
  rivalry: boolean;
};

export type TeamSeasonStoryPoint = {
  gw: string;
  cumulativeProfit: number;
};

export type TeamSeasonPredictionRace = {
  jayCorrect: number;
  computerCorrect: number;
  resolved: number;
};

export type TeamSeasonArchiveRow = {
  season: string;
  division: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  cupFinish: string;
  superCupFinish?: string;
  predictionRace?: TeamSeasonPredictionRace | null;
};

export type TeamCupArchiveRow = {
  season: string;
  cupFinish: string;
};

export type TeamLeagueJourneyRow = {
  gw: string;
  opponent: string;
  venue: 'H' | 'A';
  result: 'W' | 'D' | 'L' | 'P';
  profit: number | null;
  spins: number | null;
};

export type TeamCupJourneyRow = {
  gw: string;
  round: string;
  opponent: string;
  result: 'Advanced' | 'Out' | 'Pending' | 'Bye';
};

export type TeamAnalytics = {
  bestGw: string | null;
  bestGwProfit: number | null;
  worstGw: string | null;
  worstGwProfit: number | null;
  avgGwProfit: number | null;
  totalLeagueProfit: number;
  totalLeagueSpins: number;
  spinEfficiency: number | null;
  cupAdvances: number;
  bestMatchLabel: string | null;
};

export type TeamWeeklyFixtureRow = {
  id: string;
  competition: string;
  fixture: string;
  homeTeamName?: string;
  awayTeamName?: string;
  statusCode: WeeklyFixtureStatusCode;
  status: string;
  winnerName?: string | null;
  opponentName?: string | null;
  teamScore: string;
  opponentScore: string;
  picks: string;
  odds?: {
    homeTeam: string;
    awayTeam: string;
    homeOdds: string;
    drawOdds: string | null;
    awayOdds: string;
    allowsDraw: boolean;
    reason: string;
    confidence: string;
    context: string;
  } | null;
};

export type TeamPredictionCredit = {
  jayPoints: number;
  jayCorrect: number;
  computerPoints: number;
  computerCorrect: number;
  resolved: number;
};

export type TeamPlayoffPhase = 'regular' | 'run-in' | 'playoffs';
export type TeamPlayoffOutlook =
  | 'promotion-likely'
  | 'hold'
  | 'drop-risk'
  | 'surprise-underperformer'
  | 'late-surge-contender';

export type TeamPlayoffContext = {
  phase: TeamPlayoffPhase;
  outlook: TeamPlayoffOutlook;
  outlookLabel: string;
  scope?: 'playoff' | 'division';
  playoffParticipant?: boolean;
  statusCue?: 'LIVE' | 'PROVISIONAL' | 'CONFIRMED';
  raceLine: string;
  expectationLine: string;
  actionLine: string;
  trendLine: string;
  pointsGapLine: string;
  promotionGap?: number;
  safetyGap?: number;
  bracketLine?: string;
  trendMemoryLine?: string;
};

export type TeamSpotlightData = {
  id: number;
  name: string;
  currentSeason: string;
  currentGw: string;
  gameweekLocked?: boolean;
  resultTruth?: 'live' | 'provisional' | 'confirmed';
  dayPhase?: 'kickoff' | 'middle' | 'latter' | 'closing';
  dayPhaseLine?: string;
  league: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  preseasonFavorite?: boolean;
  trendCache?: {
    teamId: number;
    windowSize: number;
    fromGw: string;
    toGw: string;
    rankDelta: number;
    pointsDelta: number;
    profitDelta: number;
    pointsDeltaVsPreviousWindow: number | null;
    profitDeltaVsPreviousWindow: number | null;
  } | null;
  rank: number | null;
  points: number;
  currentGwProfit: number | null;
  seasonProfit: number;
  winRate: number | null;
  avgProfitPerEntry: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  spins: number;
  leagueForm: Array<'W' | 'D' | 'L'>;
  cupForm: Array<'W' | 'L' | 'B'>;
  streak: string;
  recentResults: TeamRecentResult[];
  weeklyFixtures?: TeamWeeklyFixtureRow[];
  predictionCredit?: TeamPredictionCredit;
  lastSeasonSummary?: TeamSeasonArchiveRow | null;
  nextLeagueFixture: string;
  nextCupFixture: string;
  nextLeagueIsRivalry: boolean;
  rivalry: TeamRivalryData | null;
  predictedFinish: string;
  predictedPoints: string;
  predictedRank: number | null;
  forecastSummary?: {
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
  } | null;
  zoneLabel: string;
  divisionMovement: string;
  seasonStory: TeamSeasonStoryPoint[];
  previousSeasons?: TeamSeasonArchiveRow[];
  previousCupRuns?: TeamCupArchiveRow[];
  currentLeagueJourney?: TeamLeagueJourneyRow[];
  currentCupJourney?: TeamCupJourneyRow[];
  tableSnapshot?: Array<{
    teamId: number;
    teamName: string;
    rank: number;
    played: number;
    points: number;
    profit: number;
    spins: number;
    ballColor: string | null;
    ringColor: string | null;
    textColor: string | null;
  }>;
  analytics?: TeamAnalytics;
  allTimeRanks?: {
    points: number | null;
    profit: number | null;
    spins: number | null;
  } | null;
  masterPosition?: {
    rank: number | null;
    points: number;
    profit: number;
  } | null;
  divisionJourney?: {
    divisionTitle: string;
    gwNumbers: number[];
    teams: SsnDivisionJourneyTeam[];
  } | null;
  playoffContext?: TeamPlayoffContext | null;
};

type AnimatedMetricProps = {
  value: number | null;
  decimals?: number;
  suffix?: string;
  className?: string;
};

type ProfitGlowBarProps = {
  label: string;
  value: number;
  maxAbs: number;
};

type ScoreDuelBarsProps = {
  teamScore: string;
  opponentScore: string;
};

type PredictionRaceProps = {
  jayPoints: number;
  computerPoints: number;
};

type InterpretationCard = {
  lens: string;
  headline: string;
  detail: string;
  tone: 'up' | 'flat' | 'down';
};

type SeasonDivisionGraphPoint = {
  seasonNumber: number;
  seasonLabel: string;
  divisionTier: number;
  divisionLabel: string;
  x: number;
  y: number;
};

type SeasonDivisionGraphModel = {
  width: number;
  height: number;
  xTicks: Array<{ x: number; label: string }>;
  yTicks: Array<{ y: number; label: string }>;
  points: SeasonDivisionGraphPoint[];
  path: string;
};

function formatSigned(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

function journeyResultClass(result: TeamLeagueJourneyRow['result'] | TeamCupJourneyRow['result']): string {
  if (result === 'W' || result === 'Advanced' || result === 'Bye') {
    return 'win';
  }
  if (result === 'L' || result === 'Out') {
    return 'loss';
  }
  if (result === 'D') {
    return 'draw';
  }
  return 'pending';
}

function parseScoreValue(value: string): number | null {
  const normalized = value.trim();
  if (
    normalized.length === 0
    || normalized.toLowerCase() === 'pending'
    || normalized.toLowerCase() === 'bye'
    || normalized === '—'
  ) {
    return null;
  }
  const numeric = Number(normalized.replace(/[^0-9+.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatPointsValue(value: number): string {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatProbability(value: number): string {
  return `${value.toFixed(1)}%`;
}

function parsePickSummary(picks: string): { jay: string; computer: string } {
  const jayMatch = picks.match(/Jay:\s*([^•]+)/i);
  const computerMatch = picks.match(/Computer:\s*(.+)$/i);
  return {
    jay: jayMatch?.[1]?.trim() || '—',
    computer: computerMatch?.[1]?.trim() || '—',
  };
}

function normalizePickToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseFixtureTeams(fixtureLabel: string): { home: string; away: string } | null {
  const parts = fixtureLabel.split(/\s+vs\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }
  return { home: parts[0], away: parts[1] };
}

function getOpponentNameFromFixture(fixtureLabel: string, teamName: string): string {
  const teams = parseFixtureTeams(fixtureLabel);
  if (!teams) {
    return 'the opponent';
  }
  if (teams.home.toLowerCase() === teamName.toLowerCase()) {
    return teams.away;
  }
  if (teams.away.toLowerCase() === teamName.toLowerCase()) {
    return teams.home;
  }
  return teams.away;
}

function presenterList(items: string[]): string {
  const cleaned = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  if (cleaned.length === 0) {
    return '';
  }
  if (cleaned.length === 1) {
    return cleaned[0] ?? '';
  }
  if (cleaned.length === 2) {
    return `${cleaned[0]} and ${cleaned[1]}`;
  }
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

function formatOrdinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  const mod10 = value % 10;
  if (mod10 === 1) {
    return `${value}st`;
  }
  if (mod10 === 2) {
    return `${value}nd`;
  }
  if (mod10 === 3) {
    return `${value}rd`;
  }
  return `${value}th`;
}

function ordinalWord(value: number): string {
  const words = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
  ];
  if (value >= 1 && value <= words.length) {
    return words[value - 1]!;
  }
  return `${value}th`;
}

function formatSeasonBadge(season: string): string {
  const match = season.trim().match(/s\s*(\d+)/i);
  if (!match?.[1]) {
    return season;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return season;
  }
  return `Season ${value}`;
}

function formatSeasonNarrative(season: string): string {
  const match = season.trim().match(/s\s*(\d+)/i);
  if (!match?.[1]) {
    return season;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return season;
  }
  return `${ordinalWord(value)} season`;
}

function seasonNumberFromLabel(season: string): number | null {
  const match = season.trim().match(/s\s*(\d+)/i);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedDivisionLabel(division: string): { tier: number; label: string } {
  const normalized = division.trim().toLowerCase();
  if (/champion/.test(normalized)) {
    return { tier: 1, label: 'Champions' };
  }
  if (/premier/.test(normalized)) {
    return { tier: 2, label: 'Premier' };
  }
  if (/division\s*1|\bdiv\s*1\b|average/.test(normalized)) {
    return { tier: 3, label: 'Division 1' };
  }
  if (/division\s*2|\bdiv\s*2\b|struggling/.test(normalized)) {
    return { tier: 4, label: 'Division 2' };
  }
  if (/division\s*3|\bdiv\s*3\b|awful/.test(normalized)) {
    return { tier: 5, label: 'Division 3' };
  }
  if (/division\s*4|\bdiv\s*4/.test(normalized)) {
    return { tier: 6, label: 'Division 4' };
  }
  return { tier: 7, label: division };
}

function buildSeasonDivisionGraph(
  team: TeamSpotlightData,
  previousSeasons: TeamSeasonArchiveRow[],
): SeasonDivisionGraphModel | null {
  const pointsBySeason = new Map<number, { seasonNumber: number; seasonLabel: string; divisionTier: number; divisionLabel: string }>();
  previousSeasons.forEach((season) => {
    const seasonNumber = seasonNumberFromLabel(season.season);
    if (seasonNumber === null) {
      return;
    }
    const division = normalizedDivisionLabel(season.division);
    pointsBySeason.set(seasonNumber, {
      seasonNumber,
      seasonLabel: `S${seasonNumber}`,
      divisionTier: division.tier,
      divisionLabel: division.label,
    });
  });
  const currentSeasonNumber = seasonNumberFromLabel(team.currentSeason);
  if (currentSeasonNumber !== null) {
    const currentDivision = normalizedDivisionLabel(team.league);
    pointsBySeason.set(currentSeasonNumber, {
      seasonNumber: currentSeasonNumber,
      seasonLabel: `S${currentSeasonNumber}`,
      divisionTier: currentDivision.tier,
      divisionLabel: currentDivision.label,
    });
  }

  const orderedPoints = Array.from(pointsBySeason.values()).sort((left, right) => left.seasonNumber - right.seasonNumber);
  if (orderedPoints.length === 0) {
    return null;
  }

  const width = 360;
  const height = 196;
  const leftPad = 86;
  const rightPad = 20;
  const topPad = 18;
  const bottomPad = 36;

  const minSeason = orderedPoints[0]?.seasonNumber ?? 1;
  const maxSeason = orderedPoints[orderedPoints.length - 1]?.seasonNumber ?? minSeason;
  const xFromSeason = (seasonNumber: number): number => {
    if (maxSeason === minSeason) {
      return leftPad + ((width - leftPad - rightPad) / 2);
    }
    const ratio = (seasonNumber - minSeason) / (maxSeason - minSeason);
    return leftPad + ((width - leftPad - rightPad) * ratio);
  };

  const tiers = Array.from(new Set(orderedPoints.map((point) => point.divisionTier))).sort((left, right) => left - right);
  const minTier = tiers[0] ?? 1;
  const maxTier = tiers[tiers.length - 1] ?? minTier;
  const yFromTier = (tier: number): number => {
    if (maxTier === minTier) {
      return topPad + ((height - topPad - bottomPad) / 2);
    }
    const ratio = (tier - minTier) / (maxTier - minTier);
    return topPad + ((height - topPad - bottomPad) * ratio);
  };

  const yTicks = tiers.map((tier) => {
    const sample = orderedPoints.find((point) => point.divisionTier === tier);
    return {
      y: yFromTier(tier),
      label: sample?.divisionLabel ?? `Tier ${tier}`,
    };
  });

  const points: SeasonDivisionGraphPoint[] = orderedPoints.map((point) => ({
    ...point,
    x: xFromSeason(point.seasonNumber),
    y: yFromTier(point.divisionTier),
  }));

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return {
    width,
    height,
    xTicks: points.map((point) => ({ x: point.x, label: point.seasonLabel })),
    yTicks,
    points,
    path,
  };
}

function lastResolvedCupRound(rows: TeamCupJourneyRow[]): TeamCupJourneyRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row && row.result !== 'Pending') {
      return row;
    }
  }
  return null;
}

function isCupWinningSeason(cupFinish: string): boolean {
  return /winner|champion/i.test(cupFinish);
}

function bestArchiveFinish(previousSeasons: TeamSeasonArchiveRow[]): number | null {
  const validRanks = previousSeasons
    .map((season) => season.rank)
    .filter((rank) => Number.isFinite(rank) && rank > 0);
  if (validRanks.length === 0) {
    return null;
  }
  return Math.min(...validRanks);
}

function lastCupElimination(rows: TeamCupJourneyRow[]): TeamCupJourneyRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.result === 'Out') {
      return row;
    }
  }
  return null;
}

function furthestCupAdvance(rows: TeamCupJourneyRow[]): TeamCupJourneyRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row && (row.result === 'Advanced' || row.result === 'Bye')) {
      return row;
    }
  }
  return null;
}

function summarizeCupJourney(teamName: string, rows: TeamCupJourneyRow[], nextCupFixture: string): string {
  if (rows.length === 0) {
    if (nextCupFixture.toLowerCase().includes('no pending')) {
      return `${teamName} did not build a notable cup run this time.`;
    }
    return `Cup journey is still to be written, with ${nextCupFixture}.`;
  }
  const elimination = lastCupElimination(rows);
  const furthest = furthestCupAdvance(rows);
  const latest = lastResolvedCupRound(rows);

  if (elimination) {
    const reached = furthest?.round ?? elimination.round;
    return `They reached ${reached}, but were stopped by ${elimination.opponent} in ${elimination.round}.`;
  }
  if (latest && (latest.result === 'Advanced' || latest.result === 'Bye')) {
    return `They are still in the cup and have just moved through ${latest.round}.`;
  }
  if (latest) {
    return `Cup story so far: ${latest.round} against ${latest.opponent} ended ${latest.result.toLowerCase()}.`;
  }
  return `Cup path is pending updates, with ${nextCupFixture}.`;
}

function cupRoundReachedLabel(rows: TeamCupJourneyRow[], nextCupFixture: string): string {
  if (rows.length === 0) {
    return /no pending|none|not in cup/i.test(nextCupFixture) ? 'No run recorded' : 'Awaiting first round';
  }
  const latestResolved = lastResolvedCupRound(rows);
  if (latestResolved?.result === 'Out') {
    return `${latestResolved.round} • Out`;
  }
  if (latestResolved?.result === 'Advanced' || latestResolved?.result === 'Bye') {
    return `${latestResolved.round} • Through`;
  }
  const latest = rows[rows.length - 1] ?? null;
  if (latest?.round) {
    return latest.result === 'Pending' ? `${latest.round} • Pending` : latest.round;
  }
  return 'Cup stage pending';
}

function isSeasonLikelyComplete(
  team: TeamSpotlightData,
  leagueRows: TeamLeagueJourneyRow[],
  weeklyFixtures: TeamWeeklyFixtureRow[],
): boolean {
  const leaguePlayed = leagueRows.filter((row) => row.result !== 'P').length;
  const leaguePending = leagueRows.filter((row) => row.result === 'P').length;
  const weeklyOpen = weeklyFixtures.some((fixture) => !isWeeklyStatusResolved(fixture.statusCode));
  const fixtureHints = `${team.nextLeagueFixture} ${team.nextCupFixture}`.toLowerCase();
  const hintComplete = /season complete|season over|all done|no pending|finished/i.test(fixtureHints);

  if (hintComplete) {
    return true;
  }
  if (leaguePlayed === 0) {
    return false;
  }
  return leaguePending === 0 && !weeklyOpen;
}

function buildRankStoryLine(
  team: TeamSpotlightData,
  seasonComplete: boolean,
  gamesPlayed: number,
  seed: string,
): string {
  const pointsLine = gamesPlayed > 0
    ? `${team.points} points from ${gamesPlayed} games`
    : `${team.points} points so far`;
  const zone = team.zoneLabel.toLowerCase();
  if (team.rank === 1) {
    return seasonComplete
      ? pickBySeed(`${seed}-champion-final`, [
        `They ended the season as champions in ${team.league}, collecting ${pointsLine}.`,
        `It finished as a title-winning campaign in ${team.league} with ${pointsLine}.`,
      ])
      : pickBySeed(`${seed}-champion-live`, [
        `Right now they are setting the pace at the top of ${team.league} with ${pointsLine}.`,
        `They are driving the title race in ${team.league}, backed by ${pointsLine}.`,
      ]);
  }
  if (zone.includes('relegation')) {
    return seasonComplete
      ? pickBySeed(`${seed}-relegation-final`, [
        `It ended under relegation pressure in ${team.league}, with ${pointsLine}.`,
        `The survival battle did not ease in ${team.league}, finishing on ${pointsLine}.`,
      ])
      : pickBySeed(`${seed}-relegation-live`, [
        `They are in the relegation fight in ${team.league}, currently on ${pointsLine}.`,
        `It is a survival story right now in ${team.league}, with ${pointsLine}.`,
      ]);
  }
  if (team.rank === 2 || team.rank === 3) {
    const rankLabel = team.rank !== null ? formatOrdinal(team.rank) : 'a top position';
    return seasonComplete
      ? pickBySeed(`${seed}-near-miss-final`, [
        `They finished ${rankLabel} in ${team.league}, a near miss with ${pointsLine}.`,
        `It closed with a strong but short campaign: ${rankLabel} in ${team.league} on ${pointsLine}.`,
      ])
      : pickBySeed(`${seed}-near-miss-live`, [
        `They are in a near-miss lane right now, ${rankLabel} in ${team.league} with ${pointsLine}.`,
        `The chase is on from ${rankLabel} in ${team.league}, built on ${pointsLine}.`,
      ]);
  }
  if (team.rank !== null && team.rank >= 4) {
    const rankLabel = formatOrdinal(team.rank);
    return seasonComplete
      ? pickBySeed(`${seed}-mid-final`, [
        `It is the end of the season and a disappointing league run in ${team.league}: ${rankLabel} with ${pointsLine}.`,
        `The league campaign closed below expectation in ${team.league}, ending ${rankLabel} with ${pointsLine}.`,
      ])
      : pickBySeed(`${seed}-mid-live`, [
        `They sit ${rankLabel} in ${team.league} right now, with ${pointsLine}, still searching for consistency.`,
        `The season is still moving, but they are ${rankLabel} in ${team.league} with ${pointsLine}.`,
      ]);
  }
  return seasonComplete
    ? `${team.name} closed the season with ${pointsLine}.`
    : `${team.name} are building the season story with ${pointsLine}.`;
}

function inferFixtureWinnerName(teamName: string, fixture: TeamWeeklyFixtureRow): string | null {
  if (fixture.winnerName?.trim()) {
    return fixture.winnerName.trim();
  }
  const teamScore = parseScoreValue(fixture.teamScore);
  const opponentScore = parseScoreValue(fixture.opponentScore);
  const opponentName = fixture.opponentName ?? getOpponentNameFromFixture(fixture.fixture, teamName);
  if (teamScore === null || opponentScore === null || teamScore === opponentScore) {
    return null;
  }
  return teamScore > opponentScore ? teamName : opponentName;
}

function buildWinnerCallout(
  teamName: string,
  fixture: TeamWeeklyFixtureRow,
  resultTruth: 'live' | 'provisional' | 'confirmed',
): string | null {
  const teamScore = parseScoreValue(fixture.teamScore);
  const opponentScore = parseScoreValue(fixture.opponentScore);
  const opponentName = fixture.opponentName ?? getOpponentNameFromFixture(fixture.fixture, teamName);
  const isConfirmed = resultTruth === 'confirmed';
  if (teamScore !== null && opponentScore !== null) {
    if (teamScore > opponentScore) {
      return isConfirmed
        ? `Winner of ${fixture.fixture} was ${fixture.winnerName ?? teamName}.`
        : `As it stands, winner of ${fixture.fixture} is ${fixture.winnerName ?? teamName}.`;
    }
    if (opponentScore > teamScore) {
      return isConfirmed
        ? `Winner of ${fixture.fixture} was ${fixture.winnerName ?? opponentName}.`
        : `As it stands, winner of ${fixture.fixture} is ${fixture.winnerName ?? opponentName}.`;
    }
    return isConfirmed
      ? `${fixture.fixture} finished as a draw.`
      : `As it stands, ${fixture.fixture} is level.`;
  }
  if (fixture.statusCode === 'advanced' || fixture.statusCode === 'bye') {
    return isConfirmed
      ? `Winner of ${fixture.fixture} was ${teamName}.`
      : `As it stands, ${teamName} are through in ${fixture.fixture}.`;
  }
  if (fixture.statusCode === 'out') {
    return isConfirmed
      ? `Winner of ${fixture.fixture} was ${opponentName}.`
      : `As it stands, ${opponentName} are through in ${fixture.fixture}.`;
  }
  if (fixture.statusCode === 'won') {
    return isConfirmed
      ? `Winner of ${fixture.fixture} was ${teamName}.`
      : `As it stands, ${teamName} lead ${fixture.fixture}.`;
  }
  if (fixture.statusCode === 'lost') {
    return isConfirmed
      ? `Winner of ${fixture.fixture} was ${opponentName}.`
      : `As it stands, ${opponentName} lead ${fixture.fixture}.`;
  }
  if (fixture.statusCode === 'draw') {
    return isConfirmed
      ? `${fixture.fixture} finished as a draw.`
      : `As it stands, ${fixture.fixture} is level.`;
  }
  return null;
}

function buildOpponentScoreCallout(teamName: string, fixture: TeamWeeklyFixtureRow): string | null {
  const opponentScore = parseScoreValue(fixture.opponentScore);
  const fallbackOpponent = getOpponentNameFromFixture(fixture.fixture, teamName);
  const opponentName = fixture.opponentName?.trim() || fallbackOpponent;
  if (opponentScore === null || !opponentName || ['BYE', 'TBD'].includes(opponentName.toUpperCase())) {
    return null;
  }
  return `As it stands, ${opponentName} has scored ${formatPointsValue(opponentScore)} points in their round.`;
}

function pickBySeed(seed: string, variants: string[]): string {
  if (variants.length === 0) {
    return '';
  }
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash * 31 + seed.charCodeAt(idx)) % 2147483647;
  }
  return variants[Math.abs(hash) % variants.length] ?? variants[0];
}

function ScoreDuelBars({ teamScore, opponentScore }: ScoreDuelBarsProps) {
  const teamValue = parseScoreValue(teamScore);
  const opponentValue = parseScoreValue(opponentScore);
  if (teamValue === null && opponentValue === null) {
    return (
      <div className="studio-duel-empty">
        <span>Awaiting score input</span>
      </div>
    );
  }
  const maxMagnitude = Math.max(1, Math.abs(teamValue ?? 0), Math.abs(opponentValue ?? 0));
  const teamWidth = Math.max(8, (Math.abs(teamValue ?? 0) / maxMagnitude) * 100);
  const opponentWidth = Math.max(8, (Math.abs(opponentValue ?? 0) / maxMagnitude) * 100);

  return (
    <div className="studio-duel-wrap">
      <div className="studio-duel-row">
        <span>You</span>
        <div className="studio-duel-track">
          <motion.span
            className="studio-duel-fill you"
            initial={{ width: 0 }}
            animate={{ width: `${teamWidth}%` }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
          />
        </div>
        <strong>{teamScore}</strong>
      </div>
      <div className="studio-duel-row">
        <span>Opp</span>
        <div className="studio-duel-track">
          <motion.span
            className="studio-duel-fill opp"
            initial={{ width: 0 }}
            animate={{ width: `${opponentWidth}%` }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
          />
        </div>
        <strong>{opponentScore}</strong>
      </div>
    </div>
  );
}

function PredictionRace({ jayPoints, computerPoints }: PredictionRaceProps) {
  const total = Math.max(1, jayPoints + computerPoints);
  const jayWidth = (jayPoints / total) * 100;
  const computerWidth = (computerPoints / total) * 100;

  return (
    <div className="studio-prediction-race">
      <div className="studio-prediction-race-head">
        <span>Prediction Race</span>
        <strong>{jayPoints} - {computerPoints}</strong>
      </div>
      <div className="studio-prediction-race-track">
        <motion.span
          className="studio-prediction-race-fill jay"
          initial={{ width: 0 }}
          animate={{ width: `${jayWidth}%` }}
          transition={{ duration: 0.95, ease: 'easeOut' }}
        />
        <motion.span
          className="studio-prediction-race-fill computer"
          initial={{ width: 0 }}
          animate={{ width: `${computerWidth}%` }}
          transition={{ duration: 0.95, ease: 'easeOut' }}
        />
      </div>
      <div className="studio-prediction-race-meta">
        <span>Jay {jayPoints}</span>
        <span>Computer {computerPoints}</span>
      </div>
    </div>
  );
}

function AnimatedMetric({ value, decimals = 0, suffix = '', className }: AnimatedMetricProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === null || Number.isNaN(value)) {
      return;
    }
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(latest),
    });
    return () => controls.stop();
  }, [value]);

  if (value === null || Number.isNaN(value)) {
    return <span className={className}>-</span>;
  }

  const sign = value > 0 ? '+' : '';
  return (
    <motion.span
      className={className}
      animate={{ textShadow: ['0 0 0 rgba(255, 205, 118, 0)', '0 0 10px rgba(255, 205, 118, 0.32)', '0 0 0 rgba(255, 205, 118, 0)'] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {`${sign}${displayValue.toFixed(decimals)}${suffix}`}
    </motion.span>
  );
}

function FormBadges({ values }: { values: Array<'W' | 'D' | 'L' | 'B'> }) {
  if (values.length === 0) {
    return <span className="studio-muted">No form yet.</span>;
  }
  return (
    <div className="studio-form-row">
      {values.map((value, idx) => (
        <span
          key={`${value}-${idx}`}
          className={`studio-form-badge ${value === 'W' ? 'win' : value === 'D' ? 'draw' : value === 'L' ? 'loss' : 'bye'}`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function ProfitGlowBar({ label, value, maxAbs }: ProfitGlowBarProps) {
  const width = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  return (
    <div className={`studio-profit-bar-row ${value >= 0 ? 'up' : 'down'}`}>
      <span>{label}</span>
      <div className="studio-profit-track">
        <motion.div
          className="studio-profit-fill"
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <strong>{formatSigned(value)}</strong>
    </div>
  );
}

function StoryGraph({ points }: { points: TeamSeasonStoryPoint[] }) {
  const graph = useMemo(() => {
    if (points.length === 0) {
      return null;
    }
    const width = 320;
    const height = 110;
    const pad = 12;
    const values = points.map((point) => point.cumulativeProfit);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const range = Math.max(1, max - min);
    const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
    const coords = points.map((point, index) => {
      const x = pad + step * index;
      const y = height - pad - ((point.cumulativeProfit - min) / range) * (height - pad * 2);
      return { ...point, x, y };
    });
    const path = coords
      .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
      .join(' ');
    return {
      width,
      height,
      coords,
      path,
      firstGw: points[0]?.gw ?? '',
      lastGw: points[points.length - 1]?.gw ?? '',
    };
  }, [points]);

  if (!graph) {
    return <p className="studio-muted">Season story graph unavailable.</p>;
  }

  return (
    <div className="studio-story-panel">
      <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="studio-story-svg" role="img" aria-label="Season story graph">
        <line x1="12" y1={graph.height - 12} x2={graph.width - 12} y2={graph.height - 12} className="studio-story-axis" />
        <line x1="12" y1="12" x2="12" y2={graph.height - 12} className="studio-story-axis" />
        <motion.path
          d={graph.path}
          className="studio-story-line"
          initial={{ pathLength: 0, opacity: 0.35 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
        {graph.coords.map((coord, index) => (
          <motion.circle
            key={`${coord.gw}-${index}`}
            cx={coord.x}
            cy={coord.y}
            r="3.2"
            className="studio-story-point"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.16 + index * 0.05 }}
          />
        ))}
      </svg>
      <div className="studio-story-foot">
        <span>{graph.firstGw}</span>
        <span>{graph.lastGw}</span>
      </div>
    </div>
  );
}

function SeasonDivisionGraph({ graph }: { graph: SeasonDivisionGraphModel }) {
  return (
    <div className="studio-division-journey-panel">
      <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="studio-division-journey-svg" role="img" aria-label="Season to division journey">
        {graph.yTicks.map((tick) => (
          <g key={`division-tick-${tick.label}`}>
            <line x1="86" y1={tick.y} x2={graph.width - 20} y2={tick.y} className="studio-division-journey-axis" />
            <text x={8} y={tick.y + 4} className="studio-division-journey-y-label">{tick.label}</text>
          </g>
        ))}
        {graph.xTicks.map((tick) => (
          <g key={`season-tick-${tick.label}`}>
            <line x1={tick.x} y1="18" x2={tick.x} y2={graph.height - 36} className="studio-division-journey-grid" />
            <text x={tick.x} y={graph.height - 12} className="studio-division-journey-x-label">{tick.label}</text>
          </g>
        ))}
        <motion.path
          d={graph.path}
          className="studio-division-journey-line"
          initial={{ pathLength: 0, opacity: 0.35 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
        {graph.points.map((point, index) => (
          <g key={`season-point-${point.seasonLabel}-${point.divisionLabel}`}>
            <motion.circle
              cx={point.x}
              cy={point.y}
              r="3.2"
              className="studio-division-journey-point"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.16 + index * 0.06 }}
            />
            <title>{`${point.seasonLabel}: ${point.divisionLabel}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function TeamSpotlightSlides(teams: TeamSpotlightData[]): StudioSlide[] {
  return teams.map((team) => {
    const weeklyFixtures = team.weeklyFixtures ?? [];
    const tableSnapshot = (team.tableSnapshot ?? [])
      .slice()
      .sort((left, right) => left.rank - right.rank || left.teamName.localeCompare(right.teamName));
    const liveFixtures = weeklyFixtures.filter((fixture) => isWeeklyStatusInPlay(fixture.statusCode));
    const predictionCredit = team.predictionCredit ?? {
      jayPoints: 0,
      jayCorrect: 0,
      computerPoints: 0,
      computerCorrect: 0,
      resolved: 0,
    };
    const predictionEdge = predictionCredit.jayPoints - predictionCredit.computerPoints;
    const predictionHeadline = predictionEdge === 0
      ? 'Level'
      : predictionEdge > 0
        ? `You +${predictionEdge}`
        : `Computer +${Math.abs(predictionEdge)}`;
    const forecastSummary = team.forecastSummary ?? null;
    const narration = `${team.name}. ${team.currentGw} fixtures, ${team.league} table, and odds are on screen. ${team.predictedFinish} is the current model call on ${team.predictedPoints}.${forecastSummary ? ` Title chance ${forecastSummary.titleProbability.toFixed(1)} percent.` : ''}`;

    return {
      id: `team-${team.id}-daily-board`,
      label: `${team.name} • Daily Board`,
      durationMs: 12000,
      narration,
      tone: 'team' as const,
      content: (
        <div className="studio-team-fixture-spotlight">
          <div className="studio-team-fixture-head">
            <div className="studio-team-fixture-title">
              <TeamBadge
                name={team.name}
                ballColor={team.ballColor}
                ringColor={team.ringColor}
                textColor={team.textColor}
                size={40}
              />
              <div>
                <span className="studio-kicker">Team Spotlight</span>
                <h3>{team.name}</h3>
                <p>{team.currentGw} fixtures, current {team.league} table, and market prices.</p>
              </div>
            </div>
            <div className="studio-team-fixture-summary">
              <article>
                <span>Current</span>
                <strong>{team.rank !== null ? formatOrdinal(team.rank) : 'Pending'}</strong>
                <small>{team.points} pts</small>
              </article>
              <article>
                <span>Season</span>
                <strong>{formatSigned(team.seasonProfit)}</strong>
                <small>{team.spins} spins</small>
              </article>
              <article>
                <span>Model</span>
                <strong>{team.predictedFinish}</strong>
                <small>{team.predictedPoints}</small>
              </article>
              <article>
                <span>You vs Computer</span>
                <strong>{predictionHeadline}</strong>
                <small>
                  You {predictionCredit.jayCorrect}/{predictionCredit.resolved}
                  {' '}• Computer {predictionCredit.computerCorrect}/{predictionCredit.resolved}
                </small>
              </article>
            </div>
          </div>

          {forecastSummary ? (
            <div className="studio-team-model-strip">
              <article>
                <span>Title Chance</span>
                <strong>{formatProbability(forecastSummary.titleProbability)}</strong>
              </article>
              <article>
                <span>Top Half</span>
                <strong>{formatProbability(forecastSummary.topHalfProbability)}</strong>
              </article>
              <article>
                <span>Bottom Risk</span>
                <strong>{formatProbability(forecastSummary.bottomProbability)}</strong>
              </article>
              <article>
                <span>Run-In</span>
                <strong>{forecastSummary.remainingDifficultyLabel}</strong>
                <small>
                  {forecastSummary.remainingFixtures} left
                  {forecastSummary.remainingDifficultyAverage !== null ? ` • opp strength ${forecastSummary.remainingDifficultyAverage.toFixed(1)}` : ''}
                </small>
              </article>
            </div>
          ) : null}

          {forecastSummary && (forecastSummary.modelReasonsUp.length > 0 || forecastSummary.modelReasonsDown.length > 0) ? (
            <div className="studio-team-model-explainer">
              {forecastSummary.modelReasonsUp.length > 0 ? (
                <p>
                  <strong>Upgraded by:</strong> {presenterList(forecastSummary.modelReasonsUp)}.
                </p>
              ) : null}
              {forecastSummary.modelReasonsDown.length > 0 ? (
                <p>
                  <strong>Held back by:</strong> {presenterList(forecastSummary.modelReasonsDown)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="studio-team-fixture-grid">
            <section className="studio-team-fixture-card">
              <div className="studio-team-fixture-card-head">
                <h4>{team.currentGw} Fixtures</h4>
                <span>{weeklyFixtures.length} live board item{weeklyFixtures.length === 1 ? '' : 's'}</span>
              </div>
              {weeklyFixtures.length > 0 ? (
                <div className="studio-team-fixture-list">
                  {weeklyFixtures.map((fixture) => (
                    <article key={fixture.id} className={`studio-team-fixture-item ${weeklyStatusTone(fixture.statusCode)}`}>
                      <div className="studio-team-fixture-item-head">
                        <span className="studio-comp-badge league">{fixture.competition}</span>
                        <strong>{fixture.fixture}</strong>
                        <span className={`studio-inline-result ${weeklyStatusTone(fixture.statusCode)}`}>{fixture.status}</span>
                      </div>
                      {fixture.odds ? (
                        <>
                          <div className={`studio-team-fixture-market ${fixture.odds.allowsDraw ? '' : 'two-way'}`}>
                            <span className={fixture.odds.homeTeam === team.name ? 'for-team' : ''}>
                              {fixture.odds.homeTeam} {fixture.odds.homeOdds}
                            </span>
                            {fixture.odds.allowsDraw && fixture.odds.drawOdds ? (
                              <span>Draw {fixture.odds.drawOdds}</span>
                            ) : null}
                            <span className={fixture.odds.awayTeam === team.name ? 'for-team' : ''}>
                              {fixture.odds.awayTeam} {fixture.odds.awayOdds}
                            </span>
                          </div>
                          <div className="studio-team-fixture-tags">
                            <span>{fixture.odds.confidence}</span>
                            <span>{fixture.odds.context}</span>
                          </div>
                          <p className="studio-team-fixture-reason">{fixture.odds.reason}</p>
                        </>
                      ) : (
                        <p className="studio-team-fixture-reason">Odds not available for this tie yet.</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="studio-muted">No live fixtures are loaded for this team in {team.currentGw}.</p>
              )}
            </section>

            <section className="studio-team-fixture-card studio-team-table-card">
              <div className="studio-team-fixture-card-head">
                <h4>{team.league} Table</h4>
                <span>{team.divisionMovement}</span>
              </div>
              {tableSnapshot.length > 0 ? (
                <div className="studio-team-table-wrap">
                  <table className="studio-team-mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>PLD</th>
                        <th>PTS</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableSnapshot.map((row) => (
                        <tr key={`table-${team.id}-${row.teamId}`} className={row.teamId === team.id ? 'is-team' : ''}>
                          <td>{row.rank}</td>
                          <td className="team-cell">
                            <TeamBadge
                              name={row.teamName}
                              ballColor={row.ballColor}
                              ringColor={row.ringColor}
                              textColor={row.textColor}
                              size={22}
                            />
                            <span>{row.teamName}</span>
                          </td>
                          <td>{row.played}</td>
                          <td>{row.points}</td>
                          <td>{formatSigned(row.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="studio-muted">Table snapshot is still loading.</p>
              )}

              <div className="studio-team-fixture-footer">
                <span>{liveFixtures.length > 0 ? `${liveFixtures.length} fixture${liveFixtures.length === 1 ? '' : 's'} in play` : 'No live in-play ties'}</span>
                <span>{team.predictedFinish} • {team.predictedPoints}</span>
              </div>
            </section>
          </div>
        </div>
      ),
    };
  });
}


