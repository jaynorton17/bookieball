import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { cupFixtureDetailLabel, cupFixtureScoreLabel } from '../lib/cupDisplay';
import { recoverCupFixturesFromEntries } from '../lib/cupScoreRecovery';
import { displayDivisionName, getDivisionOrderForSeason, isSeasonFiveOrLater, isSeasonSixOrLater, sortDivisionNames } from '../lib/divisionLabels';
import {
  buildFixtureOdds,
  buildOutrightOdds,
  type OddsCurrentRow,
  type OddsTeamProfile,
} from '../lib/kickoffOdds';
import {
  buildLeagueForecastTable,
  type LeagueForecastRules,
  type LeagueForecastRow,
  type LeagueForecastTrend,
} from '../lib/leagueForecast';
import { pickPregamePreviewLines } from '../lib/pregamePreviewBank';
import { pickRecapReviewLines } from '../lib/recapReviewBank';
import { buildSeasonFinaleSlides } from '../lib/seasonFinaleSlides';
import type { FixtureSlideStatusCode, WeeklyFixtureStatusCode } from '../lib/statusCodes';
import {
  CompetitionBracketBoard,
  LiveOddsMeter,
  type CompetitionBracketRound,
  type VerifiedFactRailItem,
} from '../components/StudioLiveWidgets';
import { TeamBadge } from '../components/TeamBadge';
import {
  SkyStudioPanel,
  type SkyStudioBroadcastPackage,
  type SkyStudioTableDivision,
} from '../components/SkyStudioPanel';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const OFFICIAL_DIVISION_GAMEWEEKS = GAMEWEEKS.slice(0, 7);
const RECAP_FIXTURES_PAGE_SIZE = 8;

type Draw = {
  teamId: number;
  teamKey: string | null;
  teamName: string;
  division: string;
  teamUrl: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  cupOpponent: string;
  leagueOpponent: string;
  alreadyPlayed: boolean;
  currentGwProfit: number;
  currentGwSpins: number;
};

type CupFixture = {
  id: number;
  gw: string;
  roundName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'tie_break' | 'bye' | 'pending';
};

type SuperCupFixture = Awaited<ReturnType<typeof api.superCup>>[number];

type Team = {
  id: number;
  name: string;
  division: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  preseasonFavorite: boolean;
  trendCache: {
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
};

type PredictionCompetition = 'league' | 'cup' | 'master' | 'master_cup' | 'trio' | 'tier';

type PredictionRow = {
  id: number;
  gw: string;
  competition: PredictionCompetition;
  fixtureId: number;
  picker: string;
  pickOutcome: 'team' | 'draw';
  pickTeamId: number | null;
  pickTeamName: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  createdAt: string;
};

type PredictionSlateRow = {
  competition: PredictionCompetition;
  fixtureId: number;
};

type PredictionScoreboard = {
  totals: Array<{ picker: string; points: number; correct: number; total: number; perfectWeeks: number }>;
  weeks: Array<{ gw: string; picker: string; points: number; correct: number; total: number; perfect: boolean }>;
};

type MasterLeagueTableRow = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type MasterLeagueFixture = {
  id: number;
  gw: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

type MasterCupFixture = {
  id: number;
  gw: string;
  stage: 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place_playoff' | 'final';
  legNumber: number;
  tieSlot: number;
  roundName: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  winnerTeamId: number | null;
  winnerTeam: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  aggregateHomeProfit: number | null;
  aggregateAwayProfit: number | null;
  aggregateHomeSpins: number | null;
  aggregateAwaySpins: number | null;
  played: boolean;
  result: 'home' | 'away' | 'draw' | 'pending';
  decidedBy: 'profit' | 'spins' | 'penalties' | 'aggregate_profit' | 'aggregate_spins' | 'aggregate_penalties' | 'pending';
};

type TrioFixture = {
  id: number;
  gw: string;
  division: string;
  stage: 'regular' | 'playoff_semi' | 'playoff_final';
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
  winnerTeamId: number | null;
};

type TrioLeagueTableRow = {
  division: string;
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type TierLeagueTableRow = {
  division: string;
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type TierLeagueFixture = {
  id: number;
  gw: string;
  division: string;
  fixtureType: 'division' | 'cross';
  groupSlot: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeDivision: string | null;
  awayDivision: string | null;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
  result: 'home' | 'away' | 'draw' | 'pending';
};

type AllTimeLeaguesPayload = {
  fromSeason: string;
  fromGw: string;
  toSeason: string;
  toGw: string;
  pointsTable: Array<{
    teamId: number;
    teamName: string;
    ballColor?: string | null;
    ringColor?: string | null;
    textColor?: string | null;
    points: number;
    profit: number;
    spins: number;
    rank: number;
  }>;
  spinsTable: Array<{
    teamId: number;
    teamName: string;
    ballColor?: string | null;
    ringColor?: string | null;
    textColor?: string | null;
    points: number;
    profit: number;
    spins: number;
    rank: number;
  }>;
  profitTable: Array<{
    teamId: number;
    teamName: string;
    ballColor?: string | null;
    ringColor?: string | null;
    textColor?: string | null;
    points: number;
    profit: number;
    spins: number;
    rank: number;
  }>;
};

type KickoffFlowStep = 'results' | 'picks' | 'show' | 'recap';

type SeasonFinale = {
  season: string;
  payload: {
    season: string;
    leagueWinners: Array<{ division: string; teamId: number; teamName: string }>;
    bestProfits: {
      overall: { teamId: number; teamName: string; profit: number } | null;
      byDivision: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
    };
    promotions: Array<{ teamId: number; teamName: string; from: string; to: string }>;
    relegations: Array<{ teamId: number; teamName: string; from: string; to: string }>;
    playoffResults: Array<{
      upperTeamId: number;
      upperTeamName: string;
      lowerTeamId: number;
      lowerTeamName: string;
      upperDivision: string;
      lowerDivision: string;
      winnerTeamId: number | null;
      winnerTeamName: string | null;
      swapped: boolean;
    }>;
    cupWinner: { teamId: number; teamName: string } | null;
    superCup: {
      sourceSeason: string;
      pairingReason: 'winners_vs_winners' | 'double_winner_vs_bookieball_runner_up' | 'double_winner_vs_master_cup_runner_up';
      pairingExplanation: string;
      winner: { teamId: number; teamName: string } | null;
      runnerUp: { teamId: number; teamName: string } | null;
    } | null;
    standout: Array<{ label: string; value: string }>;
    goalsOfSeason: Array<{ division: string; teamId: number; teamName: string; profit: number }>;
    bookieDor: {
      weights: { league: number; cup: number; master: number; consistency: number };
      winner: {
        teamId: number;
        teamName: string;
        division: string;
        score: number;
        leagueScore: number;
        cupScore: number;
        masterScore: number;
        consistencyScore: number;
        weightedLeagueScore: number;
        weightedCupScore: number;
        weightedMasterScore: number;
        weightedConsistencyScore: number;
        leagueRank: number;
        cupFinish: string;
      };
      leaderboard: Array<{
        teamId: number;
        teamName: string;
        division: string;
        score: number;
        leagueScore: number;
        cupScore: number;
        masterScore: number;
        consistencyScore: number;
        weightedLeagueScore: number;
        weightedCupScore: number;
        weightedMasterScore: number;
        weightedConsistencyScore: number;
      }>;
    } | null;
  };
};

type LastCompletedContext = {
  season: string;
  gw: string;
};

type BookieDorBoard = {
  season: string;
  gw: string;
  weights: { league: number; cup: number; master: number; consistency: number };
  holder: {
    teamId: number;
    teamName: string;
    division: string;
    score: number;
    leagueScore: number;
    cupScore: number;
    masterScore: number;
    consistencyScore: number;
    weightedLeagueScore: number;
    weightedCupScore: number;
    weightedMasterScore: number;
    weightedConsistencyScore: number;
    leagueRank: number;
    cupFinish: string;
  } | null;
  leaderboard: Array<{
    teamId: number;
    teamName: string;
    division: string;
    score: number;
    leagueScore: number;
    cupScore: number;
    masterScore: number;
    consistencyScore: number;
    weightedLeagueScore: number;
    weightedCupScore: number;
    weightedMasterScore: number;
    weightedConsistencyScore: number;
    leagueRank: number;
    cupFinish: string;
  }>;
};

type TeamSeasonHistoryRow = {
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
  superCupFinish?: string;
};

type TeamSeasonPredictionRace = {
  jayCorrect: number;
  computerCorrect: number;
  resolved: number;
};

type LogRow = {
  entryType: 'free_spins' | 'bonus';
  profit: string;
  spins: string;
  stake: string;
};

type EntryRow = {
  id: number;
  season: string;
  gw: string;
  teamId: number;
  teamName: string;
  entryType: 'free_spins' | 'bonus';
  profit: number;
  spins: number | null;
  stake: number | null;
  notes: string | null;
  noWin: boolean;
  batchId: string | null;
  createdAt: string;
  locked: boolean;
};

type StorylinePayload = {
  generatedAt: string;
  season: string;
  gw: string;
  storylines: Array<{ id: string; headline: string; detail: string; tone: 'positive' | 'warning' | 'neutral'; metric?: string }>;
  tickerItems: string[];
  summary: { fixtures: number; resolved: number; cupFixtures: number; cupResolved: number };
};

const AUTO_STAKE_PROFIT_START_SEASON = 4;

function parseSeasonNumber(season: string): number {
  const numeric = Number(season.replace('S', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function isAutoStakeProfitSeason(season: string): boolean {
  return parseSeasonNumber(season) >= AUTO_STAKE_PROFIT_START_SEASON;
}

function parseLogNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function logRowStakeContribution(row: LogRow): number {
  const stake = parseLogNumber(row.stake);
  if (row.entryType === 'free_spins') {
    return parseLogNumber(row.spins) * stake;
  }
  return stake;
}

function effectiveLogRowProfit(row: LogRow, season: string): number {
  const reportedProfit = parseLogNumber(row.profit);
  if (!isAutoStakeProfitSeason(season)) {
    return reportedProfit;
  }
  return Number((reportedProfit + logRowStakeContribution(row)).toFixed(2));
}

function hasLogRowInput(row: LogRow, season: string): boolean {
  const profit = Number(row.profit);
  const spins = Number(row.spins);
  const stake = Number(row.stake);
  return (
    (row.profit.trim() !== '' && Number.isFinite(profit) && profit !== 0)
    || (row.entryType === 'free_spins' && row.spins.trim() !== '' && Number.isFinite(spins) && spins !== 0)
    || (
      isAutoStakeProfitSeason(season)
      && row.entryType === 'bonus'
      && row.stake.trim() !== ''
      && Number.isFinite(stake)
      && stake !== 0
    )
  );
}

function playedFromResult(result: 'home' | 'away' | 'draw' | 'pending'): number {
  return result === 'pending' ? 0 : 1;
}

function fixturePointsForProfit(myProfit: number, oppProfit: number): number {
  if (myProfit > oppProfit) {
    return 3;
  }
  if (myProfit < oppProfit) {
    return 0;
  }
  return 1;
}

function recordFromProfit(myProfit: number, oppProfit: number): { wins: number; draws: number; losses: number } {
  if (myProfit > oppProfit) {
    return { wins: 1, draws: 0, losses: 0 };
  }
  if (myProfit < oppProfit) {
    return { wins: 0, draws: 0, losses: 1 };
  }
  return { wins: 0, draws: 1, losses: 0 };
}

function gwSortValue(gw: string): number {
  const numeric = Number(gw.replace('GW', ''));
  return Number.isFinite(numeric) ? numeric : 99;
}

function seasonSortValue(season: string): number {
  const numeric = Number(season.replace('S', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function ordinal(value: number): string {
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

function formatSigned(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

function formatOutcome(result: 'home' | 'away' | 'draw' | 'pending', homeTeam: string, awayTeam: string): string {
  if (result === 'pending') {
    return 'Pending';
  }
  if (result === 'draw') {
    return 'Draw';
  }
  return `${result === 'home' ? homeTeam : awayTeam} won`;
}

type ComparableLeagueRow = {
  teamName: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  wins: number;
};

function compareLeagueRowsByRank(left: ComparableLeagueRow, right: ComparableLeagueRow): number {
  const equalStandingsMetrics = (
    left.points === right.points
    && left.profit === right.profit
    && left.spins === right.spins
    && left.wins === right.wins
  );
  if (equalStandingsMetrics) {
    return left.teamName.localeCompare(right.teamName);
  }
  const leftRank = Number(left.rank);
  const rightRank = Number(right.rank);
  const hasLeftRank = Number.isFinite(leftRank) && leftRank > 0;
  const hasRightRank = Number.isFinite(rightRank) && rightRank > 0;
  if (hasLeftRank && hasRightRank && leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  if (hasLeftRank !== hasRightRank) {
    return hasLeftRank ? -1 : 1;
  }
  if (right.points !== left.points) {
    return right.points - left.points;
  }
  if (right.profit !== left.profit) {
    return right.profit - left.profit;
  }
  if (right.spins !== left.spins) {
    return right.spins - left.spins;
  }
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return left.teamName.localeCompare(right.teamName);
}

function isPlaceholderTeam(name: string | null | undefined): boolean {
  if (!name) {
    return true;
  }
  const upper = name.trim().toUpperCase();
  return upper === 'BYE' || upper === 'TBD' || upper === 'NO FIXTURE';
}

function cupSideLabel(fixture: CupFixture, side: 'home' | 'away'): string {
  const team = side === 'home' ? fixture.homeTeam : fixture.awayTeam;
  const other = side === 'home' ? fixture.awayTeam : fixture.homeTeam;
  if (team) {
    return team;
  }
  if (fixture.gw === 'GW2' && other) {
    return 'BYE';
  }
  return 'TBD';
}

function gw8FixtureCompetitionLabel(division: string): 'PLAY OFF Fixture' | 'Friendly Fixture' {
  return /playoff/i.test(division) ? 'PLAY OFF Fixture' : 'Friendly Fixture';
}

function isGw8DivisionPlayoffFixture(fixture: { gw: string; division: string }): boolean {
  return fixture.gw.trim().toUpperCase() === 'GW8' && /playoff/i.test(fixture.division);
}

function leagueFixtureAllowsDraw(fixture: { gw: string; division: string }): boolean {
  return !isGw8DivisionPlayoffFixture(fixture);
}

function trioFixtureAllowsDraw(fixture: { stage: TrioFixture['stage'] }): boolean {
  return fixture.stage === 'regular';
}

function trioStageLabel(fixture: TrioFixture): string {
  if (fixture.stage === 'playoff_semi') {
    return 'Playoff Semi-Final';
  }
  if (fixture.stage === 'playoff_final') {
    return 'Playoff Final';
  }
  return 'Regular Season';
}

function trioFixtureCompetitionLabel(fixture: TrioFixture): string {
  const division = fixture.division;
  const stage = trioStageLabel(fixture);
  return fixture.stage === 'regular' ? `Trio League • ${division}` : `Trio League • ${division} • ${stage}`;
}

function tierFixtureCompetitionLabel(fixture: TierLeagueFixture): string {
  if (fixture.fixtureType === 'cross') {
    const homeDivision = fixture.homeDivision ?? 'Unknown';
    const awayDivision = fixture.awayDivision ?? 'Unknown';
    return `Tier League • Cross-Tier • ${homeDivision} vs ${awayDivision}`;
  }
  return `Tier League • ${fixture.division}`;
}

type PredictionSlateFixture = {
  key: string;
  competition: PredictionCompetition;
  fixtureId: number;
  competitionLabel: string;
  detailLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  allowsDraw: boolean;
};

type PredictionRecapFixtureRow = {
  key: string;
  competitionLabel: string;
  detailLabel: string;
  fixtureLabel: string;
  actualLabel: string;
  jayPick: string;
  computerPick: string;
  jayState: 'correct' | 'missed' | 'pending';
  computerState: 'correct' | 'missed' | 'pending';
};

type PredictionPickPayload = {
  fixtureId: number;
  pickTeamId: number | null;
  pickOutcome: 'team' | 'draw';
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
};

function predictionCompetitionLabel(competition: PredictionCompetition): string {
  if (competition === 'league') {
    return 'League';
  }
  if (competition === 'cup') {
    return 'BookieBall Cup';
  }
  if (competition === 'master') {
    return 'Master League';
  }
  if (competition === 'master_cup') {
    return 'Master Cup';
  }
  if (competition === 'trio') {
    return 'Trio League';
  }
  return 'Tier League';
}

type OddsBoardRow = {
  key: string;
  label: string;
  odds: number;
  probability: number;
  detail?: string;
  facts: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }>;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

type FixtureOddsCard = {
  key: string;
  title: string;
  fixture: string;
  badgeTone: 'league' | 'master' | 'trio' | 'cup';
  stamp: string;
  stampTone: 'live' | 'movement' | 'warning' | 'positive' | 'fixtures';
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number | null;
  awayOdds: number;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  allowsDraw: boolean;
  reason: string;
  detail?: string;
  marketNote: string;
  homeFacts: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }>;
  drawFacts: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }>;
  awayFacts: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }>;
  homeBallColor?: string | null;
  homeRingColor?: string | null;
  homeTextColor?: string | null;
  awayBallColor?: string | null;
  awayRingColor?: string | null;
  awayTextColor?: string | null;
};

function formatOdds(value: number): string {
  return value >= 20 ? value.toFixed(1) : value.toFixed(2);
}

function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function probabilityToOdds(probability: number): number {
  const safeProbability = Math.max(0.02, Math.min(0.88, probability));
  return Number((1 / safeProbability).toFixed(2));
}

function normalizeMarketProbabilities(home: number, draw: number, away: number): {
  home: number;
  draw: number;
  away: number;
} {
  const safeHome = Math.max(0.05, home);
  const safeDraw = Math.max(0.08, draw);
  const safeAway = Math.max(0.05, away);
  const total = safeHome + safeDraw + safeAway;
  return {
    home: safeHome / total,
    draw: safeDraw / total,
    away: safeAway / total,
  };
}

function countHistoricalTitles(rows: Array<{ rank: number }>): number {
  return rows.filter((row) => row.rank === 1).length;
}

function latestArchivedSeasonRow<T extends { season: string }>(rows: T[], currentSeason: string): T | null {
  return rows
    .filter((row) => row.season !== currentSeason)
    .slice()
    .sort((left, right) => seasonSortValue(right.season) - seasonSortValue(left.season))[0] ?? null;
}

function compactRecord(row: OddsCurrentRow): string {
  return `W${row.wins} D${row.draws} L${row.losses}`;
}

function competitionBadgeTone(
  competition: 'division' | 'master' | 'trio' | 'cup' | 'master_cup',
): 'league' | 'master' | 'trio' | 'cup' {
  if (competition === 'master' || competition === 'master_cup') {
    return 'master';
  }
  if (competition === 'trio') {
    return 'trio';
  }
  if (competition === 'cup') {
    return 'cup';
  }
  return 'league';
}

function toOddsCurrentRow(row: {
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
} | null | undefined): OddsCurrentRow | null {
  if (!row) {
    return null;
  }
  return {
    teamId: row.teamId,
    teamName: row.teamName,
    rank: row.rank,
    played: row.played,
    points: row.points,
    profit: row.profit,
    spins: row.spins,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
  };
}

type SpotlightFixtureOdds = {
  homeTeam: string;
  awayTeam: string;
  homeOdds: string;
  drawOdds: string | null;
  awayOdds: string;
  allowsDraw: boolean;
  reason: string;
  confidence: string;
  context: string;
};

function buildDivisionForecastRules(division: string, teamCount: number): LeagueForecastRules {
  const normalized = division.trim().toLowerCase();
  const isChampions = normalized.includes('champion');
  return {
    titlePositions: [1],
    topHalfCutoff: Math.max(1, Math.ceil(teamCount / 2)),
    bottomPositions: [teamCount],
    promotionPositions: isChampions ? [] : [1],
    relegationPositions: [teamCount],
  };
}

function buildOddsConfidenceTag(args: {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  homeRow: OddsCurrentRow | null;
  awayRow: OddsCurrentRow | null;
  allowsDraw?: boolean;
}): string {
  const {
    homeProbability,
    drawProbability,
    awayProbability,
    homeRow,
    awayRow,
    allowsDraw = true,
  } = args;
  const selections = [
    { label: 'home', probability: homeProbability },
    ...(allowsDraw ? [{ label: 'draw', probability: drawProbability }] : []),
    { label: 'away', probability: awayProbability },
  ].sort((left, right) => right.probability - left.probability);
  const leader = selections[0];
  const second = selections[1];
  const gap = leader.probability - second.probability;
  const rankGap = homeRow && awayRow ? Math.abs(homeRow.rank - awayRow.rank) : 0;

  if (allowsDraw && (leader.label === 'draw' || drawProbability >= 0.3)) {
    return 'Draw live';
  }
  if (gap <= 0.05) {
    return 'Tight market';
  }
  if (gap >= 0.14 || leader.probability >= 0.58) {
    return 'Strong favourite';
  }
  if (rankGap >= 3 && ((leader.label === 'home' && (homeRow?.rank ?? 99) > (awayRow?.rank ?? 99)) || (leader.label === 'away' && (awayRow?.rank ?? 99) > (homeRow?.rank ?? 99)))) {
    return 'Upset live';
  }
  return 'Edge';
}

function buildFixtureContextTag(args: {
  competition: 'division' | 'master' | 'trio' | 'cup' | 'master_cup';
  homeRow: OddsCurrentRow | null;
  awayRow: OddsCurrentRow | null;
  homeDivision: string | null;
  awayDivision: string | null;
  teamCount: number;
}): string {
  const { competition, homeRow, awayRow, homeDivision, awayDivision, teamCount } = args;
  if (competition === 'division' || competition === 'master' || competition === 'trio') {
    if (homeRow && awayRow) {
      const halfCutoff = Math.max(1, Math.ceil(teamCount / 2));
      const rankGap = Math.abs(homeRow.rank - awayRow.rank);
      if (rankGap <= 1) {
        return 'Table neighbours';
      }
      if (homeRow.rank <= halfCutoff && awayRow.rank <= halfCutoff) {
        return 'Both top-half';
      }
      if (homeRow.rank > halfCutoff && awayRow.rank > halfCutoff) {
        return 'Bottom-half battle';
      }
      if ((homeRow.rank <= 2 && awayRow.rank >= Math.max(3, teamCount - 1)) || (awayRow.rank <= 2 && homeRow.rank >= Math.max(3, teamCount - 1))) {
        return 'Front-runner vs struggler';
      }
    }
    return competition === 'master' ? 'Master ladder clash' : competition === 'trio' ? 'Trio ladder clash' : 'Division ladder clash';
  }

  if (homeDivision && awayDivision && homeDivision === awayDivision) {
    return 'Same-tier knockout tie';
  }
  if (homeDivision && awayDivision) {
    return 'Lower-tier side punching up';
  }
  return 'Knockout tie';
}

function buildSpotlightFixtureOdds(args: {
  competition: 'division' | 'master' | 'trio' | 'cup' | 'master_cup';
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeRow: OddsCurrentRow | null;
  awayRow: OddsCurrentRow | null;
  profilesByTeamId: Map<number, OddsTeamProfile>;
  teamCount: number;
  homeDivision?: string | null;
  awayDivision?: string | null;
  homeSeed?: number | null;
  awaySeed?: number | null;
  allowsDraw?: boolean;
}): SpotlightFixtureOdds | null {
  const {
    competition,
    homeTeamId,
    awayTeamId,
    homeTeam,
    awayTeam,
    homeRow,
    awayRow,
    profilesByTeamId,
    teamCount,
    homeDivision = null,
    awayDivision = null,
    homeSeed = null,
    awaySeed = null,
    allowsDraw = true,
  } = args;

  if (!homeTeamId || !awayTeamId || !homeTeam || !awayTeam) {
    return null;
  }

  const homeProfile = profilesByTeamId.get(homeTeamId);
  const awayProfile = profilesByTeamId.get(awayTeamId);
  if (!homeProfile || !awayProfile) {
    return null;
  }

  const model = buildFixtureOdds({
    home: homeProfile,
    away: awayProfile,
    homeRow,
    awayRow,
    teamCount: Math.max(2, teamCount),
    competition,
    homeSeed,
    awaySeed,
  });

  let homeProbability = model.homeProbability;
  let drawProbability = model.drawProbability;
  let awayProbability = model.awayProbability;
  if (!allowsDraw) {
    const total = Math.max(0.001, homeProbability + awayProbability);
    homeProbability /= total;
    awayProbability /= total;
    drawProbability = 0;
  }

  return {
    homeTeam,
    awayTeam,
    homeOdds: probabilityToOdds(homeProbability).toFixed(2),
    drawOdds: allowsDraw ? probabilityToOdds(drawProbability).toFixed(2) : null,
    awayOdds: probabilityToOdds(awayProbability).toFixed(2),
    allowsDraw,
    reason: allowsDraw ? model.reason : `${model.reason}. Level profit goes to penalties.`,
    confidence: buildOddsConfidenceTag({
      homeProbability,
      drawProbability,
      awayProbability,
      homeRow,
      awayRow,
      allowsDraw,
    }),
    context: buildFixtureContextTag({
      competition,
      homeRow,
      awayRow,
      homeDivision,
      awayDivision,
      teamCount,
    }),
  };
}

type KickoffDayPhase = 'kickoff' | 'middle' | 'latter' | 'closing';

function getKickoffDayPhase(now = new Date()): {
  phase: KickoffDayPhase;
  label: string;
  line: string;
} {
  const hour = now.getHours();
  if (hour < 12) {
    return {
      phase: 'kickoff',
      label: 'Kickoff Phase',
      line: 'Kickoff tone: the game has started and these are the early exchanges.',
    };
  }
  if (hour < 17) {
    return {
      phase: 'middle',
      label: 'Middle Phase',
      line: 'Middle phase: this board is taking shape and momentum can still swing.',
    };
  }
  if (hour < 22) {
    return {
      phase: 'latter',
      label: 'Latter Phase',
      line: 'Latter phase: we are moving toward full-time pressure in this gameweek.',
    };
  }
  return {
    phase: 'closing',
    label: 'Closing Window',
    line: 'Urgency mode: a few moments left in this one before midnight lock.',
  };
}

function fixtureStatusForStudio(
  result: 'home' | 'away' | 'draw' | 'pending',
  hasEntrySignal: boolean,
  gwLocked: boolean,
  isCurrentGw: boolean,
): FixtureSlideStatusCode {
  if (result === 'pending') {
    return hasEntrySignal ? 'in_play' : 'pending';
  }
  if (!isCurrentGw) {
    return 'final_confirmed';
  }
  if (gwLocked) {
    return 'provisional';
  }
  return 'provisional';
}

function formatStudioOutcome(
  result: 'home' | 'away' | 'draw' | 'pending',
  homeTeam: string,
  awayTeam: string,
  statusCode: FixtureSlideStatusCode,
): string {
  if (statusCode === 'pending') {
    return 'Kick-off pending';
  }
  if (statusCode === 'in_play') {
    if (result === 'pending') {
      return 'Still in play';
    }
    if (result === 'draw') {
      return 'As it stands, level';
    }
    return `As it stands, ${result === 'home' ? homeTeam : awayTeam} lead`;
  }
  if (statusCode === 'provisional') {
    if (result === 'draw') {
      return 'As it stands, draw';
    }
    if (result === 'home' || result === 'away') {
      return `As it stands, winner was ${result === 'home' ? homeTeam : awayTeam}`;
    }
    return 'As it stands, result pending';
  }
  if (result === 'draw') {
    return 'Confirmed draw';
  }
  if (result === 'home' || result === 'away') {
    return `Confirmed winner: ${result === 'home' ? homeTeam : awayTeam}`;
  }
  return 'Confirmed result pending';
}

type SpotlightPulse = {
  id: number;
  message: string;
  teamId?: number;
};
type ScoreUpdateAlert = {
  id: number;
  headline: string;
  lines: string[];
  teamId?: number | null;
};

type DrawPoolDivision = {
  division: string;
  teams: Draw[];
};

type KickoffWheelStage = 'loading' | 'division' | 'division-result' | 'team' | 'team-result';

type KickoffSpinItem = {
  id: string;
  label: string;
  helper: string;
  badge?: JSX.Element | null;
  accent: string;
  textColor: string;
};

type KickoffSpinCarouselProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  items: KickoffSpinItem[];
  activeId?: string | null;
  lockedId?: string | null;
};

const KICKOFF_CAROUSEL_STEP_MS = 80;
const KICKOFF_CAROUSEL_SLOW_STEP_MS = 130;
const KICKOFF_CAROUSEL_HOLD_MS = 600;
const KICKOFF_CAROUSEL_START_DELAY_MS = 60;
const KICKOFF_CAROUSEL_PASSES = 2;

function waitForKickoffCarousel(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shuffleKickoffIds(ids: string[]): string[] {
  const shuffled = ids.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function buildKickoffCarouselRun(itemIds: string[], selectedId: string): { orderIds: string[]; stepIds: string[] } {
  const uniqueIds = Array.from(new Set(itemIds));
  if (!uniqueIds.includes(selectedId)) {
    uniqueIds.push(selectedId);
  }
  if (uniqueIds.length <= 1) {
    return { orderIds: uniqueIds, stepIds: uniqueIds };
  }

  const orderIds = shuffleKickoffIds(uniqueIds);
  const stepIds: string[] = [];
  let previousTail: string | null = null;
  const passCount = Math.max(KICKOFF_CAROUSEL_PASSES, uniqueIds.length <= 2 ? 5 : 4);

  for (let pass = 0; pass < passCount; pass += 1) {
    const shuffledPass = shuffleKickoffIds(uniqueIds);
    if (shuffledPass.length > 1 && shuffledPass[0] === previousTail) {
      [shuffledPass[0], shuffledPass[1]] = [shuffledPass[1], shuffledPass[0]];
    }
    stepIds.push(...shuffledPass);
    previousTail = shuffledPass[shuffledPass.length - 1] ?? previousTail;
  }

  if (stepIds[stepIds.length - 1] === selectedId) {
    const alternate = orderIds.find((id) => id !== selectedId) ?? null;
    if (alternate) {
      stepIds.push(alternate);
    }
  }
  stepIds.push(selectedId);

  return { orderIds, stepIds };
}

function orderKickoffItems(items: KickoffSpinItem[], orderIds: string[]): KickoffSpinItem[] {
  if (orderIds.length === 0) {
    return items;
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  const usedIds = new Set<string>();
  const orderedItems = orderIds
    .map((id) => {
      usedIds.add(id);
      return itemById.get(id) ?? null;
    })
    .filter((item): item is KickoffSpinItem => item !== null);
  const remainingItems = items.filter((item) => !usedIds.has(item.id));
  return [...orderedItems, ...remainingItems];
}

function KickoffSpinCarousel({
  eyebrow,
  title,
  subtitle,
  statusLabel,
  items,
  activeId,
  lockedId,
}: KickoffSpinCarouselProps) {
  const safeItems = items.length > 0
    ? items
    : [{
        id: 'waiting',
        label: 'Waiting',
        helper: 'Preparing spin',
        accent: '#f6bf4f',
        textColor: '#10213a',
      }];
  const activeItem = safeItems.find((item) => item.id === activeId) ?? safeItems[0];
  const isLocked = lockedId === activeItem.id;

  return (
    <section className="kickoff-wheel-card kickoff-carousel-card">
      <div className="kickoff-wheel-card-head">
        <span className="news-chip">{eyebrow}</span>
        <h3>{title}</h3>
        <p className="muted">{subtitle}</p>
      </div>
      <div className="kickoff-carousel-shell">
        <div
          className={`kickoff-carousel-spotlight${isLocked ? ' locked' : ' active'}`}
          style={{
            background: `linear-gradient(145deg, ${activeItem.accent}, rgba(255, 255, 255, 0.92))`,
            color: activeItem.textColor,
          }}
        >
          <span className="kickoff-carousel-state">{isLocked ? 'Locked In' : statusLabel}</span>
          {activeItem.badge ? <div className="kickoff-carousel-spotlight-badge">{activeItem.badge}</div> : null}
          <strong>{activeItem.label}</strong>
          <p>{activeItem.helper}</p>
        </div>
        <div className="kickoff-carousel-track">
          {safeItems.map((item) => {
            const isActive = item.id === activeItem.id;
            const itemLocked = item.id === lockedId;
            return (
              <div
                key={item.id}
                className={`kickoff-carousel-track-item${isActive ? ' active' : ''}${itemLocked ? ' locked' : ''}`}
              >
                <div className="kickoff-carousel-track-item-head">
                  {item.badge ? item.badge : <span className="kickoff-carousel-dot" style={{ background: item.accent }} aria-hidden="true" />}
                  <div className="kickoff-carousel-track-item-copy">
                    <strong>{item.label}</strong>
                    <span>{item.helper}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function GameshowPage() {
  const createLogRow = (entryType: 'free_spins' | 'bonus' = 'free_spins'): LogRow => ({
    entryType,
    profit: '',
    spins: '',
    stake: entryType === 'free_spins' ? '0.10' : '',
  });

  const [currentSeason, setCurrentSeason] = useState<string>('S1');
  const [currentGw, setCurrentGw] = useState<string>('GW1');
  const [cupDrawStarted, setCupDrawStarted] = useState(false);
  const [leagueTable, setLeagueTable] = useState<
    Record<
      string,
      Array<{ teamId: number; teamName: string; division: string; played: number; wins: number; draws: number; losses: number; points: number; profit: number; spins: number; rank: number }>
    >
  >({});
  const recapDivisionOrder = useMemo(() => {
    const baseOrder = getDivisionOrderForSeason(currentSeason);
    const presentDivisions = Object.keys(leagueTable).filter((division) => !/^(playoff|friendly)$/i.test(division));
    const merged = [...baseOrder, ...presentDivisions.filter((division) => !baseOrder.includes(division))];
    return sortDivisionNames(merged, currentSeason);
  }, [currentSeason, leagueTable]);
  const recapDivisionSet = useMemo(() => new Set(recapDivisionOrder), [recapDivisionOrder]);
  const [allLeagueFixtures, setAllLeagueFixtures] = useState<
    Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>
  >([]);
  const [leagueMovement, setLeagueMovement] = useState<Record<string, Record<number, number>>>({});
  const [masterLeagueTable, setMasterLeagueTable] = useState<MasterLeagueTableRow[]>([]);
  const [allMasterLeagueFixtures, setAllMasterLeagueFixtures] = useState<MasterLeagueFixture[]>([]);
  const [allMasterCupFixtures, setAllMasterCupFixtures] = useState<MasterCupFixture[]>([]);
  const [trioLeagueTable, setTrioLeagueTable] = useState<TrioLeagueTableRow[]>([]);
  const [allTrioLeagueFixtures, setAllTrioLeagueFixtures] = useState<TrioFixture[]>([]);
  const [tierLeagueTable, setTierLeagueTable] = useState<TierLeagueTableRow[]>([]);
  const [allTierLeagueFixtures, setAllTierLeagueFixtures] = useState<TierLeagueFixture[]>([]);
  const [masterLeagueMovement, setMasterLeagueMovement] = useState<Record<number, number>>({});
  const [masterLeagueBaselineGw, setMasterLeagueBaselineGw] = useState<string | null>(null);
  const [allTimeLeagues, setAllTimeLeagues] = useState<AllTimeLeaguesPayload | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamSeasonHistoryByTeamId, setTeamSeasonHistoryByTeamId] = useState<Record<number, TeamSeasonHistoryRow[]>>({});
  const [teamPredictionRaceBySeason, setTeamPredictionRaceBySeason] = useState<Record<string, Record<string, TeamSeasonPredictionRace>>>({});
  const [cupFixtures, setCupFixtures] = useState<CupFixture[]>([]);
  const [superCupFixtures, setSuperCupFixtures] = useState<SuperCupFixture[]>([]);
  const [drawError, setDrawError] = useState('');
  const [draw, setDraw] = useState<Draw | null>(null);
  const [drawPool, setDrawPool] = useState<DrawPoolDivision[]>([]);
  const [drawWheelStage, setDrawWheelStage] = useState<KickoffWheelStage | null>(null);
  const [selectedDrawDivision, setSelectedDrawDivision] = useState<DrawPoolDivision | null>(null);
  const [selectedDrawTeam, setSelectedDrawTeam] = useState<Draw | null>(null);
  const [activeDrawDivisionId, setActiveDrawDivisionId] = useState<string | null>(null);
  const [activeDrawTeamId, setActiveDrawTeamId] = useState<string | null>(null);
  const [divisionCarouselOrderIds, setDivisionCarouselOrderIds] = useState<string[]>([]);
  const [teamCarouselOrderIds, setTeamCarouselOrderIds] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictionsLocked, setPredictionsLocked] = useState(false);
  const [currentGwLocked, setCurrentGwLocked] = useState(false);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [predictionSlate, setPredictionSlate] = useState<PredictionSlateRow[]>([]);
  const [seasonPredictions, setSeasonPredictions] = useState<PredictionRow[]>([]);
  const [prevPredictionSlate, setPrevPredictionSlate] = useState<PredictionSlateRow[]>([]);
  const [prevPredictions, setPrevPredictions] = useState<PredictionRow[]>([]);
  const [spotlightPulse, setSpotlightPulse] = useState<SpotlightPulse | null>(null);
  const [scoreUpdateAlert, setScoreUpdateAlert] = useState<ScoreUpdateAlert | null>(null);
  const [lastCompletedGameweek, setLastCompletedGameweek] = useState<LastCompletedContext | null>(null);
  const [prevLeagueFixtures, setPrevLeagueFixtures] = useState<
    Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>
  >([]);
  const [prevCupFixtures, setPrevCupFixtures] = useState<CupFixture[]>([]);
  const [prevMasterLeagueFixtures, setPrevMasterLeagueFixtures] = useState<MasterLeagueFixture[]>([]);
  const [prevMasterCupFixtures, setPrevMasterCupFixtures] = useState<MasterCupFixture[]>([]);
  const [prevTrioLeagueFixtures, setPrevTrioLeagueFixtures] = useState<TrioFixture[]>([]);
  const [prevTierLeagueFixtures, setPrevTierLeagueFixtures] = useState<TierLeagueFixture[]>([]);
  const [recapPredictionScores, setRecapPredictionScores] = useState<PredictionScoreboard | null>(null);
  const [bookieDorBoard, setBookieDorBoard] = useState<BookieDorBoard | null>(null);
  const [currentGwEntries, setCurrentGwEntries] = useState<EntryRow[]>([]);
  const [predictionScores, setPredictionScores] = useState<PredictionScoreboard | null>(null);
  const [seasonOneScores, setSeasonOneScores] = useState<PredictionScoreboard | null>(null);
  const [predictionSelections, setPredictionSelections] = useState<Record<string, 'home' | 'away' | 'draw'>>({});
  const [predictionMessage, setPredictionMessage] = useState('');
  const [predictionSaving, setPredictionSaving] = useState(false);
  const [fixtureSetupBusy, setFixtureSetupBusy] = useState<'league' | 'master' | 'trio' | null>(null);
  const [fixtureSetupNotice, setFixtureSetupNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [seasonFinale, setSeasonFinale] = useState<SeasonFinale | null>(null);
  const [storylinePayload, setStorylinePayload] = useState<StorylinePayload | null>(null);
  const [finaleSlide, setFinaleSlide] = useState(0);
  const location = useLocation();
  const [kickoffFlowStep, setKickoffFlowStep] = useState<KickoffFlowStep>('results');
  const [recapFixturePageIndex, setRecapFixturePageIndex] = useState(0);

  const [logRows, setLogRows] = useState<LogRow[]>([createLogRow()]);
  const [opponentPreviewProfit, setOpponentPreviewProfit] = useState(0);

  const predictionsInitialized = useRef(false);
  const drawWindowRef = useRef<Window | null>(null);
  const drawSequenceRef = useRef(0);

  const finaleSlides = useMemo(() => {
    return buildSeasonFinaleSlides(seasonFinale?.payload ?? null);
  }, [seasonFinale]);

  useEffect(() => {
    if (!seasonFinale || finaleSlides.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setFinaleSlide((prev) => (prev + 1) % finaleSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [finaleSlides.length, seasonFinale]);

  useEffect(() => {
    if (location.hash !== '#season-finale' && location.hash !== '#finale') {
      return;
    }
    const el = document.getElementById('season-finale');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [finaleSlides.length, location.hash, seasonFinale]);

  useEffect(() => {
    setKickoffFlowStep('results');
  }, [currentGw]);

  useEffect(() => {
    setRecapFixturePageIndex(0);
  }, [currentGw]);

  useEffect(() => {
    predictionsInitialized.current = false;
    setPredictionSelections({});
  }, [currentGw, currentSeason]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const state = await api.state();
      if (!mounted) {
        return;
      }
      const seasonFiveOrLater = isSeasonFiveOrLater(state.currentSeason);
      const seasonSixOrLater = isSeasonSixOrLater(state.currentSeason);
      const [
        table,
        fixtures,
        movementPayload,
        masterLeaguePayload,
        masterLeagueFixtures,
        masterCupFixtures,
        trioLeagueTablePayload,
        trioLeagueFixtures,
        tierLeagueTablePayload,
        tierLeagueFixtures,
        teamList,
        cup,
        superCup,
        seasonEntries,
        entriesForCurrentGw,
        predictionResponse,
        scoreboard,
        seasonOneScoreboard,
        finaleResponse,
        predictionRowsByGw,
        storylineResponse,
        allTimeLeaguesResponse,
        lastCompletedResponse,
        bookieDorResponse,
      ] = await Promise.all([
        api.leagueTable(),
        api.leagueFixtures(undefined, true),
        api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} as Record<string, Record<number, number>> })),
        api.masterLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, baselineGw: null, movement: {} as Record<number, number>, table: [] as MasterLeagueTableRow[] })),
        api.masterLeagueFixtures(undefined, true).catch(() => [] as MasterLeagueFixture[]),
        seasonFiveOrLater
          ? api.masterCupFixtures(undefined, true).catch(() => [] as MasterCupFixture[])
          : Promise.resolve([] as MasterCupFixture[]),
        api.trioLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, enabled: false, table: [] as TrioLeagueTableRow[] })),
        api.trioLeagueFixtures(undefined, true).catch(() => [] as TrioFixture[]),
        seasonSixOrLater
          ? api.tierLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, enabled: false, started: false, table: [] as TierLeagueTableRow[] }))
          : Promise.resolve({ gw: state.currentGw, enabled: false, started: false, table: [] as TierLeagueTableRow[] }),
        seasonSixOrLater
          ? api.tierLeagueFixtures(undefined, true).catch(() => [] as TierLeagueFixture[])
          : Promise.resolve([] as TierLeagueFixture[]),
        api.teams().catch(() => []),
        api.cup().catch(() => []),
        api.superCup(state.currentSeason).catch(() => [] as SuperCupFixture[]),
        api.entries({ limit: 2000 }).catch(() => [] as EntryRow[]),
        api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => [] as EntryRow[]),
        api.predictions(state.currentGw).catch(() => ({ season: state.currentSeason, gw: state.currentGw, locked: false, slate: [] as PredictionSlateRow[], predictions: [] as PredictionRow[] })),
        api.predictionScoreboard().catch(() => null),
        api.predictionScoreboard('S1').catch(() => null),
        api.seasonFinale().catch(() => ({ pending: false as const })),
        Promise.all(
          GAMEWEEKS.map((gw) =>
            api
              .predictions(gw)
              .then((response) => response.predictions)
              .catch(() => [] as PredictionRow[]),
          ),
        ),
        api.reportStorylines(state.currentGw).catch(() => null),
        api.allTimeLeagues().catch(() => null),
        api.lastCompletedGameweek().catch(() => ({
          currentSeason: state.currentSeason,
          currentGw: state.currentGw,
          lastCompleted: null as { season: string; gw: string } | null,
        })),
        api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
      ]);
      const historyResponse = await api.teamSeasonHistoryBulk(teamList.map((team) => team.id)).catch(() => ({ histories: {} as Record<number, TeamSeasonHistoryRow[]> }));
      const historySeasons = Object.values(historyResponse.histories)
        .flat()
        .map((row) => row.season)
        .filter((season): season is string => /^S\d+$/.test(season));
      const seasonsToScan = Array.from(new Set([state.currentSeason, ...historySeasons]))
        .sort((a, b) => seasonSortValue(a) - seasonSortValue(b));
      const teamPredictionRaceEntries = await Promise.all(
        seasonsToScan.map(async (season) => {
          const [seasonLeagueFixtures, seasonCupFixtures, seasonPredictionRowsByGw] = await Promise.all([
            api.leagueFixtures(undefined, true, season).catch(() => []),
            api.cup(undefined, season).catch(() => []),
            Promise.all(
              GAMEWEEKS.map((gw) =>
                api
                  .predictions(gw, season)
                  .then((response) => response.predictions)
                  .catch(() => [] as PredictionRow[]),
              ),
            ),
          ]);
          const seasonPredictionByKey = new Map<string, PredictionRow>();
          seasonPredictionRowsByGw.flat().forEach((prediction) => {
            seasonPredictionByKey.set(
              `${prediction.gw}-${prediction.competition}-${prediction.fixtureId}-${prediction.picker}`,
              prediction,
            );
          });
          const raceByTeam = new Map<string, TeamSeasonPredictionRace>();
          const ensureTeamRace = (teamName: string): TeamSeasonPredictionRace => {
            const existing = raceByTeam.get(teamName);
            if (existing) {
              return existing;
            }
            const next = { jayCorrect: 0, computerCorrect: 0, resolved: 0 };
            raceByTeam.set(teamName, next);
            return next;
          };
          seasonLeagueFixtures.forEach((fixture) => {
            if (fixture.result === 'pending') {
              return;
            }
            const winnerName =
              fixture.result === 'draw'
                ? null
                : fixture.result === 'home'
                  ? fixture.homeTeam
                  : fixture.awayTeam;
            [fixture.homeTeam, fixture.awayTeam].forEach((teamName) => {
              const row = ensureTeamRace(teamName);
              row.resolved += 1;
              const jayPick = seasonPredictionByKey.get(`${fixture.gw}-league-${fixture.id}-Jay`);
              if (
                jayPick
                && (
                  (jayPick.pickOutcome === 'draw' && fixture.result === 'draw')
                  || (jayPick.pickOutcome === 'team' && winnerName !== null && jayPick.pickTeamName === winnerName)
                )
              ) {
                row.jayCorrect += 1;
              }
              const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-league-${fixture.id}-Computer`);
              if (
                cpuPick
                && (
                  (cpuPick.pickOutcome === 'draw' && fixture.result === 'draw')
                  || (cpuPick.pickOutcome === 'team' && winnerName !== null && cpuPick.pickTeamName === winnerName)
                )
              ) {
                row.computerCorrect += 1;
              }
            });
          });
          seasonCupFixtures.forEach((fixture) => {
            if (!fixture.winnerTeam) {
              return;
            }
            const participating = new Set(
              [fixture.homeTeam, fixture.awayTeam, fixture.winnerTeam].filter((name): name is string => Boolean(name)),
            );
            participating.forEach((teamName) => {
              const row = ensureTeamRace(teamName);
              row.resolved += 1;
              const jayPick = seasonPredictionByKey.get(`${fixture.gw}-cup-${fixture.id}-Jay`);
              if (jayPick && jayPick.pickOutcome !== 'draw' && jayPick.pickTeamName === fixture.winnerTeam) {
                row.jayCorrect += 1;
              }
              const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-cup-${fixture.id}-Computer`);
              if (cpuPick && cpuPick.pickOutcome !== 'draw' && cpuPick.pickTeamName === fixture.winnerTeam) {
                row.computerCorrect += 1;
              }
            });
          });
          return [season, Object.fromEntries(raceByTeam.entries())] as const;
        }),
      );
      const teamPredictionRaceBySeasonPayload = Object.fromEntries(teamPredictionRaceEntries);

      if (!mounted) {
        return;
      }
      setCurrentSeason(state.currentSeason);
      setCurrentGw(state.currentGw);
      setCurrentGwLocked(state.gwLocked);
      setCupDrawStarted(state.cupDrawStarted);
      setLeagueTable(table);
      setAllLeagueFixtures(fixtures);
      setLeagueMovement(movementPayload.movement ?? {});
      setMasterLeagueTable(masterLeaguePayload.table ?? []);
      setAllMasterLeagueFixtures(masterLeagueFixtures);
      setAllMasterCupFixtures(masterCupFixtures);
      setTrioLeagueTable(trioLeagueTablePayload.table ?? []);
      setAllTrioLeagueFixtures(trioLeagueFixtures);
      setTierLeagueTable(tierLeagueTablePayload.table ?? []);
      setAllTierLeagueFixtures(tierLeagueFixtures);
      setMasterLeagueMovement(masterLeaguePayload.movement ?? {});
      setMasterLeagueBaselineGw(masterLeaguePayload.baselineGw ?? null);
      setTeams(teamList);
      setTeamSeasonHistoryByTeamId(
        Object.fromEntries(
          teamList.map((team) => [team.id, historyResponse.histories[team.id] ?? [] as TeamSeasonHistoryRow[]]),
        ),
      );
      setTeamPredictionRaceBySeason(teamPredictionRaceBySeasonPayload);
      setCupFixtures(recoverCupFixturesFromEntries(cup as CupFixture[], seasonEntries, state.currentSeason));
      setSuperCupFixtures(superCup);
      setCurrentGwEntries(entriesForCurrentGw);
      setPredictions(predictionResponse.predictions);
      setPredictionSlate(predictionResponse.slate ?? []);
      setSeasonPredictions(predictionRowsByGw.flat());
      setPredictionsLocked(predictionResponse.locked);
      setLastCompletedGameweek(lastCompletedResponse.lastCompleted);
      setBookieDorBoard(bookieDorResponse);
      setPredictionScores(scoreboard);
      setSeasonOneScores(seasonOneScoreboard);
      setStorylinePayload(storylineResponse);
      setAllTimeLeagues(allTimeLeaguesResponse);
      if ('pending' in finaleResponse && finaleResponse.pending === false) {
        setSeasonFinale(null);
      } else {
        setSeasonFinale(finaleResponse as SeasonFinale);
        setFinaleSlide(0);
      }
      predictionsInitialized.current = false;
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const sortDrawTeamsForDivision = useCallback((division: string, teamsToSort: Draw[]): Draw[] => {
    const rankByTeamId = new Map((leagueTable[division] ?? []).map((row) => [row.teamId, row.rank]));
    return teamsToSort
      .slice()
      .sort((left, right) => {
        const leftRank = rankByTeamId.get(left.teamId) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = rankByTeamId.get(right.teamId) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.teamName.localeCompare(right.teamName);
      });
  }, [leagueTable]);

  const startDrawSequence = useCallback(async () => {
    const sequenceId = drawSequenceRef.current + 1;
    drawSequenceRef.current = sequenceId;
    setLoading(true);
    setDraw(null);
    setShowLog(false);
    setDrawPool([]);
    setDrawWheelStage('loading');
    setSelectedDrawDivision(null);
    setSelectedDrawTeam(null);
    setActiveDrawDivisionId(null);
    setActiveDrawTeamId(null);
    setDivisionCarouselOrderIds([]);
    setTeamCarouselOrderIds([]);

    try {
      const pool = await api.gameshowDrawPool();
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }

      const orderedPool = getDivisionOrderForSeason(currentSeason)
        .map((division) => pool.find((group) => group.division === division))
        .filter((group): group is DrawPoolDivision => !!group)
        .map((group) => ({
          division: group.division,
          teams: sortDrawTeamsForDivision(group.division, group.teams),
        }));

      if (orderedPool.length === 0) {
        setDrawWheelStage(null);
        setDrawError('All teams already drawn for this gameweek');
        return;
      }

      setDrawPool(orderedPool);
      const divisionGroup = orderedPool[Math.floor(Math.random() * orderedPool.length)];
      const divisionRun = buildKickoffCarouselRun(
        orderedPool.map((group) => group.division),
        divisionGroup.division,
      );

      setDivisionCarouselOrderIds(divisionRun.orderIds);
      setDrawWheelStage('division');
      await waitForKickoffCarousel(KICKOFF_CAROUSEL_START_DELAY_MS);
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }

      for (let index = 0; index < divisionRun.stepIds.length; index += 1) {
        setActiveDrawDivisionId(divisionRun.stepIds[index]);
        await waitForKickoffCarousel(index >= divisionRun.stepIds.length - 3 ? KICKOFF_CAROUSEL_SLOW_STEP_MS : KICKOFF_CAROUSEL_STEP_MS);
        if (drawSequenceRef.current !== sequenceId) {
          return;
        }
      }

      setActiveDrawDivisionId(divisionGroup.division);
      setSelectedDrawDivision(divisionGroup);
      setDrawWheelStage('division-result');
      await waitForKickoffCarousel(KICKOFF_CAROUSEL_HOLD_MS);
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }

      const queuedTeam = divisionGroup.teams[Math.floor(Math.random() * divisionGroup.teams.length)];
      const teamRun = buildKickoffCarouselRun(
        divisionGroup.teams.map((team) => String(team.teamId)),
        String(queuedTeam.teamId),
      );
      setTeamCarouselOrderIds(teamRun.orderIds);
      setDrawWheelStage('team');
      await waitForKickoffCarousel(KICKOFF_CAROUSEL_START_DELAY_MS);
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }

      for (let index = 0; index < teamRun.stepIds.length; index += 1) {
        setActiveDrawTeamId(teamRun.stepIds[index]);
        await waitForKickoffCarousel(index >= teamRun.stepIds.length - 3 ? KICKOFF_CAROUSEL_SLOW_STEP_MS : KICKOFF_CAROUSEL_STEP_MS);
        if (drawSequenceRef.current !== sequenceId) {
          return;
        }
      }

      setActiveDrawTeamId(String(queuedTeam.teamId));
      const picked = await api.drawTeam(queuedTeam.teamId);
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }

      setSelectedDrawTeam(picked);
      setDraw(picked);
      setShowLog(true);
      setDrawWheelStage('team-result');
      await waitForKickoffCarousel(KICKOFF_CAROUSEL_HOLD_MS);
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }

      setDrawWheelStage(null);
    } catch (error) {
      if (drawSequenceRef.current !== sequenceId) {
        return;
      }
      setDraw(null);
      setDrawPool([]);
      setSelectedDrawDivision(null);
      setSelectedDrawTeam(null);
      setActiveDrawDivisionId(null);
      setActiveDrawTeamId(null);
      setDivisionCarouselOrderIds([]);
      setTeamCarouselOrderIds([]);
      setDrawWheelStage(null);
      setDrawError(error instanceof Error ? error.message : 'Unable to draw team');
    } finally {
      if (drawSequenceRef.current === sequenceId) {
        setLoading(false);
      }
    }
  }, [currentSeason, sortDrawTeamsForDivision]);

  useEffect(() => {
    drawSequenceRef.current += 1;
    setDraw(null);
    setDrawError('');
    setShowLog(false);
    setLoading(false);
    setDrawPool([]);
    setDrawWheelStage(null);
    setSelectedDrawDivision(null);
    setSelectedDrawTeam(null);
    setActiveDrawDivisionId(null);
    setActiveDrawTeamId(null);
    setDivisionCarouselOrderIds([]);
    setTeamCarouselOrderIds([]);
  }, [currentGw, currentSeason]);

  useEffect(() => () => {
    drawSequenceRef.current += 1;
  }, []);

  useEffect(() => {
    if (!draw) {
      return;
    }
    setLogRows([createLogRow()]);
  }, [draw?.teamId]);

  useEffect(() => {
    if (!draw) {
      return;
    }
    const timer = window.setTimeout(() => {
      const target = drawWindowRef.current;
      if (target && !target.closed) {
        try {
          target.location.href = draw.teamUrl;
          target.focus();
          return;
        } catch (error) {
          drawWindowRef.current = null;
        }
      }
      window.open(draw.teamUrl, '_blank', 'noopener,noreferrer');
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [draw]);

  const teamIdByName = useMemo(() => new Map(teams.map((team) => [team.name, team.id])), [teams]);
  const teamMetaByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  const currentLeagueFixtures = useMemo(
    () => allLeagueFixtures.filter((fixture) => fixture.gw === currentGw),
    [allLeagueFixtures, currentGw],
  );
  const currentLeagueFixtureById = useMemo(
    () => new Map(currentLeagueFixtures.map((fixture) => [fixture.id, fixture])),
    [currentLeagueFixtures],
  );
  const currentCupFixtures = useMemo(
    () => cupFixtures.filter((fixture) => fixture.gw === currentGw),
    [cupFixtures, currentGw],
  );
  const currentSuperCupFixtures = useMemo(
    () => superCupFixtures.filter((fixture) => fixture.gw === currentGw),
    [superCupFixtures, currentGw],
  );
  const currentMasterLeagueFixtures = useMemo(
    () => allMasterLeagueFixtures.filter((fixture) => fixture.gw === currentGw),
    [allMasterLeagueFixtures, currentGw],
  );
  const currentMasterCupFixtures = useMemo(
    () => allMasterCupFixtures.filter((fixture) => fixture.gw === currentGw),
    [allMasterCupFixtures, currentGw],
  );
  const currentTrioLeagueFixtures = useMemo(
    () => allTrioLeagueFixtures.filter((fixture) => fixture.gw === currentGw),
    [allTrioLeagueFixtures, currentGw],
  );
  const currentTierLeagueFixtures = useMemo(
    () => allTierLeagueFixtures.filter((fixture) => fixture.gw === currentGw),
    [allTierLeagueFixtures, currentGw],
  );
  const currentCupFixtureById = useMemo(
    () => new Map(currentCupFixtures.map((fixture) => [fixture.id, fixture])),
    [currentCupFixtures],
  );
  const currentMasterLeagueFixtureById = useMemo(
    () => new Map(currentMasterLeagueFixtures.map((fixture) => [fixture.id, fixture])),
    [currentMasterLeagueFixtures],
  );
  const currentMasterCupFixtureById = useMemo(
    () => new Map(currentMasterCupFixtures.map((fixture) => [fixture.id, fixture])),
    [currentMasterCupFixtures],
  );
  const currentTrioLeagueFixtureById = useMemo(
    () => new Map(currentTrioLeagueFixtures.map((fixture) => [fixture.id, fixture])),
    [currentTrioLeagueFixtures],
  );
  const currentTierLeagueFixtureById = useMemo(
    () => new Map(currentTierLeagueFixtures.map((fixture) => [fixture.id, fixture])),
    [currentTierLeagueFixtures],
  );
  const predictionSlateFixtures = useMemo(() => {
    return predictionSlate
      .map((entry): PredictionSlateFixture | null => {
        const key = `${entry.competition}-${entry.fixtureId}`;
        if (entry.competition === 'league') {
          const fixture = currentLeagueFixtureById.get(entry.fixtureId);
          if (!fixture) {
            return null;
          }
          return {
            key,
            competition: entry.competition,
            fixtureId: entry.fixtureId,
            competitionLabel: predictionCompetitionLabel(entry.competition),
            detailLabel: displayDivisionName(fixture.division),
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamId: teamIdByName.get(fixture.homeTeam) ?? null,
            awayTeamId: teamIdByName.get(fixture.awayTeam) ?? null,
            allowsDraw: leagueFixtureAllowsDraw(fixture),
          };
        }
        if (entry.competition === 'cup') {
          const fixture = currentCupFixtureById.get(entry.fixtureId);
          if (!fixture || !fixture.homeTeam || !fixture.awayTeam) {
            return null;
          }
          return {
            key,
            competition: entry.competition,
            fixtureId: entry.fixtureId,
            competitionLabel: predictionCompetitionLabel(entry.competition),
            detailLabel: fixture.roundName,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamId: teamIdByName.get(fixture.homeTeam) ?? null,
            awayTeamId: teamIdByName.get(fixture.awayTeam) ?? null,
            allowsDraw: false,
          };
        }
        if (entry.competition === 'master') {
          const fixture = currentMasterLeagueFixtureById.get(entry.fixtureId);
          if (!fixture) {
            return null;
          }
          return {
            key,
            competition: entry.competition,
            fixtureId: entry.fixtureId,
            competitionLabel: predictionCompetitionLabel(entry.competition),
            detailLabel: currentGw,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            allowsDraw: true,
          };
        }
        if (entry.competition === 'master_cup') {
          const fixture = currentMasterCupFixtureById.get(entry.fixtureId);
          if (!fixture || !fixture.homeTeam || !fixture.awayTeam) {
            return null;
          }
          return {
            key,
            competition: entry.competition,
            fixtureId: entry.fixtureId,
            competitionLabel: predictionCompetitionLabel(entry.competition),
            detailLabel: fixture.roundName,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            allowsDraw: fixture.stage === 'semi_final',
          };
        }
        if (entry.competition === 'trio') {
          const fixture = currentTrioLeagueFixtureById.get(entry.fixtureId);
          if (!fixture) {
            return null;
          }
          return {
            key,
            competition: entry.competition,
            fixtureId: entry.fixtureId,
            competitionLabel: predictionCompetitionLabel(entry.competition),
            detailLabel: fixture.stage === 'regular' ? fixture.division : `${fixture.division} • ${trioStageLabel(fixture)}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            allowsDraw: trioFixtureAllowsDraw(fixture),
          };
        }
        const fixture = currentTierLeagueFixtureById.get(entry.fixtureId);
        if (!fixture) {
          return null;
        }
        const detailLabel = fixture.fixtureType === 'cross'
          ? `Cross-Tier • ${(fixture.homeDivision ?? 'Unknown')} vs ${(fixture.awayDivision ?? 'Unknown')}`
          : fixture.division;
        return {
          key,
          competition: entry.competition,
          fixtureId: entry.fixtureId,
          competitionLabel: predictionCompetitionLabel(entry.competition),
          detailLabel,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          allowsDraw: true,
        };
      })
      .filter((fixture): fixture is PredictionSlateFixture => fixture !== null);
  }, [
    currentCupFixtureById,
    currentGw,
    currentLeagueFixtureById,
    currentMasterCupFixtureById,
    currentMasterLeagueFixtureById,
    currentTierLeagueFixtureById,
    currentTrioLeagueFixtureById,
    predictionSlate,
    teamIdByName,
  ]);
  const oddsProfileByTeamId = useMemo(() => {
    return new Map<number, OddsTeamProfile>(
      teams.map((team) => [
        team.id,
        {
          teamId: team.id,
          teamName: team.name,
          preseasonFavorite: team.preseasonFavorite,
          history: teamSeasonHistoryByTeamId[team.id] ?? [],
        },
      ]),
    );
  }, [teamSeasonHistoryByTeamId, teams]);
  const divisionOddsRowByTeamId = useMemo(() => {
    const map = new Map<number, OddsCurrentRow>();
    recapDivisionOrder.forEach((division) => {
      (leagueTable[division] ?? []).forEach((row) => {
        map.set(row.teamId, toOddsCurrentRow(row)!);
      });
    });
    return map;
  }, [leagueTable, recapDivisionOrder]);
  const masterOddsRowByTeamId = useMemo(
    () => new Map(masterLeagueTable.map((row) => [row.teamId, toOddsCurrentRow(row)!])),
    [masterLeagueTable],
  );
  const trioOddsRowByTeamId = useMemo(
    () => new Map(trioLeagueTable.map((row) => [row.teamId, toOddsCurrentRow(row)!])),
    [trioLeagueTable],
  );
  const divisionForecastByTeamId = useMemo(() => {
    const forecasts = new Map<number, LeagueForecastRow>();

    recapDivisionOrder.forEach((division) => {
      const rows = (leagueTable[division] ?? [])
        .slice()
        .sort(compareLeagueRowsByRank)
        .map((row) => toOddsCurrentRow(row))
        .filter((row): row is OddsCurrentRow => row !== null);

      if (rows.length === 0) {
        return;
      }

      const trendsByTeamId = new Map<number, LeagueForecastTrend>(
        rows.map((row) => [row.teamId, teamMetaByName.get(row.teamName)?.trendCache ?? null]),
      );

      const remainingFixtures = allLeagueFixtures
        .filter((fixture) => fixture.division === division && fixture.result === 'pending' && OFFICIAL_DIVISION_GAMEWEEKS.includes(fixture.gw))
        .map((fixture) => {
          const homeTeamId = teamIdByName.get(fixture.homeTeam) ?? null;
          const awayTeamId = teamIdByName.get(fixture.awayTeam) ?? null;
          if (!homeTeamId || !awayTeamId) {
            return null;
          }
          return {
            id: fixture.id,
            homeTeamId,
            awayTeamId,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
          };
        })
        .filter((fixture): fixture is NonNullable<typeof fixture> => fixture !== null);

      buildLeagueForecastTable({
        rows,
        profilesByTeamId: oddsProfileByTeamId,
        trendsByTeamId,
        remainingFixtures,
        rules: buildDivisionForecastRules(division, rows.length),
        seedKey: `${currentSeason}:${currentGw}:${division}`,
      }).forEach((value, teamId) => {
        forecasts.set(teamId, value);
      });
    });

    return forecasts;
  }, [allLeagueFixtures, currentGw, currentSeason, leagueTable, oddsProfileByTeamId, recapDivisionOrder, teamIdByName, teamMetaByName]);
  const kickoffDayPhase = useMemo(
    () => getKickoffDayPhase(),
    [currentGw, currentGwEntries.length, currentGwLocked],
  );
  const studioTruthLabel = currentGwLocked ? 'PROVISIONAL' : 'LIVE';
  const recapTarget = useMemo<LastCompletedContext | null>(() => {
    if (lastCompletedGameweek) {
      return lastCompletedGameweek;
    }
    const idx = GAMEWEEKS.indexOf(currentGw);
    if (idx > 0) {
      return { season: currentSeason, gw: GAMEWEEKS[idx - 1] ?? 'GW1' };
    }
    return null;
  }, [currentGw, currentSeason, lastCompletedGameweek]);
  const recapTargetLabel = recapTarget ? `${recapTarget.season} ${recapTarget.gw}` : null;

  useEffect(() => {
    let active = true;
    if (!recapTarget) {
      setPrevPredictionSlate([]);
      setPrevPredictions([]);
      setPrevLeagueFixtures([]);
      setPrevCupFixtures([]);
      setPrevMasterLeagueFixtures([]);
      setPrevMasterCupFixtures([]);
      setPrevTrioLeagueFixtures([]);
      setPrevTierLeagueFixtures([]);
      setRecapPredictionScores(null);
      return undefined;
    }

    Promise.all([
      api.predictions(recapTarget.gw, recapTarget.season).catch(() => ({ season: recapTarget.season, gw: recapTarget.gw, locked: false, slate: [] as PredictionSlateRow[], predictions: [] as PredictionRow[] })),
      api.leagueFixtures(recapTarget.gw, false, recapTarget.season).catch(() => [] as Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>),
      api.cup(recapTarget.gw, recapTarget.season).catch(() => [] as CupFixture[]),
      api.masterLeagueFixtures(recapTarget.gw, false, recapTarget.season).catch(() => [] as MasterLeagueFixture[]),
      api.masterCupFixtures(recapTarget.gw, false, recapTarget.season).catch(() => [] as MasterCupFixture[]),
      api.trioLeagueFixtures(recapTarget.gw, false, recapTarget.season).catch(() => [] as TrioFixture[]),
      api.tierLeagueFixtures(recapTarget.gw, false, recapTarget.season).catch(() => [] as TierLeagueFixture[]),
      api.predictionScoreboard(recapTarget.season).catch(() => null),
    ]).then(([predictionResponse, leagueRows, cupRows, masterLeagueRows, masterCupRows, trioRows, tierRows, recapScoreboard]) => {
      if (!active) {
        return;
      }
      setPrevPredictionSlate(predictionResponse.slate ?? []);
      setPrevPredictions(predictionResponse.predictions);
      setPrevLeagueFixtures(leagueRows);
      setPrevCupFixtures(cupRows);
      setPrevMasterLeagueFixtures(masterLeagueRows);
      setPrevMasterCupFixtures(masterCupRows);
      setPrevTrioLeagueFixtures(trioRows);
      setPrevTierLeagueFixtures(tierRows);
      setRecapPredictionScores(recapScoreboard);
    }).catch(() => {
      if (!active) {
        return;
      }
      setPrevPredictionSlate([]);
      setPrevPredictions([]);
      setPrevLeagueFixtures([]);
      setPrevCupFixtures([]);
      setPrevMasterLeagueFixtures([]);
      setPrevMasterCupFixtures([]);
      setPrevTrioLeagueFixtures([]);
      setPrevTierLeagueFixtures([]);
      setRecapPredictionScores(null);
    });

    return () => {
      active = false;
    };
  }, [recapTarget]);

  useEffect(() => {
    let active = true;
    api
      .entries({ gw: currentGw, limit: 1000 })
      .then((rows) => {
        if (active) {
          setCurrentGwEntries(rows as EntryRow[]);
        }
      })
      .catch(() => {
        if (active) {
          setCurrentGwEntries([]);
        }
      });
    return () => {
      active = false;
    };
  }, [currentGw]);

  useEffect(() => {
    let active = true;
    api
      .state()
      .then((state) => {
        if (!active) {
          return;
        }
        if (state.currentGw === currentGw) {
          setCurrentGwLocked(state.gwLocked);
        }
      })
      .catch(() => {
        if (active) {
          setCurrentGwLocked(false);
        }
      });
    return () => {
      active = false;
    };
  }, [currentGw]);

  useEffect(() => {
    let active = true;
    api.reportStorylines(currentGw)
      .then((payload) => {
        if (active) {
          setStorylinePayload(payload);
        }
      })
      .catch(() => {
        if (active) {
          setStorylinePayload(null);
        }
      });
    return () => {
      active = false;
    };
  }, [currentGw]);

  const jayPredictions = useMemo(() => predictions.filter((row) => row.picker === 'Jay'), [predictions]);
  const currentPredictionMap = useMemo(() => {
    const map = new Map<string, Record<string, PredictionRow>>();
    predictions.forEach((row) => {
      if (row.competition === 'league' && row.pickOutcome === 'draw') {
        const fixture = currentLeagueFixtureById.get(row.fixtureId);
        if (fixture && !leagueFixtureAllowsDraw(fixture)) {
          return;
        }
      }
      if (row.competition === 'trio' && row.pickOutcome === 'draw') {
        const fixture = currentTrioLeagueFixtures.find((entry) => entry.id === row.fixtureId);
        if (fixture && !trioFixtureAllowsDraw(fixture)) {
          return;
        }
      }
      const key = `${row.competition}-${row.fixtureId}`;
      const entry = map.get(key) ?? {};
      entry[row.picker] = row;
      map.set(key, entry);
    });
    return map;
  }, [currentLeagueFixtureById, currentTrioLeagueFixtures, predictions]);

  const prevPredictionMap = useMemo(() => {
    const map = new Map<string, Record<string, PredictionRow>>();
    prevPredictions.forEach((row) => {
      const key = `${row.competition}-${row.fixtureId}`;
      const entry = map.get(key) ?? {};
      entry[row.picker] = row;
      map.set(key, entry);
    });
    return map;
  }, [prevPredictions]);

  const pickLabel = (row?: PredictionRow): string => {
    if (!row) {
      return '—';
    }
    return row.pickOutcome === 'draw' ? 'Draw' : row.pickTeamName;
  };

  const previousPredictionRecapRows = useMemo<PredictionRecapFixtureRow[]>(() => {
    const leagueById = new Map(prevLeagueFixtures.map((fixture) => [fixture.id, fixture]));
    const cupById = new Map(prevCupFixtures.map((fixture) => [fixture.id, fixture]));
    const masterById = new Map(prevMasterLeagueFixtures.map((fixture) => [fixture.id, fixture]));
    const masterCupById = new Map(prevMasterCupFixtures.map((fixture) => [fixture.id, fixture]));
    const trioById = new Map(prevTrioLeagueFixtures.map((fixture) => [fixture.id, fixture]));
    const tierById = new Map(prevTierLeagueFixtures.map((fixture) => [fixture.id, fixture]));

    const pickState = (
      row: PredictionRow | undefined,
      result: 'home' | 'away' | 'draw' | 'pending',
      winnerName: string | null,
    ): 'correct' | 'missed' | 'pending' => {
      if (!row || result === 'pending') {
        return 'pending';
      }
      if (row.pickOutcome === 'draw') {
        return result === 'draw' ? 'correct' : 'missed';
      }
      if (result === 'draw') {
        return 'missed';
      }
      if (!winnerName) {
        return 'pending';
      }
      return row.pickTeamName === winnerName ? 'correct' : 'missed';
    };

    return prevPredictionSlate.map((entry) => {
      const key = `${entry.competition}-${entry.fixtureId}`;
      const picks = prevPredictionMap.get(key);
      const fallback: PredictionRecapFixtureRow = {
        key,
        competitionLabel: predictionCompetitionLabel(entry.competition),
        detailLabel: `Fixture ${entry.fixtureId}`,
        fixtureLabel: `${predictionCompetitionLabel(entry.competition)} fixture ${entry.fixtureId}`,
        actualLabel: 'Pending',
        jayPick: pickLabel(picks?.Jay),
        computerPick: pickLabel(picks?.Computer),
        jayState: 'pending',
        computerState: 'pending',
      };

      if (entry.competition === 'league') {
        const fixture = leagueById.get(entry.fixtureId);
        if (!fixture) {
          return fallback;
        }
        const winnerName = fixture.result === 'home' ? fixture.homeTeam : fixture.result === 'away' ? fixture.awayTeam : null;
        return {
          key,
          competitionLabel: 'League',
          detailLabel: displayDivisionName(fixture.division),
          fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          actualLabel: fixture.result === 'pending' ? 'Pending' : fixture.result === 'draw' ? 'Draw' : winnerName ?? 'Pending',
          jayPick: pickLabel(picks?.Jay),
          computerPick: pickLabel(picks?.Computer),
          jayState: pickState(picks?.Jay, fixture.result, winnerName),
          computerState: pickState(picks?.Computer, fixture.result, winnerName),
        };
      }

      if (entry.competition === 'cup') {
        const fixture = cupById.get(entry.fixtureId);
        if (!fixture) {
          return fallback;
        }
        const fixtureLabel = `${cupSideLabel(fixture, 'home')} vs ${cupSideLabel(fixture, 'away')}`;
        const result = fixture.winnerTeam ? 'home' : 'pending';
        return {
          key,
          competitionLabel: 'BookieBall Cup',
          detailLabel: fixture.roundName,
          fixtureLabel,
          actualLabel: fixture.winnerTeam ?? 'Pending',
          jayPick: pickLabel(picks?.Jay),
          computerPick: pickLabel(picks?.Computer),
          jayState: pickState(picks?.Jay, result, fixture.winnerTeam),
          computerState: pickState(picks?.Computer, result, fixture.winnerTeam),
        };
      }

      if (entry.competition === 'master') {
        const fixture = masterById.get(entry.fixtureId);
        if (!fixture) {
          return fallback;
        }
        const winnerName = fixture.result === 'home' ? fixture.homeTeam : fixture.result === 'away' ? fixture.awayTeam : null;
        return {
          key,
          competitionLabel: 'Master League',
          detailLabel: 'Master Table',
          fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          actualLabel: fixture.result === 'pending' ? 'Pending' : fixture.result === 'draw' ? 'Draw' : winnerName ?? 'Pending',
          jayPick: pickLabel(picks?.Jay),
          computerPick: pickLabel(picks?.Computer),
          jayState: pickState(picks?.Jay, fixture.result, winnerName),
          computerState: pickState(picks?.Computer, fixture.result, winnerName),
        };
      }

      if (entry.competition === 'master_cup') {
        const fixture = masterCupById.get(entry.fixtureId);
        if (!fixture) {
          return fallback;
        }
        const fixtureLabel = `${fixture.homeTeam ?? 'TBD'} vs ${fixture.awayTeam ?? 'TBD'}`;
        const result = fixture.winnerTeam ? 'home' : 'pending';
        return {
          key,
          competitionLabel: 'Master Cup',
          detailLabel: fixture.roundName,
          fixtureLabel,
          actualLabel: fixture.winnerTeam ?? 'Pending',
          jayPick: pickLabel(picks?.Jay),
          computerPick: pickLabel(picks?.Computer),
          jayState: pickState(picks?.Jay, result, fixture.winnerTeam),
          computerState: pickState(picks?.Computer, result, fixture.winnerTeam),
        };
      }

      if (entry.competition === 'trio') {
        const fixture = trioById.get(entry.fixtureId);
        if (!fixture) {
          return fallback;
        }
        const winnerName = fixture.result === 'home' ? fixture.homeTeam : fixture.result === 'away' ? fixture.awayTeam : null;
        return {
          key,
          competitionLabel: 'Trio League',
          detailLabel: fixture.stage === 'regular' ? fixture.division : `${fixture.division} • ${trioStageLabel(fixture)}`,
          fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          actualLabel: fixture.result === 'pending' ? 'Pending' : fixture.result === 'draw' ? 'Draw' : winnerName ?? 'Pending',
          jayPick: pickLabel(picks?.Jay),
          computerPick: pickLabel(picks?.Computer),
          jayState: pickState(picks?.Jay, fixture.result, winnerName),
          computerState: pickState(picks?.Computer, fixture.result, winnerName),
        };
      }

      const fixture = tierById.get(entry.fixtureId);
      if (!fixture) {
        return fallback;
      }
      const winnerName = fixture.result === 'home' ? fixture.homeTeam : fixture.result === 'away' ? fixture.awayTeam : null;
      return {
        key,
        competitionLabel: 'Tier League',
        detailLabel: fixture.fixtureType === 'cross'
          ? `Cross-Tier • ${fixture.homeDivision ?? fixture.division} vs ${fixture.awayDivision ?? fixture.division}`
          : fixture.division,
        fixtureLabel: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        actualLabel: fixture.result === 'pending' ? 'Pending' : fixture.result === 'draw' ? 'Draw' : winnerName ?? 'Pending',
        jayPick: pickLabel(picks?.Jay),
        computerPick: pickLabel(picks?.Computer),
        jayState: pickState(picks?.Jay, fixture.result, winnerName),
        computerState: pickState(picks?.Computer, fixture.result, winnerName),
      };
    });
  }, [
    prevCupFixtures,
    prevLeagueFixtures,
    prevMasterCupFixtures,
    prevMasterLeagueFixtures,
    prevPredictionMap,
    prevPredictionSlate,
    prevTierLeagueFixtures,
    prevTrioLeagueFixtures,
  ]);
  const previousPredictionRecapColumns = useMemo(() => {
    const midpoint = Math.ceil(previousPredictionRecapRows.length / 2);
    return [
      previousPredictionRecapRows.slice(0, midpoint),
      previousPredictionRecapRows.slice(midpoint),
    ];
  }, [previousPredictionRecapRows]);

  const scoreboardTotals = useMemo(() => {
    const base = new Map((predictionScores?.totals ?? []).map((row) => [row.picker, row]));
    return ['Jay', 'Computer'].map((picker) => base.get(picker) ?? { picker, points: 0, correct: 0, total: 0, perfectWeeks: 0 });
  }, [predictionScores]);

  const prevWeekScores = useMemo(() => {
    if (!recapTarget || !recapPredictionScores) {
      return [];
    }
    return recapPredictionScores.weeks.filter((row) => row.gw === recapTarget.gw);
  }, [recapPredictionScores, recapTarget]);
  const predictionSlateMissingCount = Math.max(predictionSlate.length - predictionSlateFixtures.length, 0);

  useEffect(() => {
    if (predictionsInitialized.current) {
      return;
    }
    if (predictionSlate.length === 0) {
      setPredictionSelections({});
      predictionsInitialized.current = true;
      return;
    }
    if (predictionSlateFixtures.length !== predictionSlate.length) {
      return;
    }
    const initialSelections: Record<string, 'home' | 'away' | 'draw'> = {};
    const slateByKey = new Map(predictionSlateFixtures.map((fixture) => [fixture.key, fixture]));

    jayPredictions.forEach((row) => {
      const key = `${row.competition}-${row.fixtureId}`;
      const fixture = slateByKey.get(key);
      if (!fixture) {
        return;
      }
      if (row.pickOutcome === 'draw') {
        if (!fixture.allowsDraw) {
          return;
        }
        initialSelections[key] = 'draw';
      } else {
        if (row.pickTeamId && fixture.awayTeamId && row.pickTeamId === fixture.awayTeamId) {
          initialSelections[key] = 'away';
        } else if (row.pickTeamId && fixture.homeTeamId && row.pickTeamId === fixture.homeTeamId) {
          initialSelections[key] = 'home';
        }
      }
    });

    setPredictionSelections(initialSelections);
    predictionsInitialized.current = true;
  }, [jayPredictions, predictionSlate, predictionSlateFixtures]);

  const buildPredictionSlatePicks = () => {
    const picksByCompetition = new Map<PredictionCompetition, PredictionPickPayload[]>();
    predictionSlateFixtures.forEach((fixture) => {
      const outcome = predictionSelections[fixture.key];
      if (!outcome) {
        return;
      }
      if (outcome === 'draw') {
        if (!fixture.allowsDraw) {
          return;
        }
        const rows = picksByCompetition.get(fixture.competition) ?? [];
        rows.push({
          fixtureId: fixture.fixtureId,
          pickTeamId: null,
          pickOutcome: 'draw',
          predictedHomeScore: null,
          predictedAwayScore: null,
        });
        picksByCompetition.set(fixture.competition, rows);
        return;
      }

      const pickTeamId = outcome === 'home' ? fixture.homeTeamId : fixture.awayTeamId;
      if (!pickTeamId) {
        return;
      }
      const rows = picksByCompetition.get(fixture.competition) ?? [];
      rows.push({
        fixtureId: fixture.fixtureId,
        pickTeamId,
        pickOutcome: 'team',
        predictedHomeScore: null,
        predictedAwayScore: null,
      });
      picksByCompetition.set(fixture.competition, rows);
    });
    return picksByCompetition;
  };

  const reloadFixtureSetupData = useCallback(async () => {
    const state = await api.state().catch(() => ({ currentSeason, currentGw, cupDrawStarted, gwLocked: false }));
    const seasonFiveOrLater = isSeasonFiveOrLater(state.currentSeason);
    const seasonSixOrLater = isSeasonSixOrLater(state.currentSeason);
    const [table, fixtures, movementPayload, masterPayload, masterFixtures, masterCupFixtures, trioTablePayload, trioFixtures, tierTablePayload, tierFixtures, cup, superCup, seasonEntries, predictionResponse, lastCompletedResponse, bookieDorResponse] = await Promise.all([
      api.leagueTable(),
      api.leagueFixtures(undefined, true),
      api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} as Record<string, Record<number, number>> })),
      api.masterLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, baselineGw: null, movement: {} as Record<number, number>, table: [] as MasterLeagueTableRow[] })),
      api.masterLeagueFixtures(undefined, true).catch(() => [] as MasterLeagueFixture[]),
      seasonFiveOrLater
        ? api.masterCupFixtures(undefined, true).catch(() => [] as MasterCupFixture[])
        : Promise.resolve([] as MasterCupFixture[]),
      api.trioLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, enabled: false, table: [] as TrioLeagueTableRow[] })),
      api.trioLeagueFixtures(undefined, true).catch(() => [] as TrioFixture[]),
      seasonSixOrLater
        ? api.tierLeagueTable(state.currentGw).catch(() => ({ gw: state.currentGw, enabled: false, started: false, table: [] as TierLeagueTableRow[] }))
        : Promise.resolve({ gw: state.currentGw, enabled: false, started: false, table: [] as TierLeagueTableRow[] }),
      seasonSixOrLater
        ? api.tierLeagueFixtures(undefined, true).catch(() => [] as TierLeagueFixture[])
        : Promise.resolve([] as TierLeagueFixture[]),
      api.cup().catch(() => [] as CupFixture[]),
      api.superCup(state.currentSeason).catch(() => [] as SuperCupFixture[]),
      api.entries({ limit: 2000 }).catch(() => [] as EntryRow[]),
      api.predictions(state.currentGw).catch(() => ({ season: state.currentSeason, gw: state.currentGw, locked: false, slate: [] as PredictionSlateRow[], predictions: [] as PredictionRow[] })),
      api.lastCompletedGameweek().catch(() => ({
        currentSeason: state.currentSeason,
        currentGw: state.currentGw,
        lastCompleted: null as { season: string; gw: string } | null,
      })),
      api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
    ]);

    setCurrentSeason(state.currentSeason);
    setCurrentGw(state.currentGw);
    setCurrentGwLocked(state.gwLocked);
    setCupDrawStarted(state.cupDrawStarted);
    setLeagueTable(table);
    setAllLeagueFixtures(fixtures);
    setLeagueMovement(movementPayload.movement ?? {});
    setMasterLeagueTable(masterPayload.table ?? []);
    setMasterLeagueMovement(masterPayload.movement ?? {});
    setMasterLeagueBaselineGw(masterPayload.baselineGw ?? null);
    setAllMasterLeagueFixtures(masterFixtures);
    setAllMasterCupFixtures(masterCupFixtures);
    setTrioLeagueTable(trioTablePayload.table ?? []);
    setAllTrioLeagueFixtures(trioFixtures);
    setTierLeagueTable(tierTablePayload.table ?? []);
    setAllTierLeagueFixtures(tierFixtures);
    setCupFixtures(recoverCupFixturesFromEntries(cup as CupFixture[], seasonEntries, state.currentSeason));
    setSuperCupFixtures(superCup);
    setPredictions(predictionResponse.predictions);
    setPredictionSlate(predictionResponse.slate ?? []);
    setPredictionsLocked(predictionResponse.locked);
    setLastCompletedGameweek(lastCompletedResponse.lastCompleted);
    setBookieDorBoard(bookieDorResponse);
    predictionsInitialized.current = false;
    const updatedStorylines = await api.reportStorylines(state.currentGw).catch(() => null);
    setStorylinePayload(updatedStorylines);
  }, [currentGw, currentSeason, cupDrawStarted]);

  const loadLeagueFixturesForGw = useCallback(async () => {
    setFixtureSetupBusy('league');
    setFixtureSetupNotice(null);
    try {
      const result = await api.loadLeagueFixtures();
      await reloadFixtureSetupData();
      setFixtureSetupNotice({
        type: 'ok',
        text: `${result.message} (${result.created} fixtures loaded).`,
      });
    } catch (error) {
      setFixtureSetupNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load league fixtures.',
      });
    } finally {
      setFixtureSetupBusy(null);
    }
  }, [reloadFixtureSetupData]);

  const loadMasterFixturesForGw = useCallback(async () => {
    setFixtureSetupBusy('master');
    setFixtureSetupNotice(null);
    try {
      const result = await api.generateMasterLeagueFixtures(currentGw, 'GW8');
      await reloadFixtureSetupData();
      setFixtureSetupNotice({
        type: 'ok',
        text: `Master League fixtures ready from ${result.fromGw} to ${result.toGw} (${result.created} fixtures). Master Cup fixtures refresh automatically from the live bracket.`,
      });
    } catch (error) {
      setFixtureSetupNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to generate master league fixtures.',
      });
    } finally {
      setFixtureSetupBusy(null);
    }
  }, [currentGw, reloadFixtureSetupData]);

  const loadTrioFixturesForGw = useCallback(async () => {
    setFixtureSetupBusy('trio');
    setFixtureSetupNotice(null);
    try {
      const result = await api.generateTrioLeagueFixtures(currentGw, 'GW6');
      await reloadFixtureSetupData();
      setFixtureSetupNotice({
        type: 'ok',
        text: `Trio fixtures ready from ${result.fromGw} to ${result.toGw} (${result.created} fixtures).`,
      });
    } catch (error) {
      setFixtureSetupNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to generate trio league fixtures.',
      });
    } finally {
      setFixtureSetupBusy(null);
    }
  }, [currentGw, reloadFixtureSetupData]);

  const submitPredictions = async () => {
    if (predictionsLocked) {
      return;
    }
    setPredictionSaving(true);
    setPredictionMessage('');
    try {
      if (predictionSlate.length === 0) {
        setPredictionMessage(`No prediction slate is available for ${currentGw} yet.`);
        return;
      }
      if (predictionSlateFixtures.length !== predictionSlate.length) {
        setPredictionMessage('Prediction slate is still loading. Try again in a moment.');
        return;
      }
      const hasMissingFixture = predictionSlateFixtures.some((fixture) => !predictionSelections[fixture.key]);
      if (hasMissingFixture) {
        setPredictionMessage(`Pick all ${predictionSlate.length} selected games before submitting.`);
        return;
      }
      const picksByCompetition = buildPredictionSlatePicks();
      for (const [competition, picks] of picksByCompetition.entries()) {
        if (picks.length === 0) {
          continue;
        }
        await api.savePredictions({ gw: currentGw, competition, picks, picker: 'Jay' });
      }
      await api.lockPredictions(currentGw);
      const updated = await api.predictions(currentGw);
      setPredictionSlate(updated.slate ?? []);
      setPredictions(updated.predictions);
      setSeasonPredictions((prev) => [
        ...prev.filter((row) => row.gw !== currentGw),
        ...updated.predictions,
      ]);
      setPredictionsLocked(true);
      const scoreboard = await api.predictionScoreboard().catch(() => null);
      setPredictionScores(scoreboard);
      setPredictionMessage('Predictions locked.');
    } catch (error) {
      setPredictionMessage(error instanceof Error ? error.message : 'Unable to submit predictions');
    } finally {
      setPredictionSaving(false);
    }
  };

  const unlockPredictionsForCurrentGw = async () => {
    setPredictionSaving(true);
    setPredictionMessage('');
    try {
      await api.unlockPredictions(currentGw);
      const updated = await api.predictions(currentGw);
      predictionsInitialized.current = false;
      setPredictionSlate(updated.slate ?? []);
      setPredictions(updated.predictions);
      setSeasonPredictions((prev) => [
        ...prev.filter((row) => row.gw !== currentGw),
        ...updated.predictions,
      ]);
      setPredictionsLocked(updated.locked);
      setPredictionMessage(`Predictions reopened for ${currentGw}.`);
    } catch (error) {
      setPredictionMessage(error instanceof Error ? error.message : 'Unable to unlock predictions');
    } finally {
      setPredictionSaving(false);
    }
  };

  const startShow = async () => {
    if (currentGw === 'GW1' && !cupDrawStarted) {
      return;
    }
    setOpponentPreviewProfit(0);
    setPredictionMessage('');
    setDrawError('');
    if (!predictionsLocked) {
      setPredictionMessage('Submit & lock predictions before starting the show.');
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        try {
          if (drawWindowRef.current && !drawWindowRef.current.closed) {
            drawWindowRef.current.focus();
            drawWindowRef.current.location.href = 'about:blank';
          } else {
            const opened = window.open('about:blank', '_blank', 'noopener,noreferrer');
            if (opened) {
              opened.document.title = 'Bookieball Team Draw';
              drawWindowRef.current = opened;
            } else {
              drawWindowRef.current = null;
              setDrawError('Pop-up blocked. Allow pop-ups to open team sites automatically.');
            }
          }
        } catch (error) {
          drawWindowRef.current = null;
          setDrawError('Unable to open the team site window.');
        }
      }
      await startDrawSequence();
    } finally {
      // Sequence state is handled inside startDrawSequence.
    }
  };

  const saveLogs = async () => {
    if (!draw) {
      return;
    }

    const advanceToNextTeam = () => {
      setLogRows([createLogRow()]);
      setShowLog(false);
      setDraw(null);
      setDrawError('');
      void startDrawSequence();
    };

    let rowsToSave = logRows.filter((row) => hasLogRowInput(row, currentSeason));
    if (rowsToSave.length === 0) {
      rowsToSave = [logRows[0] ?? createLogRow()];
    }

    try {
      const entries = rowsToSave.map((row) => ({
        teamId: draw.teamId,
        entryType: row.entryType,
        profit: parseLogNumber(row.profit),
        spins: row.entryType === 'free_spins' ? parseLogNumber(row.spins) : null,
        stake: row.stake.trim() === '' ? null : parseLogNumber(row.stake),
        notes: null,
        noWin: false,
      }));

      await api.saveEntries(entries);
      const totalProfitDelta = Number(rowsToSave.reduce((sum, row) => sum + effectiveLogRowProfit(row, currentSeason), 0).toFixed(2));
      const freeSpinRows = rowsToSave.filter((row) => row.entryType === 'free_spins');
      const bonusRows = rowsToSave.filter((row) => row.entryType === 'bonus');
      const freeSpinProfit = Number(freeSpinRows.reduce((sum, row) => sum + effectiveLogRowProfit(row, currentSeason), 0).toFixed(2));
      const freeSpinSpins = freeSpinRows.reduce((sum, row) => sum + Number(row.spins || 0), 0);
      const bonusProfit = Number(bonusRows.reduce((sum, row) => sum + effectiveLogRowProfit(row, currentSeason), 0).toFixed(2));
      const updatedGwProfit = Number((draw.currentGwProfit + totalProfitDelta).toFixed(2));
      const alertLines: string[] = [];
      if (freeSpinRows.length > 0) {
        alertLines.push(
          `Free spins: ${formatSigned(freeSpinProfit)} profit${freeSpinSpins > 0 ? `, ${freeSpinSpins} spins` : ''}.`,
        );
      }
      if (bonusRows.length > 0) {
        alertLines.push(`Bonus: ${formatSigned(bonusProfit)} profit.`);
      }
      alertLines.push(`Game week profit now ${formatSigned(updatedGwProfit)}.`);
      setScoreUpdateAlert({
        id: Date.now(),
        headline: 'SCORE UPDATE ALERT',
        lines: [`${draw.teamName} update logged.`, ...alertLines],
        teamId: draw.teamId,
      });
      const [
        updatedTable,
        updatedFixtures,
        updatedMovement,
        updatedMaster,
        updatedMasterFixtures,
        updatedEntries,
        updatedStorylines,
        updatedAllTimeLeagues,
        updatedState,
      ] = await Promise.all([
        api.leagueTable(),
        api.leagueFixtures(undefined, true),
        api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} as Record<string, Record<number, number>> })),
        api.masterLeagueTable(currentGw).catch(() => ({ gw: currentGw, baselineGw: null, movement: {} as Record<number, number>, table: [] as MasterLeagueTableRow[] })),
        api.masterLeagueFixtures(undefined, true).catch(() => [] as MasterLeagueFixture[]),
        api.entries({ gw: currentGw, limit: 1000 }).catch(() => [] as EntryRow[]),
        api.reportStorylines(currentGw).catch(() => null),
        api.allTimeLeagues().catch(() => null),
        api.state().catch(() => ({ currentSeason, currentGw, cupDrawStarted, gwLocked: false })),
      ]);
      setLeagueTable(updatedTable);
      setAllLeagueFixtures(updatedFixtures);
      setLeagueMovement(updatedMovement.movement ?? {});
      setMasterLeagueTable(updatedMaster.table ?? []);
      setAllMasterLeagueFixtures(updatedMasterFixtures);
      setCurrentGwEntries(updatedEntries);
      setMasterLeagueMovement(updatedMaster.movement ?? {});
      setMasterLeagueBaselineGw(updatedMaster.baselineGw ?? null);
      setStorylinePayload(updatedStorylines);
      setAllTimeLeagues(updatedAllTimeLeagues);
      if (updatedState.currentGw === currentGw) {
        setCurrentGwLocked(updatedState.gwLocked);
      }
      advanceToNextTeam();
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : 'Unable to save logs');
    }
  };

  const divisionRows = draw ? leagueTable[draw.division] ?? [] : [];
  const teamFixtures = draw
    ? allLeagueFixtures
        .filter((fixture) => fixture.homeTeam === draw.teamName || fixture.awayTeam === draw.teamName)
        .sort((a, b) => Number(a.gw.replace('GW', '')) - Number(b.gw.replace('GW', '')))
    : [];

  const nextLeagueFixture = teamFixtures.find((fixture) => fixture.result === 'pending') ?? null;
  const currentGwFixture = teamFixtures.find((fixture) => fixture.gw === currentGw) ?? null;
  const divisionTable = draw ? leagueTable[draw.division] ?? [] : [];
  const teamRank = draw ? divisionTable.find((row) => row.teamId === draw.teamId)?.rank ?? null : null;
  const fixtureDifficulty = (() => {
    if (!draw || !nextLeagueFixture) {
      return null;
    }
    const opponentName = nextLeagueFixture.homeTeam === draw.teamName ? nextLeagueFixture.awayTeam : nextLeagueFixture.homeTeam;
    const opponentRank = divisionTable.find((row) => row.teamName === opponentName)?.rank;
    if (!opponentRank || divisionTable.length === 0) {
      return null;
    }
    const band = opponentRank / divisionTable.length;
    if (band <= 0.34) {
      return { label: 'Hard', className: 'difficulty-hard' };
    }
    if (band <= 0.67) {
      return { label: 'Medium', className: 'difficulty-mid' };
    }
    return { label: 'Favorable', className: 'difficulty-easy' };
  })();

  const savedCurrentGwEntryCountByTeamName = useMemo(() => {
    const map = new Map<string, number>();
    currentGwEntries.forEach((entry) => {
      map.set(entry.teamName, (map.get(entry.teamName) ?? 0) + 1);
    });
    return map;
  }, [currentGwEntries]);

  const pendingLogRows = useMemo(
    () => (draw ? logRows.filter((row) => hasLogRowInput(row, currentSeason)) : []),
    [currentSeason, draw?.teamId, logRows],
  );

  const pendingEntryCount = pendingLogRows.length;

  const pendingProfitDelta = useMemo(
    () => Number(pendingLogRows.reduce((sum, row) => sum + effectiveLogRowProfit(row, currentSeason), 0).toFixed(2)),
    [currentSeason, pendingLogRows],
  );

  const pendingSpinsDelta = useMemo(
    () => pendingLogRows.reduce((sum, row) => (
      row.entryType === 'free_spins' ? sum + Number(row.spins || 0) : sum
    ), 0),
    [pendingLogRows],
  );

  const previewProfit = useMemo(() => {
    if (!draw) {
      return pendingProfitDelta;
    }
    return Number((draw.currentGwProfit + pendingProfitDelta).toFixed(2));
  }, [draw, pendingProfitDelta]);

  const previewSpins = useMemo(() => {
    if (!draw) {
      return pendingSpinsDelta;
    }
    return Math.max(0, draw.currentGwSpins + pendingSpinsDelta);
  }, [draw, pendingSpinsDelta]);

  const spotlightPulseRef = useRef<{ teamId: number | null; profit: number }>({
    teamId: null,
    profit: 0,
  });
  const spotlightPulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!draw || !showLog) {
      spotlightPulseRef.current = { teamId: null, profit: 0 };
      if (spotlightPulseTimerRef.current) {
        window.clearTimeout(spotlightPulseTimerRef.current);
        spotlightPulseTimerRef.current = null;
      }
      return;
    }
    spotlightPulseRef.current = { teamId: draw.teamId, profit: draw.currentGwProfit };
    if (spotlightPulseTimerRef.current) {
      window.clearTimeout(spotlightPulseTimerRef.current);
      spotlightPulseTimerRef.current = null;
    }
  }, [draw?.teamId, draw?.currentGwProfit, showLog]);

  useEffect(() => {
    if (!draw || !showLog) {
      return;
    }
    if (spotlightPulseRef.current.teamId !== draw.teamId) {
      spotlightPulseRef.current = { teamId: draw.teamId, profit: draw.currentGwProfit };
      return;
    }
    const previousProfit = spotlightPulseRef.current.profit;
    if (Math.abs(previewProfit - previousProfit) < 0.01) {
      return;
    }
    if (spotlightPulseTimerRef.current) {
      window.clearTimeout(spotlightPulseTimerRef.current);
    }
    spotlightPulseTimerRef.current = window.setTimeout(() => {
      const currentProfit = spotlightPulseRef.current.profit;
      const delta = Number((previewProfit - currentProfit).toFixed(2));
      if (Math.abs(delta) < 0.01) {
        return;
      }
      const opponentBase = draw.leagueOpponent && draw.leagueOpponent !== 'No Fixture'
        ? draw.leagueOpponent
        : draw.cupOpponent && draw.cupOpponent !== 'No Fixture'
          ? draw.cupOpponent
          : '';
      const opponentLine = opponentBase && !isPlaceholderTeam(opponentBase)
        ? `We have some action in the game against ${opponentBase}.`
        : 'We have some action on the board.';
      const direction = delta > 0 ? 'up' : 'down';
      const swingLine = `Profit moves ${direction} by ${formatSigned(Math.abs(delta))} to ${formatSigned(previewProfit)}.`;
      setSpotlightPulse({
        id: Date.now(),
        message: `${opponentLine} ${swingLine}`,
        teamId: draw.teamId,
      });
      spotlightPulseRef.current = { teamId: draw.teamId, profit: previewProfit };
    }, 650);
    return () => {
      if (spotlightPulseTimerRef.current) {
        window.clearTimeout(spotlightPulseTimerRef.current);
        spotlightPulseTimerRef.current = null;
      }
    };
  }, [draw, previewProfit, showLog]);

  const currentGwEntryCountByTeamNameWithPending = useMemo(() => {
    const map = new Map(savedCurrentGwEntryCountByTeamName);
    if (draw && pendingEntryCount > 0) {
      map.set(draw.teamName, (map.get(draw.teamName) ?? 0) + pendingEntryCount);
    }
    return map;
  }, [draw, pendingEntryCount, savedCurrentGwEntryCountByTeamName]);

  const allLeagueFixturesForStudio = useMemo(() => {
    if (!draw || !showLog) {
      return allLeagueFixtures;
    }
    return allLeagueFixtures.map((fixture) => {
      if (fixture.gw !== currentGw) {
        return fixture;
      }
      const isHome = fixture.homeTeam === draw.teamName;
      const isAway = fixture.awayTeam === draw.teamName;
      if (!isHome && !isAway) {
        return fixture;
      }
      const homeProfit = isHome ? previewProfit : fixture.homeProfit;
      const awayProfit = isAway ? previewProfit : fixture.awayProfit;
      const homeSpins = isHome ? previewSpins : fixture.homeSpins;
      const awaySpins = isAway ? previewSpins : fixture.awaySpins;
      const homeEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.homeTeam) ?? 0) + (isHome ? pendingEntryCount : 0);
      const awayEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.awayTeam) ?? 0) + (isAway ? pendingEntryCount : 0);
      let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
      if (homeEntryCount > 0 || awayEntryCount > 0) {
        if (homeProfit > awayProfit) {
          result = 'home';
        } else if (awayProfit > homeProfit) {
          result = 'away';
        } else {
          result = 'draw';
        }
      }
      return {
        ...fixture,
        homeProfit: Number(homeProfit.toFixed(2)),
        awayProfit: Number(awayProfit.toFixed(2)),
        homeSpins,
        awaySpins,
        result,
      };
    });
  }, [
    allLeagueFixtures,
    currentGw,
    draw,
    pendingEntryCount,
    previewProfit,
    previewSpins,
    savedCurrentGwEntryCountByTeamName,
    showLog,
  ]);

  const tableLeagueFixturesForStudio = useMemo(
    () => allLeagueFixturesForStudio.filter((fixture) => recapDivisionSet.has(fixture.division)),
    [allLeagueFixturesForStudio, recapDivisionSet],
  );

  const leagueFormByTeamName = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    const sortedFixtures = tableLeagueFixturesForStudio
      .slice()
      .sort((a, b) => gwSortValue(a.gw) - gwSortValue(b.gw) || a.id - b.id);
    const pushForm = (teamName: string, result: 'W' | 'D' | 'L') => {
      const current = map.get(teamName) ?? [];
      current.push(result);
      map.set(teamName, current);
    };
    sortedFixtures.forEach((fixture) => {
      if (fixture.result === 'pending') {
        return;
      }
      if (fixture.result === 'draw') {
        pushForm(fixture.homeTeam, 'D');
        pushForm(fixture.awayTeam, 'D');
        return;
      }
      const homeWin = fixture.result === 'home';
      pushForm(fixture.homeTeam, homeWin ? 'W' : 'L');
      pushForm(fixture.awayTeam, homeWin ? 'L' : 'W');
    });
    map.forEach((results, teamName) => {
      if (results.length > 5) {
        map.set(teamName, results.slice(-5));
      }
    });
    return map;
  }, [tableLeagueFixturesForStudio]);

  const allMasterLeagueFixturesForStudio = useMemo(() => {
    if (!draw || !showLog) {
      return allMasterLeagueFixtures;
    }
    return allMasterLeagueFixtures.map((fixture) => {
      if (fixture.gw !== currentGw) {
        return fixture;
      }
      const isHome = fixture.homeTeam === draw.teamName;
      const isAway = fixture.awayTeam === draw.teamName;
      if (!isHome && !isAway) {
        return fixture;
      }
      const homeProfit = isHome ? previewProfit : fixture.homeProfit;
      const awayProfit = isAway ? previewProfit : fixture.awayProfit;
      const homeSpins = isHome ? previewSpins : fixture.homeSpins;
      const awaySpins = isAway ? previewSpins : fixture.awaySpins;
      const homeEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.homeTeam) ?? 0) + (isHome ? pendingEntryCount : 0);
      const awayEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.awayTeam) ?? 0) + (isAway ? pendingEntryCount : 0);
      let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
      if (homeEntryCount > 0 || awayEntryCount > 0) {
        if (homeProfit > awayProfit) {
          result = 'home';
        } else if (awayProfit > homeProfit) {
          result = 'away';
        } else {
          result = 'draw';
        }
      }
      return {
        ...fixture,
        homeProfit: Number(homeProfit.toFixed(2)),
        awayProfit: Number(awayProfit.toFixed(2)),
        homeSpins,
        awaySpins,
        result,
      };
    });
  }, [
    allMasterLeagueFixtures,
    currentGw,
    draw,
    pendingEntryCount,
    previewProfit,
    previewSpins,
    savedCurrentGwEntryCountByTeamName,
    showLog,
  ]);

  const allTrioLeagueFixturesForStudio = useMemo(() => {
    if (!draw || !showLog) {
      return allTrioLeagueFixtures;
    }
    return allTrioLeagueFixtures.map((fixture) => {
      if (fixture.gw !== currentGw) {
        return fixture;
      }
      const isHome = fixture.homeTeam === draw.teamName;
      const isAway = fixture.awayTeam === draw.teamName;
      if (!isHome && !isAway) {
        return fixture;
      }
      const homeProfit = isHome ? previewProfit : fixture.homeProfit;
      const awayProfit = isAway ? previewProfit : fixture.awayProfit;
      const homeSpins = isHome ? previewSpins : fixture.homeSpins;
      const awaySpins = isAway ? previewSpins : fixture.awaySpins;
      const homeEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.homeTeam) ?? 0) + (isHome ? pendingEntryCount : 0);
      const awayEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.awayTeam) ?? 0) + (isAway ? pendingEntryCount : 0);
      let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
      if (homeEntryCount > 0 || awayEntryCount > 0) {
        if (homeProfit > awayProfit) {
          result = 'home';
        } else if (awayProfit > homeProfit) {
          result = 'away';
        } else {
          result = 'draw';
        }
      }
      return {
        ...fixture,
        homeProfit: Number(homeProfit.toFixed(2)),
        awayProfit: Number(awayProfit.toFixed(2)),
        homeSpins,
        awaySpins,
        result,
      };
    });
  }, [
    allTrioLeagueFixtures,
    currentGw,
    draw,
    pendingEntryCount,
    previewProfit,
    previewSpins,
    savedCurrentGwEntryCountByTeamName,
    showLog,
  ]);

  const allTierLeagueFixturesForStudio = useMemo(() => {
    if (!draw || !showLog) {
      return allTierLeagueFixtures;
    }
    return allTierLeagueFixtures.map((fixture) => {
      if (fixture.gw !== currentGw) {
        return fixture;
      }
      const isHome = fixture.homeTeam === draw.teamName;
      const isAway = fixture.awayTeam === draw.teamName;
      if (!isHome && !isAway) {
        return fixture;
      }
      const homeProfit = isHome ? previewProfit : fixture.homeProfit;
      const awayProfit = isAway ? previewProfit : fixture.awayProfit;
      const homeSpins = isHome ? previewSpins : fixture.homeSpins;
      const awaySpins = isAway ? previewSpins : fixture.awaySpins;
      const homeEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.homeTeam) ?? 0) + (isHome ? pendingEntryCount : 0);
      const awayEntryCount = (savedCurrentGwEntryCountByTeamName.get(fixture.awayTeam) ?? 0) + (isAway ? pendingEntryCount : 0);
      let result: 'home' | 'away' | 'draw' | 'pending' = 'pending';
      if (homeEntryCount > 0 || awayEntryCount > 0) {
        if (homeProfit > awayProfit) {
          result = 'home';
        } else if (awayProfit > homeProfit) {
          result = 'away';
        } else {
          result = 'draw';
        }
      }
      return {
        ...fixture,
        homeProfit: Number(homeProfit.toFixed(2)),
        awayProfit: Number(awayProfit.toFixed(2)),
        homeSpins,
        awaySpins,
        result,
      };
    });
  }, [
    allTierLeagueFixtures,
    currentGw,
    draw,
    pendingEntryCount,
    previewProfit,
    previewSpins,
    savedCurrentGwEntryCountByTeamName,
    showLog,
  ]);

  const currentLeagueFixturesForStudio = useMemo(
    () => allLeagueFixturesForStudio.filter((fixture) => fixture.gw === currentGw),
    [allLeagueFixturesForStudio, currentGw],
  );
  const currentMasterLeagueFixturesForStudio = useMemo(
    () => allMasterLeagueFixturesForStudio.filter((fixture) => fixture.gw === currentGw),
    [allMasterLeagueFixturesForStudio, currentGw],
  );
  const currentTrioLeagueFixturesForStudio = useMemo(
    () => allTrioLeagueFixturesForStudio.filter((fixture) => fixture.gw === currentGw),
    [allTrioLeagueFixturesForStudio, currentGw],
  );
  const currentTierLeagueFixturesForStudio = useMemo(
    () => allTierLeagueFixturesForStudio.filter((fixture) => fixture.gw === currentGw),
    [allTierLeagueFixturesForStudio, currentGw],
  );

  const currentCupFixture = useMemo(() => {
    if (!draw) {
      return null;
    }
    return currentCupFixtures.find((fixture) => fixture.homeTeam === draw.teamName || fixture.awayTeam === draw.teamName) ?? null;
  }, [currentCupFixtures, draw]);

  const currentLeaguePrediction = useMemo(
    () => (currentGwFixture ? currentPredictionMap.get(`league-${currentGwFixture.id}`) ?? null : null),
    [currentGwFixture, currentPredictionMap],
  );

  const currentCupPrediction = useMemo(
    () => (currentCupFixture ? currentPredictionMap.get(`cup-${currentCupFixture.id}`) ?? null : null),
    [currentCupFixture, currentPredictionMap],
  );

  const currentLeagueOpponentName = useMemo(() => {
    if (!draw || !currentGwFixture) {
      return 'Opponent';
    }
    return currentGwFixture.homeTeam === draw.teamName ? currentGwFixture.awayTeam : currentGwFixture.homeTeam;
  }, [currentGwFixture, draw]);

  useEffect(() => {
    if (!draw || !currentGwFixture) {
      return;
    }
    const isHome = currentGwFixture.homeTeam === draw.teamName;
    const existingOpponentProfit = isHome ? currentGwFixture.awayProfit : currentGwFixture.homeProfit;
    setOpponentPreviewProfit(existingOpponentProfit);
  }, [currentGwFixture, draw?.teamId]);

  const projectedDivisionRows = useMemo(() => {
    if (!draw || !currentGwFixture) {
      return divisionRows;
    }

    const isHome = currentGwFixture.homeTeam === draw.teamName;
    const opponentName = isHome ? currentGwFixture.awayTeam : currentGwFixture.homeTeam;
    const currentMyProfit = isHome ? currentGwFixture.homeProfit : currentGwFixture.awayProfit;
    const currentOppProfit = isHome ? currentGwFixture.awayProfit : currentGwFixture.homeProfit;
    const currentMyPoints = currentGwFixture.result === 'pending' ? 0 : fixturePointsForProfit(currentMyProfit, currentOppProfit);
    const currentOppPoints = currentGwFixture.result === 'pending' ? 0 : fixturePointsForProfit(currentOppProfit, currentMyProfit);
    const currentPlayed = playedFromResult(currentGwFixture.result);
    const currentMyRecord = currentGwFixture.result === 'pending' ? { wins: 0, draws: 0, losses: 0 } : recordFromProfit(currentMyProfit, currentOppProfit);
    const currentOppRecord = currentGwFixture.result === 'pending' ? { wins: 0, draws: 0, losses: 0 } : recordFromProfit(currentOppProfit, currentMyProfit);

    const projectedMyPoints = fixturePointsForProfit(previewProfit, opponentPreviewProfit);
    const projectedOppPoints = fixturePointsForProfit(opponentPreviewProfit, previewProfit);
    const projectedPlayed =
      (currentGwEntryCountByTeamNameWithPending.get(draw.teamName) ?? 0) > 0
      || (currentGwEntryCountByTeamNameWithPending.get(opponentName) ?? 0) > 0
        ? 1
        : 0;
    const projectedMyRecord = projectedPlayed === 0 ? { wins: 0, draws: 0, losses: 0 } : recordFromProfit(previewProfit, opponentPreviewProfit);
    const projectedOppRecord = projectedPlayed === 0 ? { wins: 0, draws: 0, losses: 0 } : recordFromProfit(opponentPreviewProfit, previewProfit);

    const rowsWithPreview = divisionRows.map((row) => {
      if (row.teamName === draw.teamName) {
        return {
          ...row,
          played: row.played + (projectedPlayed - currentPlayed),
          wins: Math.max(0, row.wins + (projectedMyRecord.wins - currentMyRecord.wins)),
          draws: Math.max(0, row.draws + (projectedMyRecord.draws - currentMyRecord.draws)),
          losses: Math.max(0, row.losses + (projectedMyRecord.losses - currentMyRecord.losses)),
          points: row.points + (projectedMyPoints - currentMyPoints),
          profit: Number((row.profit + (previewProfit - currentMyProfit)).toFixed(2)),
          spins: Math.max(0, row.spins + (previewSpins - draw.currentGwSpins)),
        };
      }
      if (row.teamName === opponentName) {
        return {
          ...row,
          played: row.played + (projectedPlayed - currentPlayed),
          wins: Math.max(0, row.wins + (projectedOppRecord.wins - currentOppRecord.wins)),
          draws: Math.max(0, row.draws + (projectedOppRecord.draws - currentOppRecord.draws)),
          losses: Math.max(0, row.losses + (projectedOppRecord.losses - currentOppRecord.losses)),
          points: row.points + (projectedOppPoints - currentOppPoints),
          profit: Number((row.profit + (opponentPreviewProfit - currentOppProfit)).toFixed(2)),
        };
      }
      return row;
    });

    return rowsWithPreview
      .slice()
      .sort((a, b) => (b.points - a.points) || (b.profit - a.profit) || (b.spins - a.spins) || a.teamName.localeCompare(b.teamName))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [currentGwEntryCountByTeamNameWithPending, currentGwFixture, divisionRows, draw, opponentPreviewProfit, previewProfit, previewSpins]);

  const projectedTeamRow = useMemo(
    () => (draw ? projectedDivisionRows.find((row) => row.teamId === draw.teamId) ?? null : null),
    [draw, projectedDivisionRows],
  );

  const teamForm = useMemo(() => {
    if (!draw) {
      return [] as Array<'W' | 'D' | 'L'>;
    }
    return teamFixtures
      .filter((fixture) => fixture.result !== 'pending')
      .map((fixture) => {
        const isHome = fixture.homeTeam === draw.teamName;
        if (fixture.result === 'draw') {
          return 'D' as const;
        }
        const won = (fixture.result === 'home' && isHome) || (fixture.result === 'away' && !isHome);
        return won ? 'W' as const : 'L' as const;
      })
      .slice(-5);
  }, [draw, teamFixtures]);

  const currentGwProfitByTeamNameForStudio = useMemo(() => {
    const map = new Map<string, number>();
    currentLeagueFixturesForStudio.forEach((fixture) => {
      map.set(fixture.homeTeam, fixture.homeProfit);
      map.set(fixture.awayTeam, fixture.awayProfit);
    });
    currentMasterLeagueFixturesForStudio.forEach((fixture) => {
      map.set(fixture.homeTeam, fixture.homeProfit);
      map.set(fixture.awayTeam, fixture.awayProfit);
    });
    currentTrioLeagueFixturesForStudio.forEach((fixture) => {
      map.set(fixture.homeTeam, fixture.homeProfit);
      map.set(fixture.awayTeam, fixture.awayProfit);
    });
    currentTierLeagueFixturesForStudio.forEach((fixture) => {
      map.set(fixture.homeTeam, fixture.homeProfit);
      map.set(fixture.awayTeam, fixture.awayProfit);
    });
    return map;
  }, [currentLeagueFixturesForStudio, currentMasterLeagueFixturesForStudio, currentTierLeagueFixturesForStudio, currentTrioLeagueFixturesForStudio]);

  const seasonPredictionByKey = useMemo(() => {
    const map = new Map<string, PredictionRow>();
    seasonPredictions.forEach((row) => {
      map.set(`${row.gw}-${row.competition}-${row.fixtureId}-${row.picker}`, row);
    });
    return map;
  }, [seasonPredictions]);

  const teamPredictionCredits = useMemo(() => {
    const ensure = (
      map: Map<string, { jayPoints: number; jayCorrect: number; computerPoints: number; computerCorrect: number; resolved: number }>,
      teamName: string,
    ) => {
      const existing = map.get(teamName);
      if (existing) {
        return existing;
      }
      const next = { jayPoints: 0, jayCorrect: 0, computerPoints: 0, computerCorrect: 0, resolved: 0 };
      map.set(teamName, next);
      return next;
    };

    const credits = new Map<string, { jayPoints: number; jayCorrect: number; computerPoints: number; computerCorrect: number; resolved: number }>();

    allLeagueFixturesForStudio.forEach((fixture) => {
      if (fixture.result === 'pending') {
        return;
      }
      const winnerName =
        fixture.result === 'draw'
          ? null
          : fixture.result === 'home'
            ? fixture.homeTeam
            : fixture.awayTeam;
      [fixture.homeTeam, fixture.awayTeam].forEach((teamName) => {
        const row = ensure(credits, teamName);
        row.resolved += 1;
        const jayPick = seasonPredictionByKey.get(`${fixture.gw}-league-${fixture.id}-Jay`);
        if (jayPick && ((jayPick.pickOutcome === 'draw' && fixture.result === 'draw') || (jayPick.pickOutcome === 'team' && winnerName !== null && jayPick.pickTeamName === winnerName))) {
          row.jayCorrect += 1;
          row.jayPoints += 5;
        }
        const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-league-${fixture.id}-Computer`);
        if (cpuPick && ((cpuPick.pickOutcome === 'draw' && fixture.result === 'draw') || (cpuPick.pickOutcome === 'team' && winnerName !== null && cpuPick.pickTeamName === winnerName))) {
          row.computerCorrect += 1;
          row.computerPoints += 5;
        }
      });
    });

    allMasterLeagueFixtures.forEach((fixture) => {
      if (fixture.result === 'pending') {
        return;
      }
      const winnerName =
        fixture.result === 'draw'
          ? null
          : fixture.result === 'home'
            ? fixture.homeTeam
            : fixture.awayTeam;
      [fixture.homeTeam, fixture.awayTeam].forEach((teamName) => {
        const row = ensure(credits, teamName);
        row.resolved += 1;
        const jayPick = seasonPredictionByKey.get(`${fixture.gw}-master-${fixture.id}-Jay`);
        if (jayPick && ((jayPick.pickOutcome === 'draw' && fixture.result === 'draw') || (jayPick.pickOutcome === 'team' && winnerName !== null && jayPick.pickTeamName === winnerName))) {
          row.jayCorrect += 1;
          row.jayPoints += 5;
        }
        const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-master-${fixture.id}-Computer`);
        if (cpuPick && ((cpuPick.pickOutcome === 'draw' && fixture.result === 'draw') || (cpuPick.pickOutcome === 'team' && winnerName !== null && cpuPick.pickTeamName === winnerName))) {
          row.computerCorrect += 1;
          row.computerPoints += 5;
        }
      });
    });

    allTrioLeagueFixtures.forEach((fixture) => {
      if (fixture.result === 'pending') {
        return;
      }
      const winnerName =
        fixture.result === 'draw'
          ? null
          : fixture.result === 'home'
            ? fixture.homeTeam
            : fixture.awayTeam;
      [fixture.homeTeam, fixture.awayTeam].forEach((teamName) => {
        const row = ensure(credits, teamName);
        row.resolved += 1;
        const jayPick = seasonPredictionByKey.get(`${fixture.gw}-trio-${fixture.id}-Jay`);
        if (jayPick && ((jayPick.pickOutcome === 'draw' && fixture.result === 'draw') || (jayPick.pickOutcome === 'team' && winnerName !== null && jayPick.pickTeamName === winnerName))) {
          row.jayCorrect += 1;
          row.jayPoints += 5;
        }
        const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-trio-${fixture.id}-Computer`);
        if (cpuPick && ((cpuPick.pickOutcome === 'draw' && fixture.result === 'draw') || (cpuPick.pickOutcome === 'team' && winnerName !== null && cpuPick.pickTeamName === winnerName))) {
          row.computerCorrect += 1;
          row.computerPoints += 5;
        }
      });
    });

    cupFixtures.forEach((fixture) => {
      if (!fixture.winnerTeam) {
        return;
      }
      const participating = new Set(
        [fixture.homeTeam, fixture.awayTeam, fixture.winnerTeam].filter((name): name is string => !!name),
      );
      participating.forEach((teamName) => {
        const row = ensure(credits, teamName);
        row.resolved += 1;
        const jayPick = seasonPredictionByKey.get(`${fixture.gw}-cup-${fixture.id}-Jay`);
        if (jayPick && jayPick.pickOutcome !== 'draw' && jayPick.pickTeamName === fixture.winnerTeam) {
          row.jayCorrect += 1;
          row.jayPoints += 5;
        }
        const cpuPick = seasonPredictionByKey.get(`${fixture.gw}-cup-${fixture.id}-Computer`);
        if (cpuPick && cpuPick.pickOutcome !== 'draw' && cpuPick.pickTeamName === fixture.winnerTeam) {
          row.computerCorrect += 1;
          row.computerPoints += 5;
        }
      });
    });

    return credits;
  }, [allLeagueFixturesForStudio, allMasterLeagueFixtures, allTrioLeagueFixtures, cupFixtures, seasonPredictionByKey]);

  const studioFixtureCount =
    currentLeagueFixturesForStudio.length
    + currentMasterLeagueFixturesForStudio.length
    + currentTrioLeagueFixturesForStudio.length
    + currentTierLeagueFixturesForStudio.length
    + currentCupFixtures.length
    + currentSuperCupFixtures.length;
  const studioResolvedCount =
    currentLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length
    + currentMasterLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length
    + currentTrioLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length
    + currentTierLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length
    + currentCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length
    + currentSuperCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length;

  const studioTableDivisions = useMemo(() => {
    const lastDivision = recapDivisionOrder[recapDivisionOrder.length - 1];
    return recapDivisionOrder
      .map((division, divisionIndex) => {
        const rows =
          draw && showLog && division === draw.division
            ? projectedDivisionRows
            : (leagueTable[division] ?? []).slice().sort(compareLeagueRowsByRank);
        const pendingMatchesByTeam = new Map<number, number>();
        tableLeagueFixturesForStudio
          .filter((fixture) => fixture.division === division && fixture.result === 'pending')
          .forEach((fixture) => {
            const homeTeamId = teamIdByName.get(fixture.homeTeam);
            const awayTeamId = teamIdByName.get(fixture.awayTeam);
            if (homeTeamId) {
              pendingMatchesByTeam.set(homeTeamId, (pendingMatchesByTeam.get(homeTeamId) ?? 0) + 1);
            }
            if (awayTeamId) {
              pendingMatchesByTeam.set(awayTeamId, (pendingMatchesByTeam.get(awayTeamId) ?? 0) + 1);
            }
          });
        const maxPossiblePointsByTeam = new Map<number, number>();
        rows.forEach((row) => {
          const pendingMatches = pendingMatchesByTeam.get(row.teamId) ?? 0;
          maxPossiblePointsByTeam.set(row.teamId, row.points + pendingMatches * 3);
        });

        const leader = rows[0];
        const othersBestPossible = rows.length > 1
          ? Math.max(...rows.slice(1).map((row) => maxPossiblePointsByTeam.get(row.teamId) ?? row.points))
          : -Infinity;
        const championTeamId = leader && (rows.length === 1 || leader.points > othersBestPossible)
          ? leader.teamId
          : null;

        const relegatedTeamIds = new Set<number>();
        if (division !== lastDivision) {
          rows.forEach((row) => {
            const rowMaxPoints = maxPossiblePointsByTeam.get(row.teamId) ?? row.points;
            const canCatchAnyRival = rows.some((rival) => rival.teamId !== row.teamId && rowMaxPoints >= rival.points);
            if (!canCatchAnyRival) {
              relegatedTeamIds.add(row.teamId);
            }
          });
        }

        const title = displayDivisionName(division);
        const crest = title
          .split(' ')
          .map((word) => word[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return {
          id: division,
          title,
          subtitle: `${currentGw} standings`,
          crest,
          rows: rows.map((row) => {
            const delta = leagueMovement[division]?.[row.teamId] ?? 0;
            return {
              teamId: row.teamId,
              teamName: row.teamName,
              ballColor: teamMetaByName.get(row.teamName)?.ballColor ?? null,
              ringColor: teamMetaByName.get(row.teamName)?.ringColor ?? null,
              textColor: teamMetaByName.get(row.teamName)?.textColor ?? null,
              rank: row.rank,
              played: row.played,
              wins: row.wins,
              draws: row.draws,
              losses: row.losses,
              points: row.points,
              profit: row.profit,
              spins: row.spins,
              record: `${row.wins}-${row.draws}-${row.losses}`,
              form: leagueFormByTeamName.get(row.teamName) ?? [],
              trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
              isChampion: championTeamId === row.teamId,
              isRelegated: relegatedTeamIds.has(row.teamId),
            };
          }),
        };
      })
      .filter((division) => division.rows.length > 0);
  }, [
    tableLeagueFixturesForStudio,
    currentGw,
    draw,
    leagueFormByTeamName,
    leagueMovement,
    leagueTable,
    recapDivisionOrder,
    projectedDivisionRows,
    showLog,
    teamIdByName,
    teamMetaByName,
  ]);

  const studioMasterLeagueRows = useMemo(() => {
    const rows = masterLeagueTable.slice().sort(compareLeagueRowsByRank);
    if (rows.length === 0) {
      return [] as SkyStudioTableDivision['rows'];
    }
    const pendingMatchesByTeam = new Map<number, number>();
    allMasterLeagueFixtures
      .filter((fixture) => fixture.result === 'pending')
      .forEach((fixture) => {
        pendingMatchesByTeam.set(fixture.homeTeamId, (pendingMatchesByTeam.get(fixture.homeTeamId) ?? 0) + 1);
        pendingMatchesByTeam.set(fixture.awayTeamId, (pendingMatchesByTeam.get(fixture.awayTeamId) ?? 0) + 1);
      });
    const maxPossiblePointsByTeam = new Map<number, number>();
    rows.forEach((row) => {
      const pendingMatches = pendingMatchesByTeam.get(row.teamId) ?? 0;
      maxPossiblePointsByTeam.set(row.teamId, row.points + pendingMatches * 3);
    });
    const leader = rows[0];
    const othersBestPossible = rows.length > 1
      ? Math.max(...rows.slice(1).map((row) => maxPossiblePointsByTeam.get(row.teamId) ?? row.points))
      : -Infinity;
    const championTeamId = leader && (rows.length === 1 || leader.points > othersBestPossible)
      ? leader.teamId
      : null;

    return rows.map((row) => {
      const delta = masterLeagueMovement[row.teamId] ?? 0;
      const teamMeta = teamMetaByName.get(row.teamName);
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        ballColor: row.ballColor ?? teamMeta?.ballColor ?? null,
        ringColor: row.ringColor ?? teamMeta?.ringColor ?? null,
        textColor: row.textColor ?? teamMeta?.textColor ?? null,
        rank: row.rank,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        points: row.points,
        profit: row.profit,
        spins: row.spins,
        record: `${row.wins}-${row.draws}-${row.losses}`,
        form: leagueFormByTeamName.get(row.teamName) ?? [],
        trend: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const,
        isChampion: championTeamId === row.teamId,
        isRelegated: false,
      };
    });
  }, [allMasterLeagueFixtures, leagueFormByTeamName, masterLeagueMovement, masterLeagueTable, teamMetaByName]);

  const studioMasterLeagueRowsByTeamId = useMemo(() => {
    const rowMap = new Map<number, SkyStudioTableDivision['rows'][number]>();
    studioMasterLeagueRows.forEach((row) => {
      rowMap.set(row.teamId, row);
    });
    return rowMap;
  }, [studioMasterLeagueRows]);

  const allTimeRankMaps = useMemo(() => {
    const points = new Map<number, number>();
    const profit = new Map<number, number>();
    const spins = new Map<number, number>();
    allTimeLeagues?.pointsTable.forEach((row) => {
      points.set(row.teamId, row.rank);
    });
    allTimeLeagues?.profitTable.forEach((row) => {
      profit.set(row.teamId, row.rank);
    });
    allTimeLeagues?.spinsTable.forEach((row) => {
      spins.set(row.teamId, row.rank);
    });
    return { points, profit, spins };
  }, [allTimeLeagues]);

  const divisionJourneyById = useMemo(() => {
    const effectiveJourneyGw = Math.max(1, Math.min(OFFICIAL_DIVISION_GAMEWEEKS.length, gwSortValue(currentGw)));
    const gwNumbers = Array.from({ length: effectiveJourneyGw }, (_, index) => index + 1);
    const journeyMap = new Map<string, {
      divisionTitle: string;
      gwNumbers: number[];
      teams: Array<{
        teamId: number;
        teamName: string;
        ballColor: string | null;
        ringColor: string | null;
        textColor: string | null;
        ranks: number[];
      }>;
    }>();

    studioTableDivisions.forEach((division) => {
      const orderedRows = division.rows.slice().sort(compareLeagueRowsByRank);
      if (orderedRows.length === 0) {
        return;
      }
      const regularFixtures = tableLeagueFixturesForStudio
        .filter((fixture) => fixture.division === division.id && OFFICIAL_DIVISION_GAMEWEEKS.includes(fixture.gw))
        .slice()
        .sort((left, right) => gwSortValue(left.gw) - gwSortValue(right.gw) || left.id - right.id);
      const stats = new Map<number, { teamName: string; points: number; profit: number; spins: number; wins: number }>();
      orderedRows.forEach((row) => {
        stats.set(row.teamId, {
          teamName: row.teamName,
          points: 0,
          profit: 0,
          spins: 0,
          wins: 0,
        });
      });
      const rankHistory = new Map<number, number[]>();
      orderedRows.forEach((row) => {
        rankHistory.set(row.teamId, []);
      });

      gwNumbers.forEach((gwNumber) => {
        const gwLabel = `GW${gwNumber}`;
        regularFixtures
          .filter((fixture) => fixture.gw === gwLabel && fixture.result !== 'pending')
          .forEach((fixture) => {
            const home = orderedRows.find((row) => row.teamName === fixture.homeTeam);
            const away = orderedRows.find((row) => row.teamName === fixture.awayTeam);
            if (!home || !away) {
              return;
            }
            const homeStats = stats.get(home.teamId);
            const awayStats = stats.get(away.teamId);
            if (!homeStats || !awayStats) {
              return;
            }
            homeStats.profit += fixture.homeProfit;
            awayStats.profit += fixture.awayProfit;
            homeStats.spins += fixture.homeSpins;
            awayStats.spins += fixture.awaySpins;
            if (fixture.result === 'home') {
              homeStats.points += 3;
              homeStats.wins += 1;
            } else if (fixture.result === 'away') {
              awayStats.points += 3;
              awayStats.wins += 1;
            } else {
              homeStats.points += 1;
              awayStats.points += 1;
            }
          });

        const standings = orderedRows
          .map((row) => ({
            row,
            stats: stats.get(row.teamId) ?? { teamName: row.teamName, points: 0, profit: 0, spins: 0, wins: 0 },
          }))
          .sort((left, right) => (
            right.stats.points - left.stats.points
            || right.stats.profit - left.stats.profit
            || right.stats.spins - left.stats.spins
            || right.stats.wins - left.stats.wins
            || left.row.teamName.localeCompare(right.row.teamName)
          ));

        standings.forEach((entry, index) => {
          rankHistory.get(entry.row.teamId)?.push(index + 1);
        });
      });

      const teams = orderedRows.map((row, rowIndex) => {
        const safeTableRank = Math.min(orderedRows.length, row.rank || rowIndex + 1);
        const seeded = rankHistory.get(row.teamId) ?? [];
        const normalizedRanks = gwNumbers.map((_, index) => (
          typeof seeded[index] === 'number' && Number.isFinite(seeded[index])
            ? Math.max(1, Math.min(orderedRows.length, seeded[index]!))
            : index === 0
              ? safeTableRank
              : (seeded[index - 1] ?? safeTableRank)
        ));
        if (normalizedRanks.length > 0) {
          normalizedRanks[normalizedRanks.length - 1] = safeTableRank;
        }
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          ballColor: row.ballColor ?? null,
          ringColor: row.ringColor ?? null,
          textColor: row.textColor ?? null,
          ranks: normalizedRanks.length > 0 ? normalizedRanks : gwNumbers.map(() => safeTableRank),
        };
      });

      journeyMap.set(division.id, {
        divisionTitle: division.title,
        gwNumbers,
        teams,
      });
    });

    return journeyMap;
  }, [currentGw, studioTableDivisions, tableLeagueFixturesForStudio]);

  const studioTeams = useMemo(() => {
    const rowByTeamName = new Map<
      string,
      {
        division: string;
        row: {
          teamId: number;
          teamName: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          points: number;
          profit: number;
          spins: number;
          rank: number;
        };
      }
    >();
    studioTableDivisions.forEach((division) => {
      division.rows.forEach((row) => {
        rowByTeamName.set(row.teamName, { division: division.id, row });
      });
    });
    const currentGwIndex = GAMEWEEKS.indexOf(currentGw);
    const lastDivision = recapDivisionOrder[recapDivisionOrder.length - 1];

    const buildStreak = (form: Array<'W' | 'D' | 'L'>): string => {
      if (form.length === 0) {
        return 'No form';
      }
      const latest = form[form.length - 1];
      let count = 1;
      for (let idx = form.length - 2; idx >= 0; idx -= 1) {
        if (form[idx] !== latest) {
          break;
        }
        count += 1;
      }
      return `${latest}${count}`;
    };

    return Array.from(rowByTeamName.entries()).map(([teamName, rowMeta]) => {
      const division = rowMeta.division;
      const divisionLabel = displayDivisionName(division);
      const row = rowMeta.row;
      const teamMeta = teamMetaByName.get(teamName);
      const masterRow = studioMasterLeagueRowsByTeamId.get(row.teamId) ?? null;
      const forecast = divisionForecastByTeamId.get(row.teamId) ?? null;
      const divisionJourney = divisionJourneyById.get(division) ?? null;
      const divisionTableSnapshot = (leagueTable[division] ?? [])
        .slice()
        .sort(compareLeagueRowsByRank)
        .map((snapshotRow) => ({
          teamId: snapshotRow.teamId,
          teamName: snapshotRow.teamName,
          rank: snapshotRow.rank,
          played: snapshotRow.played,
          points: snapshotRow.points,
          profit: snapshotRow.profit,
          spins: snapshotRow.spins,
          ballColor: teamMetaByName.get(snapshotRow.teamName)?.ballColor ?? null,
          ringColor: teamMetaByName.get(snapshotRow.teamName)?.ringColor ?? null,
          textColor: teamMetaByName.get(snapshotRow.teamName)?.textColor ?? null,
        }));
      const seasonArchive = (teamSeasonHistoryByTeamId[row.teamId] ?? [])
        .slice()
        .sort((a, b) => seasonSortValue(b.season) - seasonSortValue(a.season));
      const previousSeasons = seasonArchive
        .filter((season) => season.season !== currentSeason)
        .slice(0, 12)
        .map((season) => {
          const predictionRace = teamPredictionRaceBySeason[season.season]?.[teamName] ?? null;
          return {
            season: season.season,
            division: displayDivisionName(season.division),
            rank: season.rank,
            points: season.points,
            profit: season.profit,
            spins: season.spins,
            cupFinish: season.cupFinish,
            superCupFinish: season.superCupFinish,
            predictionRace,
          };
        });
      const previousCupRuns = previousSeasons.map((season) => ({
        season: season.season,
        cupFinish: season.cupFinish,
      }));
      const teamLeagueFixtures = tableLeagueFixturesForStudio
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .sort((a, b) => gwSortValue(a.gw) - gwSortValue(b.gw) || a.id - b.id);
      const resolvedLeagueFixtures = teamLeagueFixtures.filter((fixture) => fixture.result !== 'pending');
      const leagueForm = resolvedLeagueFixtures
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          if (fixture.result === 'draw') {
            return 'D' as const;
          }
          const won = (fixture.result === 'home' && isHome) || (fixture.result === 'away' && !isHome);
          return won ? 'W' as const : 'L' as const;
        })
        .slice(-5);
      const teamCupFixtures = cupFixtures
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .sort((a, b) => gwSortValue(a.gw) - gwSortValue(b.gw) || a.id - b.id);
      const teamSuperCupFixtures = currentSuperCupFixtures
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .slice()
        .sort((a, b) => gwSortValue(a.gw) - gwSortValue(b.gw) || a.id - b.id);
      const settledCupFixtures = teamCupFixtures.filter((fixture) => fixture.winnerTeam !== null);
      const cupForm = settledCupFixtures
        .map((fixture) => {
          if (!fixture.homeTeam || !fixture.awayTeam) {
            return fixture.winnerTeam === teamName ? 'B' as const : 'L' as const;
          }
          return fixture.winnerTeam === teamName ? 'W' as const : 'L' as const;
        })
        .slice(-5);
      const currentFixture = currentLeagueFixturesForStudio.find((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName);
      const currentGwProfit =
        currentFixture && (currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0) > 0
          ? currentFixture.homeTeam === teamName
            ? Number(currentFixture.homeProfit.toFixed(2))
            : Number(currentFixture.awayProfit.toFixed(2))
          : null;
      const nextLeagueFixture = teamLeagueFixtures.find((fixture) => {
        const fixtureGwIndex = GAMEWEEKS.indexOf(fixture.gw);
        return fixture.result === 'pending' && fixtureGwIndex >= currentGwIndex;
      }) ?? teamLeagueFixtures.find((fixture) => fixture.result === 'pending');
      const nextCupFixture = teamCupFixtures.find((fixture) => {
        const fixtureGwIndex = GAMEWEEKS.indexOf(fixture.gw);
        return fixture.winnerTeam === null && fixtureGwIndex >= currentGwIndex;
      }) ?? teamCupFixtures.find((fixture) => fixture.winnerTeam === null);
      const nextSuperCupFixture = teamSuperCupFixtures.find((fixture) => fixture.winnerTeam === null) ?? teamSuperCupFixtures[0] ?? null;

      const recentLeagueResults = resolvedLeagueFixtures.slice(-3).map((fixture) => {
        const isHome = fixture.homeTeam === teamName;
        const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
        const oppProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
        const outcome =
          fixture.result === 'draw'
            ? 'Draw'
            : (fixture.result === 'home' && isHome) || (fixture.result === 'away' && !isHome)
              ? 'Won'
              : 'Lost';
        return {
          id: `league-${fixture.id}`,
          competition: 'League' as const,
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          score: `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`,
          outcome,
          profitImpact: formatSigned(myProfit - oppProfit),
          rivalry: false,
        };
      });
      const recentCupResults = settledCupFixtures.slice(-1).map((fixture) => {
        const home = fixture.homeTeam ?? 'TBD';
        const away = fixture.awayTeam ?? 'TBD';
        return {
          id: `cup-${fixture.id}`,
          competition: 'Cup' as const,
          fixture: `${home} vs ${away}`,
          score: fixture.winnerTeam ? `Winner: ${fixture.winnerTeam}` : 'Pending',
          outcome: fixture.winnerTeam === teamName ? 'Advanced' : 'Eliminated',
          profitImpact: '—',
          rivalry: false,
        };
      });
      const recentSuperCupResults = teamSuperCupFixtures
        .filter((fixture) => fixture.winnerTeam !== null)
        .slice(-1)
        .map((fixture) => ({
          id: `super-cup-${fixture.id}`,
          competition: 'Super Cup' as const,
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          score: `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`,
          outcome: fixture.winnerTeam === teamName ? 'Won' : 'Lost',
          profitImpact: 'Curtain-raiser',
          rivalry: false,
        }));
      const recentResults = [...recentLeagueResults, ...recentSuperCupResults, ...recentCupResults].slice(-4);

      const currentLeagueJourney = teamLeagueFixtures.map((fixture) => {
        const isHome = fixture.homeTeam === teamName;
        const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
        const profit = fixture.result === 'pending' ? null : (isHome ? fixture.homeProfit : fixture.awayProfit);
        const spins = fixture.result === 'pending' ? null : (isHome ? fixture.homeSpins : fixture.awaySpins);
        const result =
          fixture.result === 'pending'
            ? 'P' as const
            : fixture.result === 'draw'
              ? 'D' as const
              : (fixture.result === 'home' && isHome) || (fixture.result === 'away' && !isHome)
                ? 'W' as const
                : 'L' as const;
        return {
          gw: fixture.gw,
          opponent,
          venue: isHome ? 'H' as const : 'A' as const,
          result,
          profit,
          spins,
        };
      });
      const currentCupJourney = [
        ...teamSuperCupFixtures.map((fixture) => ({
          gw: fixture.gw,
          round: 'Super Cup',
          opponent: fixture.homeTeam === teamName ? fixture.awayTeam : fixture.homeTeam,
          result: fixture.winnerTeam === null
            ? 'Pending' as const
            : fixture.winnerTeam === teamName
              ? 'Advanced' as const
              : 'Out' as const,
        })),
        ...teamCupFixtures.map((fixture) => {
        const home = fixture.homeTeam ?? 'TBD';
        const away = fixture.awayTeam ?? 'TBD';
        const opponent = fixture.homeTeam === teamName ? away : fixture.awayTeam === teamName ? home : `${home} vs ${away}`;
        const result =
          fixture.winnerTeam === null
            ? 'Pending' as const
            : !fixture.homeTeam || !fixture.awayTeam
              ? fixture.winnerTeam === teamName
                ? 'Bye' as const
                : 'Out' as const
              : fixture.winnerTeam === teamName
                ? 'Advanced' as const
                : 'Out' as const;
        return {
          gw: fixture.gw,
          round: fixture.roundName,
          opponent,
          result,
        };
      }),
      ];

      const leagueGwStats = GAMEWEEKS
        .map((gw) => {
          const fixturesForGw = currentLeagueJourney.filter((journeyRow) => journeyRow.gw === gw && journeyRow.profit !== null);
          const gwProfit = fixturesForGw.reduce((sum, journeyRow) => sum + Number(journeyRow.profit ?? 0), 0);
          const gwSpins = fixturesForGw.reduce((sum, journeyRow) => sum + Number(journeyRow.spins ?? 0), 0);
          return {
            gw,
            gwProfit: Number(gwProfit.toFixed(2)),
            gwSpins,
            fixtureCount: fixturesForGw.length,
          };
        })
        .filter((rowStats) => rowStats.fixtureCount > 0);
      const bestGwStats = leagueGwStats
        .slice()
        .sort((a, b) => b.gwProfit - a.gwProfit)[0] ?? null;
      const worstGwStats = leagueGwStats
        .slice()
        .sort((a, b) => a.gwProfit - b.gwProfit)[0] ?? null;
      const totalLeagueProfit = Number(
        leagueGwStats.reduce((sum, rowStats) => sum + rowStats.gwProfit, 0).toFixed(2),
      );
      const totalLeagueSpins = leagueGwStats.reduce((sum, rowStats) => sum + rowStats.gwSpins, 0);
      const bestMatch = resolvedLeagueFixtures
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          return {
            gw: fixture.gw,
            opponent: isHome ? fixture.awayTeam : fixture.homeTeam,
            profit: isHome ? fixture.homeProfit : fixture.awayProfit,
          };
        })
        .sort((a, b) => b.profit - a.profit)[0] ?? null;

      let cumulativeProfit = 0;
      const seasonStory = OFFICIAL_DIVISION_GAMEWEEKS.map((gw) => {
        const gwProfit = teamLeagueFixtures
          .filter((fixture) => fixture.gw === gw && fixture.result !== 'pending')
          .reduce((sum, fixture) => (
            sum + (fixture.homeTeam === teamName ? fixture.homeProfit : fixture.awayProfit)
          ), 0);
        cumulativeProfit += gwProfit;
        return { gw, cumulativeProfit: Number(cumulativeProfit.toFixed(2)) };
      });

      const zoneLabel =
        division === recapDivisionOrder[0] && row.rank === 1
          ? 'Champions pace'
          : division !== recapDivisionOrder[0] && row.rank === 1
            ? 'Promotion zone'
            : division !== lastDivision && row.rank === (leagueTable[division]?.length ?? 0)
              ? 'Relegation zone'
              : 'Mid-table';
      const movementDelta = leagueMovement[division]?.[row.teamId] ?? 0;
      const divisionMovement =
        movementDelta > 0
          ? `Up ${movementDelta}`
          : movementDelta < 0
            ? `Down ${Math.abs(movementDelta)}`
            : 'No movement';
      const isGw8 = currentGw.trim().toUpperCase() === 'GW8';
      const gw8LeagueFixture = isGw8
        ? currentLeagueFixturesForStudio.find((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName) ?? null
        : null;
      const nextLeagueLabel = isGw8
        ? (gw8LeagueFixture
          ? `${gw8FixtureCompetitionLabel(gw8LeagueFixture.division)}: ${gw8LeagueFixture.homeTeam} vs ${gw8LeagueFixture.awayTeam}`
          : 'Friendly Fixture: No fixture loaded')
        : nextLeagueFixture
          ? `${nextLeagueFixture.gw}: ${nextLeagueFixture.homeTeam} vs ${nextLeagueFixture.awayTeam}`
          : 'No pending league fixture';
      const nextCupLabel = nextSuperCupFixture
        ? `${nextSuperCupFixture.gw}: Super Cup • ${nextSuperCupFixture.homeTeam} vs ${nextSuperCupFixture.awayTeam}`
        : nextCupFixture
        ? `${nextCupFixture.gw}: ${(nextCupFixture.homeTeam ?? 'TBD')} vs ${(nextCupFixture.awayTeam ?? 'TBD')}`
        : 'No pending cup fixture';
      const predictedPointsValue = forecast?.predictedPoints ?? (
        row.played > 0
          ? Math.round((row.points / row.played) * GAMEWEEKS.length)
          : row.points
      );
      const teamPredictionCredit = teamPredictionCredits.get(teamName) ?? {
        jayPoints: 0,
        jayCorrect: 0,
        computerPoints: 0,
        computerCorrect: 0,
        resolved: 0,
      };
      const lastSeasonSummary = previousSeasons[0] ?? null;
      const weeklyLeagueFixtures = currentLeagueFixturesForStudio
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
          const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
          const opponentProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const opponentEntryCount = currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0;
          const picks = currentPredictionMap.get(`league-${fixture.id}`);
          const winnerName =
            fixture.result === 'pending'
              ? null
              : fixture.result === 'draw'
                ? null
                : fixture.result === 'home'
                  ? fixture.homeTeam
                  : fixture.awayTeam;
          const statusCode: WeeklyFixtureStatusCode =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'in_play'
                : 'pending'
              : fixture.result === 'draw'
                ? 'draw'
                : winnerName === teamName
                  ? 'won'
                  : 'lost';
          const status =
            isGw8
              ? `Current score ${myEntryCount > 0 ? formatSigned(myProfit) : 'Pending'} - ${opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending'}`
              : fixture.result === 'pending'
                ? myEntryCount > 0 || opponentEntryCount > 0
                  ? 'In play'
                  : 'Pending'
                : fixture.result === 'draw'
                  ? 'As it stands, draw'
                  : `As it stands, ${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} lead`;
          return {
            id: `weekly-league-${fixture.id}`,
            competition: isGw8
              ? gw8FixtureCompetitionLabel(fixture.division)
              : `League • ${displayDivisionName(fixture.division)}`,
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeamName: fixture.homeTeam,
            awayTeamName: fixture.awayTeam,
            statusCode,
            status,
            winnerName,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
            odds: buildSpotlightFixtureOdds({
              competition: 'division',
              homeTeamId: teamIdByName.get(fixture.homeTeam) ?? null,
              awayTeamId: teamIdByName.get(fixture.awayTeam) ?? null,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeRow: divisionOddsRowByTeamId.get(teamIdByName.get(fixture.homeTeam) ?? -1) ?? null,
              awayRow: divisionOddsRowByTeamId.get(teamIdByName.get(fixture.awayTeam) ?? -1) ?? null,
              profilesByTeamId: oddsProfileByTeamId,
              teamCount: Math.max(2, leagueTable[fixture.division]?.length ?? 0),
              homeDivision: teamMetaByName.get(fixture.homeTeam)?.division ?? null,
              awayDivision: teamMetaByName.get(fixture.awayTeam)?.division ?? null,
              allowsDraw: leagueFixtureAllowsDraw(fixture),
            }),
          };
        });
      const weeklyMasterFixtures = currentMasterLeagueFixturesForStudio
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
          const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
          const opponentProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const opponentEntryCount = currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0;
          const picks = currentPredictionMap.get(`master-${fixture.id}`);
          const winnerName =
            fixture.result === 'pending'
              ? null
              : fixture.result === 'draw'
                ? null
                : fixture.result === 'home'
                  ? fixture.homeTeam
                  : fixture.awayTeam;
          const statusCode: WeeklyFixtureStatusCode =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'in_play'
                : 'pending'
              : fixture.result === 'draw'
                ? 'draw'
                : winnerName === teamName
                  ? 'won'
                  : 'lost';
          const status =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending'
              : fixture.result === 'draw'
                ? 'As it stands, draw'
                : `As it stands, ${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} lead`;
          return {
            id: `weekly-master-${fixture.id}`,
            competition: 'Master League',
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeamName: fixture.homeTeam,
            awayTeamName: fixture.awayTeam,
            statusCode,
            status,
            winnerName,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
            odds: buildSpotlightFixtureOdds({
              competition: 'master',
              homeTeamId: fixture.homeTeamId,
              awayTeamId: fixture.awayTeamId,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeRow: masterOddsRowByTeamId.get(fixture.homeTeamId) ?? null,
              awayRow: masterOddsRowByTeamId.get(fixture.awayTeamId) ?? null,
              profilesByTeamId: oddsProfileByTeamId,
              teamCount: Math.max(2, masterLeagueTable.length),
              homeDivision: teamMetaByName.get(fixture.homeTeam)?.division ?? null,
              awayDivision: teamMetaByName.get(fixture.awayTeam)?.division ?? null,
            }),
          };
        });
      const weeklyTrioFixtures = currentTrioLeagueFixturesForStudio
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
          const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
          const opponentProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const opponentEntryCount = currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0;
          const picks = currentPredictionMap.get(`trio-${fixture.id}`);
          const winnerName =
            fixture.result === 'pending'
              ? null
              : fixture.result === 'draw'
                ? null
                : fixture.result === 'home'
                  ? fixture.homeTeam
                  : fixture.awayTeam;
          const statusCode: WeeklyFixtureStatusCode =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'in_play'
                : 'pending'
              : fixture.result === 'draw'
                ? 'draw'
                : winnerName === teamName
                  ? 'won'
                  : 'lost';
          const status =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending'
              : fixture.result === 'draw'
                ? 'As it stands, draw'
                : `As it stands, ${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} lead`;
          return {
            id: `weekly-trio-${fixture.id}`,
            competition: trioFixtureCompetitionLabel(fixture),
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeamName: fixture.homeTeam,
            awayTeamName: fixture.awayTeam,
            statusCode,
            status,
            winnerName,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
            odds: buildSpotlightFixtureOdds({
              competition: 'trio',
              homeTeamId: fixture.homeTeamId,
              awayTeamId: fixture.awayTeamId,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeRow: trioOddsRowByTeamId.get(fixture.homeTeamId) ?? null,
              awayRow: trioOddsRowByTeamId.get(fixture.awayTeamId) ?? null,
              profilesByTeamId: oddsProfileByTeamId,
              teamCount: Math.max(2, trioLeagueTable.filter((rowItem) => rowItem.division === fixture.division).length),
              homeDivision: teamMetaByName.get(fixture.homeTeam)?.division ?? null,
              awayDivision: teamMetaByName.get(fixture.awayTeam)?.division ?? null,
              allowsDraw: trioFixtureAllowsDraw(fixture),
            }),
          };
        });
      const weeklyTierFixtures = currentTierLeagueFixturesForStudio
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
          const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
          const opponentProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const opponentEntryCount = currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0;
          const picks = currentPredictionMap.get(`tier-${fixture.id}`);
          const winnerName =
            fixture.result === 'pending'
              ? null
              : fixture.result === 'draw'
                ? null
                : fixture.result === 'home'
                  ? fixture.homeTeam
                  : fixture.awayTeam;
          const statusCode: WeeklyFixtureStatusCode =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'in_play'
                : 'pending'
              : fixture.result === 'draw'
                ? 'draw'
                : winnerName === teamName
                  ? 'won'
                  : 'lost';
          const status =
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending'
              : fixture.result === 'draw'
                ? 'As it stands, draw'
                : `As it stands, ${winnerName} lead`;
          return {
            id: `weekly-tier-${fixture.id}`,
            competition: tierFixtureCompetitionLabel(fixture),
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeamName: fixture.homeTeam,
            awayTeamName: fixture.awayTeam,
            statusCode,
            status,
            winnerName,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
            odds: null,
          };
        });
      const weeklyCupFixtures = currentCupFixtures
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const opponent = fixture.homeTeam === teamName ? cupSideLabel(fixture, 'away') : cupSideLabel(fixture, 'home');
          const opponentProfit = isPlaceholderTeam(opponent) ? null : currentGwProfitByTeamNameForStudio.get(opponent);
          const opponentEntryCount = isPlaceholderTeam(opponent) ? 0 : (currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0);
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const picks = currentPredictionMap.get(`cup-${fixture.id}`);
          const statusCode: WeeklyFixtureStatusCode = fixture.winnerTeam
            ? fixture.winnerTeam === teamName
              ? opponent === 'BYE'
                ? 'bye'
                : 'advanced'
              : 'out'
            : myEntryCount > 0 || opponentEntryCount > 0
              ? 'in_play'
              : 'pending';
          return {
            id: `weekly-cup-${fixture.id}`,
            competition: `Cup • ${fixture.roundName}`,
            fixture: `${cupSideLabel(fixture, 'home')} vs ${cupSideLabel(fixture, 'away')}`,
            homeTeamName: cupSideLabel(fixture, 'home'),
            awayTeamName: cupSideLabel(fixture, 'away'),
            statusCode,
            status: fixture.winnerTeam
              ? `As it stands, ${fixture.winnerTeam} are through`
              : myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending',
            winnerName: fixture.winnerTeam,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(currentGwProfitByTeamNameForStudio.get(teamName) ?? 0) : 'Pending',
            opponentScore: isPlaceholderTeam(opponent)
              ? opponent
              : opponentEntryCount > 0
                ? formatSigned(opponentProfit ?? 0)
                : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
            odds: buildSpotlightFixtureOdds({
              competition: 'cup',
              homeTeamId: fixture.homeTeam ? (teamIdByName.get(fixture.homeTeam) ?? null) : null,
              awayTeamId: fixture.awayTeam ? (teamIdByName.get(fixture.awayTeam) ?? null) : null,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeRow: fixture.homeTeam ? (divisionOddsRowByTeamId.get(teamIdByName.get(fixture.homeTeam) ?? -1) ?? null) : null,
              awayRow: fixture.awayTeam ? (divisionOddsRowByTeamId.get(teamIdByName.get(fixture.awayTeam) ?? -1) ?? null) : null,
              profilesByTeamId: oddsProfileByTeamId,
              teamCount: Math.max(2, teams.length),
              homeDivision: fixture.homeTeam ? (teamMetaByName.get(fixture.homeTeam)?.division ?? null) : null,
              awayDivision: fixture.awayTeam ? (teamMetaByName.get(fixture.awayTeam)?.division ?? null) : null,
            }),
          };
        });
      const weeklySuperCupFixtures = currentSuperCupFixtures
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const isHome = fixture.homeTeam === teamName;
          const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
          const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
          const opponentProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const opponentEntryCount = opponent ? (currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0) : 0;
          const statusCode: WeeklyFixtureStatusCode = fixture.winnerTeam
            ? fixture.winnerTeam === teamName
              ? 'advanced'
              : 'out'
            : myEntryCount > 0 || opponentEntryCount > 0
              ? 'in_play'
              : 'pending';
          return {
            id: `weekly-super-cup-${fixture.id}`,
            competition: 'Super Cup',
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeamName: fixture.homeTeam,
            awayTeamName: fixture.awayTeam,
            statusCode,
            status: fixture.winnerTeam
              ? `As it stands, ${fixture.winnerTeam} won the curtain-raiser`
              : myEntryCount > 0 || opponentEntryCount > 0
                ? 'Curtain-raiser in play'
                : 'Curtain-raiser pending',
            winnerName: fixture.winnerTeam,
            opponentName: opponent ?? null,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: 'No prediction market',
            odds: null,
          };
        });
      const weeklyMasterCupFixtures = currentMasterCupFixtures
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const opponent = fixture.homeTeam === teamName ? (fixture.awayTeam ?? 'TBD') : (fixture.homeTeam ?? 'TBD');
          const isHome = fixture.homeTeam === teamName;
          const myProfit = isHome ? fixture.homeProfit : fixture.awayProfit;
          const opponentProfit = isHome ? fixture.awayProfit : fixture.homeProfit;
          const myEntryCount = currentGwEntryCountByTeamNameWithPending.get(teamName) ?? 0;
          const opponentEntryCount = currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0;
          const picks = currentPredictionMap.get(`master_cup-${fixture.id}`);
          const statusCode: WeeklyFixtureStatusCode = fixture.winnerTeam
            ? fixture.winnerTeam === teamName
              ? 'advanced'
              : 'out'
            : myEntryCount > 0 || opponentEntryCount > 0
              ? 'in_play'
              : 'pending';
          return {
            id: `weekly-master-cup-${fixture.id}`,
            competition: `Master Cup • ${fixture.roundName}`,
            fixture: `${fixture.homeTeam ?? 'TBD'} vs ${fixture.awayTeam ?? 'TBD'}`,
            homeTeamName: fixture.homeTeam ?? 'TBD',
            awayTeamName: fixture.awayTeam ?? 'TBD',
            statusCode,
            status: fixture.winnerTeam
              ? `As it stands, ${fixture.winnerTeam} are through`
              : myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending',
            winnerName: fixture.winnerTeam,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
            odds: buildSpotlightFixtureOdds({
              competition: 'master_cup',
              homeTeamId: fixture.homeTeamId,
              awayTeamId: fixture.awayTeamId,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeRow: fixture.homeTeamId ? (masterOddsRowByTeamId.get(fixture.homeTeamId) ?? null) : null,
              awayRow: fixture.awayTeamId ? (masterOddsRowByTeamId.get(fixture.awayTeamId) ?? null) : null,
              profilesByTeamId: oddsProfileByTeamId,
              teamCount: 16,
              homeDivision: fixture.homeTeam ? (teamMetaByName.get(fixture.homeTeam)?.division ?? null) : null,
              awayDivision: fixture.awayTeam ? (teamMetaByName.get(fixture.awayTeam)?.division ?? null) : null,
              homeSeed: fixture.homeSeed,
              awaySeed: fixture.awaySeed,
            }),
          };
        });
      const weeklyFixtures = [
        ...weeklyLeagueFixtures,
        ...weeklyMasterFixtures,
        ...weeklyTrioFixtures,
        ...weeklyTierFixtures,
        ...weeklyCupFixtures,
        ...weeklySuperCupFixtures,
        ...weeklyMasterCupFixtures,
      ];

      return {
        id: row.teamId,
        name: teamName,
        currentSeason,
        currentGw,
        gameweekLocked: currentGwLocked,
        resultTruth: currentGwLocked ? 'provisional' : 'live',
        dayPhase: kickoffDayPhase.phase,
        dayPhaseLine: kickoffDayPhase.line,
        league: divisionLabel,
        ballColor: teamMeta?.ballColor ?? null,
        ringColor: teamMeta?.ringColor ?? null,
        textColor: teamMeta?.textColor ?? null,
        preseasonFavorite: teamMeta?.preseasonFavorite ?? false,
        trendCache: teamMeta?.trendCache ?? null,
        rank: row.rank,
        points: row.points,
        currentGwProfit,
        seasonProfit: row.profit,
        winRate: row.played > 0 ? Number(((row.wins / row.played) * 100).toFixed(1)) : null,
        avgProfitPerEntry: row.played > 0 ? Number((row.profit / row.played).toFixed(2)) : null,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        spins: row.spins,
        leagueForm,
        cupForm,
        streak: buildStreak(leagueForm),
        recentResults,
        weeklyFixtures,
        predictionCredit: teamPredictionCredit,
        lastSeasonSummary,
        previousSeasons,
        previousCupRuns,
        currentLeagueJourney,
        currentCupJourney,
        tableSnapshot: divisionTableSnapshot,
        analytics: {
          bestGw: bestGwStats?.gw ?? null,
          bestGwProfit: bestGwStats?.gwProfit ?? null,
          worstGw: worstGwStats?.gw ?? null,
          worstGwProfit: worstGwStats?.gwProfit ?? null,
          avgGwProfit: leagueGwStats.length > 0 ? Number((totalLeagueProfit / leagueGwStats.length).toFixed(2)) : null,
          totalLeagueProfit,
          totalLeagueSpins,
          spinEfficiency: totalLeagueSpins > 0 ? Number((totalLeagueProfit / totalLeagueSpins).toFixed(3)) : null,
          cupAdvances: currentCupJourney.filter((cupRound) => cupRound.result === 'Advanced' || cupRound.result === 'Bye').length,
          bestMatchLabel: bestMatch ? `${bestMatch.gw} vs ${bestMatch.opponent} (${formatSigned(bestMatch.profit)})` : null,
        },
        allTimeRanks: {
          points: allTimeRankMaps.points.get(row.teamId) ?? null,
          profit: allTimeRankMaps.profit.get(row.teamId) ?? null,
          spins: allTimeRankMaps.spins.get(row.teamId) ?? null,
        },
        masterPosition: masterRow
          ? {
            rank: masterRow.rank,
            points: masterRow.points,
            profit: masterRow.profit,
          }
          : null,
        divisionJourney,
        nextLeagueFixture: nextLeagueLabel,
        nextCupFixture: nextCupLabel,
        nextLeagueIsRivalry: false,
        rivalry: null,
        predictedFinish: `${ordinal(forecast?.predictedRank ?? row.rank)} in ${divisionLabel}`,
        predictedPoints: `${predictedPointsValue} pts`,
        predictedRank: forecast?.predictedRank ?? row.rank,
        forecastSummary: forecast ? {
          titleProbability: forecast.titleProbability,
          topHalfProbability: forecast.topHalfProbability,
          bottomProbability: forecast.bottomProbability,
          promotionProbability: forecast.promotionProbability,
          playoffProbability: forecast.playoffProbability,
          relegationProbability: forecast.relegationProbability,
          remainingFixtures: forecast.remainingFixtures,
          remainingDifficultyAverage: forecast.remainingDifficultyAverage,
          remainingDifficultyRank: forecast.remainingDifficultyRank,
          remainingDifficultyLabel: forecast.remainingDifficultyLabel,
          projectedDelta: forecast.projectedDelta,
          modelReasonsUp: forecast.modelReasonsUp,
          modelReasonsDown: forecast.modelReasonsDown,
        } : null,
        zoneLabel,
        divisionMovement,
        seasonStory,
      };
    });
  }, [
    tableLeagueFixturesForStudio,
    cupFixtures,
    currentGwLocked,
    currentCupFixtures,
    currentSuperCupFixtures,
    currentGw,
    currentGwEntryCountByTeamNameWithPending,
    currentGwProfitByTeamNameForStudio,
    currentLeagueFixturesForStudio,
    currentMasterCupFixtures,
    currentMasterLeagueFixturesForStudio,
    currentPredictionMap,
    currentSeason,
    currentTierLeagueFixturesForStudio,
    allTimeRankMaps,
    divisionForecastByTeamId,
    divisionJourneyById,
    kickoffDayPhase.line,
    kickoffDayPhase.phase,
    leagueMovement,
    leagueTable,
    masterLeagueTable.length,
    masterOddsRowByTeamId,
    oddsProfileByTeamId,
    recapDivisionOrder,
    studioTableDivisions,
    studioMasterLeagueRowsByTeamId,
    teamMetaByName,
    teamIdByName,
    teamPredictionCredits,
    teamPredictionRaceBySeason,
    teamSeasonHistoryByTeamId,
    teams.length,
    tierLeagueTable,
    trioLeagueTable,
    trioOddsRowByTeamId,
  ]);

  const studioFixtureGroups = useMemo(() => {
    const leagueDivisionOrder = [...recapDivisionOrder, 'Playoff', 'Friendly'];
    const divisionIndex = new Map(leagueDivisionOrder.map((division, idx) => [division, idx]));
    const leagueDivisions = Array.from(new Set(currentLeagueFixturesForStudio.map((fixture) => fixture.division)))
      .sort((a, b) => {
        const aIdx = divisionIndex.get(a) ?? 999;
        const bIdx = divisionIndex.get(b) ?? 999;
        return aIdx - bIdx || a.localeCompare(b);
      });
    const groups = leagueDivisions
      .map((division) => {
        const fixtures = currentLeagueFixturesForStudio
          .filter((fixture) => fixture.division === division)
          .sort((a, b) => a.id - b.id);
        if (fixtures.length === 0) {
          return null;
        }
        const title = division === 'Playoff'
          ? 'Playoff Ties'
          : division === 'Friendly'
            ? 'Friendly Fixtures'
            : `${displayDivisionName(division)} Fixtures`;
        return {
          id: `division-${division}`,
          title,
          subtitle: `${currentGw} • ${kickoffDayPhase.label} • ${studioTruthLabel}`,
          fixtures: fixtures.map((fixture) => {
            const picks = currentPredictionMap.get(`league-${fixture.id}`);
            const homeEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0;
            const awayEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0;
            const hasEntrySignal = homeEntries > 0 || awayEntries > 0;
            const statusCode = fixtureStatusForStudio(fixture.result, hasEntrySignal, currentGwLocked, fixture.gw === currentGw);
            const homeScore = currentGwProfitByTeamNameForStudio.get(fixture.homeTeam) ?? null;
            const awayScore = currentGwProfitByTeamNameForStudio.get(fixture.awayTeam) ?? null;
            const liveScore = homeScore !== null && awayScore !== null
              ? `${homeScore.toFixed(2)} - ${awayScore.toFixed(2)}`
              : 'Live';
            const score = statusCode === 'pending'
              ? 'vs'
              : statusCode === 'in_play'
                ? liveScore
                : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
            const swing = `${Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2)} swing`;
            const profitImpact = statusCode === 'pending'
              ? 'Pending'
              : statusCode === 'in_play'
                ? 'Still in play'
                : statusCode === 'provisional'
                  ? `${swing} (as it stands)`
                  : swing;
            return {
              id: `league-${fixture.id}`,
              fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
              statusCode,
              score,
              outcome: formatStudioOutcome(fixture.result, fixture.homeTeam, fixture.awayTeam, statusCode),
              profitImpact,
              picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
              rivalry: false,
            };
          }),
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);

    if (currentMasterLeagueFixturesForStudio.length > 0) {
      groups.push({
        id: `master-${currentGw}`,
        title: `Master League • ${currentGw}`,
        subtitle: `${kickoffDayPhase.label} • ${studioTruthLabel}`,
        fixtures: currentMasterLeagueFixturesForStudio
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((fixture) => {
            const picks = currentPredictionMap.get(`master-${fixture.id}`);
            const homeEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0;
            const awayEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0;
            const hasEntrySignal = homeEntries > 0 || awayEntries > 0;
            const statusCode = fixtureStatusForStudio(fixture.result, hasEntrySignal, currentGwLocked, fixture.gw === currentGw);
            const homeScore = currentGwProfitByTeamNameForStudio.get(fixture.homeTeam) ?? null;
            const awayScore = currentGwProfitByTeamNameForStudio.get(fixture.awayTeam) ?? null;
            const liveScore = homeScore !== null && awayScore !== null
              ? `${homeScore.toFixed(2)} - ${awayScore.toFixed(2)}`
              : 'Live';
            const score = statusCode === 'pending'
              ? 'vs'
              : statusCode === 'in_play'
                ? liveScore
                : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
            const swing = `${Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2)} swing`;
            const profitImpact = statusCode === 'pending'
              ? 'Pending'
              : statusCode === 'in_play'
                ? 'Still in play'
                : statusCode === 'provisional'
                  ? `${swing} (as it stands)`
                  : swing;
            return {
              id: `master-${fixture.id}`,
              fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
              statusCode,
              score,
              outcome: formatStudioOutcome(fixture.result, fixture.homeTeam, fixture.awayTeam, statusCode),
              profitImpact,
              picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
              rivalry: false,
            };
          }),
      });
    }

    if (currentTrioLeagueFixturesForStudio.length > 0) {
      groups.push({
        id: `trio-${currentGw}`,
        title: `Trio League • ${currentGw}`,
        subtitle: `${kickoffDayPhase.label} • ${studioTruthLabel}`,
        fixtures: currentTrioLeagueFixturesForStudio
          .slice()
          .sort((a, b) => a.division.localeCompare(b.division) || a.groupSlot - b.groupSlot || a.id - b.id)
          .map((fixture) => {
            const picks = currentPredictionMap.get(`trio-${fixture.id}`);
            const homeEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0;
            const awayEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0;
            const hasEntrySignal = homeEntries > 0 || awayEntries > 0;
            const statusCode = fixtureStatusForStudio(fixture.result, hasEntrySignal, currentGwLocked, fixture.gw === currentGw);
            const homeScore = currentGwProfitByTeamNameForStudio.get(fixture.homeTeam) ?? null;
            const awayScore = currentGwProfitByTeamNameForStudio.get(fixture.awayTeam) ?? null;
            const liveScore = homeScore !== null && awayScore !== null
              ? `${homeScore.toFixed(2)} - ${awayScore.toFixed(2)}`
              : 'Live';
            const score = statusCode === 'pending'
              ? 'vs'
              : statusCode === 'in_play'
                ? liveScore
                : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
            const swing = `${Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2)} swing`;
            const profitImpact = statusCode === 'pending'
              ? trioFixtureCompetitionLabel(fixture)
              : statusCode === 'in_play'
                ? `${trioFixtureCompetitionLabel(fixture)} • Still in play`
                : statusCode === 'provisional'
                  ? `${trioFixtureCompetitionLabel(fixture)} • ${swing} (as it stands)`
                  : `${trioFixtureCompetitionLabel(fixture)} • ${swing}`;
            return {
              id: `trio-${fixture.id}`,
              fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
              statusCode,
              score,
              outcome: formatStudioOutcome(fixture.result, fixture.homeTeam, fixture.awayTeam, statusCode),
              profitImpact,
              picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
              rivalry: false,
            };
          }),
      });
    }

    if (currentCupFixtures.length > 0) {
      groups.push({
        id: `cup-${currentGw}`,
        title: `Cup • ${currentGw}`,
        subtitle: `${kickoffDayPhase.label} • ${studioTruthLabel}`,
        fixtures: currentCupFixtures
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((fixture) => {
            const allowBye = fixture.gw === 'GW2';
            const home = fixture.homeTeam ?? (allowBye && fixture.awayTeam ? 'BYE' : 'TBD');
            const away = fixture.awayTeam ?? (allowBye && fixture.homeTeam ? 'BYE' : 'TBD');
            const picks = currentPredictionMap.get(`cup-${fixture.id}`);
            const homeEntries = fixture.homeTeam ? (currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0) : 0;
            const awayEntries = fixture.awayTeam ? (currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0) : 0;
            const hasEntrySignal = homeEntries > 0 || awayEntries > 0;
            const homeScore = fixture.homeTeam ? currentGwProfitByTeamNameForStudio.get(fixture.homeTeam) : null;
            const awayScore = fixture.awayTeam ? currentGwProfitByTeamNameForStudio.get(fixture.awayTeam) : null;
            const byeWinner = allowBye && fixture.homeTeam && !fixture.awayTeam
              ? fixture.homeTeam
              : allowBye && !fixture.homeTeam && fixture.awayTeam
                ? fixture.awayTeam
                : null;
            const resolvedWinner = fixture.winnerTeam ?? byeWinner;
            const statusCode: FixtureSlideStatusCode = resolvedWinner
              ? fixture.gw === currentGw
                ? 'provisional'
                : 'final_confirmed'
              : hasEntrySignal
                ? 'in_play'
                : 'pending';
            const liveScore = homeScore !== null && awayScore !== null
              ? `${homeScore.toFixed(2)} - ${awayScore.toFixed(2)}`
              : 'Live';
            const score =
              homeScore !== null && awayScore !== null
                ? `${homeScore.toFixed(2)} - ${awayScore.toFixed(2)}`
                : statusCode === 'pending'
                  ? 'vs'
                  : 'Live';
            const outcome = statusCode === 'pending'
              ? 'Kick-off pending'
              : statusCode === 'in_play'
                ? 'Still in play'
                : statusCode === 'provisional'
                  ? resolvedWinner
                    ? `As it stands, ${resolvedWinner} advanced`
                    : 'As it stands, winner call pending'
                  : resolvedWinner
                    ? `Confirmed winner: ${resolvedWinner}`
                    : 'Confirmed winner call pending';
            return {
              id: `cup-${fixture.id}`,
              fixture: `${home} vs ${away}`,
              statusCode,
              score,
              outcome,
              profitImpact: statusCode === 'provisional' ? 'Provisional' : statusCode === 'final_confirmed' ? 'Confirmed' : '—',
              picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
              rivalry: false,
            };
          }),
      });
    }

    if (currentSuperCupFixtures.length > 0) {
      groups.push({
        id: `super-cup-${currentGw}`,
        title: `Super Cup • ${currentGw}`,
        subtitle: `${kickoffDayPhase.label} • ${studioTruthLabel}`,
        fixtures: currentSuperCupFixtures
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((fixture) => {
            const homeEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0;
            const awayEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0;
            const hasEntrySignal = homeEntries > 0 || awayEntries > 0;
            const statusCode: FixtureSlideStatusCode = fixture.winnerTeam
              ? fixture.gw === currentGw
                ? 'provisional'
                : 'final_confirmed'
              : hasEntrySignal
                ? 'in_play'
                : 'pending';
            const score = hasEntrySignal || fixture.played
              ? `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`
              : 'vs';
            const outcome = fixture.winnerTeam
              ? statusCode === 'final_confirmed'
                ? `Confirmed winner: ${fixture.winnerTeam}`
                : `As it stands, ${fixture.winnerTeam} lead the opener`
              : hasEntrySignal
                ? 'Curtain-raiser in play'
                : 'Kick-off pending';
            return {
              id: `super-cup-${fixture.id}`,
              fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
              statusCode,
              score,
              outcome,
              profitImpact: fixture.pairingExplanation,
              picks: 'No prediction market',
              rivalry: false,
            };
          }),
      });
    }

    return groups;
  }, [
    currentCupFixtures,
    currentGw,
    currentGwEntryCountByTeamNameWithPending,
    currentGwLocked,
    currentLeagueFixturesForStudio,
    currentMasterLeagueFixturesForStudio,
    currentSuperCupFixtures,
    currentTrioLeagueFixturesForStudio,
    currentPredictionMap,
    kickoffDayPhase.label,
    recapDivisionOrder,
    studioTruthLabel,
  ]);

  const studioRivalries = useMemo(() => {
    return currentLeagueFixturesForStudio
      .filter((fixture) => fixture.result !== 'pending')
      .sort((a, b) => Math.abs(a.homeProfit - a.awayProfit) - Math.abs(b.homeProfit - b.awayProfit))
      .slice(0, 2)
      .map((fixture) => ({
        id: `league-${fixture.id}`,
        title: displayDivisionName(fixture.division),
        matchup: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        record: `Current season meeting`,
        profitSwing: `${Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2)}`,
        outcome: formatOutcome(fixture.result, fixture.homeTeam, fixture.awayTeam),
        winnerHighlight:
          fixture.result === 'draw'
            ? 'Evenly matched'
            : fixture.result === 'home'
              ? fixture.homeTeam
              : fixture.awayTeam,
      }));
  }, [currentLeagueFixturesForStudio]);

  const studioMovements = useMemo(() => {
    const moves: Array<{ division: string; teamId: number; teamName: string; delta: number }> = [];
    recapDivisionOrder.forEach((division) => {
      (leagueTable[division] ?? []).forEach((row) => {
        const delta = leagueMovement[division]?.[row.teamId] ?? 0;
        if (delta === 0) {
          return;
        }
        moves.push({ division, teamId: row.teamId, teamName: row.teamName, delta });
      });
    });

    const ordered = moves
      .slice()
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6)
      .map((item) => ({
        id: `${item.division}-${item.teamId}`,
        headline: `${item.teamName} ${item.delta > 0 ? 'climb' : 'slide'} in ${displayDivisionName(item.division)}`,
        detail:
          item.delta > 0
            ? `Up ${item.delta} place${item.delta > 1 ? 's' : ''} versus the movement baseline.`
            : `Down ${Math.abs(item.delta)} place${Math.abs(item.delta) > 1 ? 's' : ''} versus the movement baseline.`,
        label: item.teamName,
        direction: item.delta > 0 ? 'up' as const : 'down' as const,
        value: item.delta > 0 ? `+${item.delta}` : `${item.delta}`,
      }));

    if (ordered.length > 0) {
      return ordered;
    }

    const leader = studioTableDivisions[0]?.rows[0];
    if (!leader) {
      return [];
    }
    return [
      {
        id: `steady-${leader.teamId}`,
        headline: `${leader.teamName} hold the top spot`,
        detail: 'No league position changes recorded yet this week.',
        label: leader.teamName,
        direction: 'flat' as const,
        value: '0',
      },
    ];
  }, [leagueMovement, leagueTable, recapDivisionOrder, studioTableDivisions]);

  const officialDivisionSeasonComplete = currentGw === 'GW8' || (currentGw === 'GW7' && currentGwLocked);

  const studioTickerItems = useMemo(() => {
    const items: string[] = [];
    if (storylinePayload?.tickerItems?.length) {
      items.push(...storylinePayload.tickerItems.slice(0, 6));
    }
    items.push(`${kickoffDayPhase.label} • ${kickoffDayPhase.line}`);
    items.push(`${currentGw} • ${studioTruthLabel} • League ${currentLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length}/${currentLeagueFixturesForStudio.length} updated`);
    if (currentMasterLeagueFixturesForStudio.length > 0) {
      items.push(`${currentGw} • ${studioTruthLabel} • Master ${currentMasterLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length}/${currentMasterLeagueFixturesForStudio.length} updated`);
    }
    if (currentTrioLeagueFixturesForStudio.length > 0) {
      items.push(`${currentGw} • ${studioTruthLabel} • Trio ${currentTrioLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length}/${currentTrioLeagueFixturesForStudio.length} updated`);
    }
    if (currentCupFixtures.length > 0) {
      items.push(`${currentGw} • ${studioTruthLabel} • Cup ${currentCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length}/${currentCupFixtures.length} updated`);
    }
    if (currentSuperCupFixtures.length > 0) {
      items.push(`${currentGw} • ${studioTruthLabel} • Super Cup ${currentSuperCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length}/${currentSuperCupFixtures.length} updated`);
    }
    currentLeagueFixturesForStudio
      .filter((fixture) => fixture.result !== 'pending')
      .slice(0, 8)
      .forEach((fixture) => {
        const leader =
          fixture.result === 'draw'
            ? 'Level'
            : fixture.result === 'home'
              ? fixture.homeTeam
              : fixture.awayTeam;
        items.push(`${displayDivisionName(fixture.division)}: as it stands ${leader} • ${fixture.homeProfit.toFixed(2)}-${fixture.awayProfit.toFixed(2)}`);
      });
    if (items.length === 0) {
      items.push(`Waiting for ${currentGw} results to come in.`);
    }
    return items;
  }, [
    currentCupFixtures,
    currentGw,
    currentLeagueFixturesForStudio,
    currentMasterLeagueFixturesForStudio,
    currentSuperCupFixtures,
    currentTrioLeagueFixturesForStudio,
    kickoffDayPhase.label,
    kickoffDayPhase.line,
    storylinePayload,
    studioTruthLabel,
  ]);

  const verifiedFactRailItems = useMemo<VerifiedFactRailItem[]>(() => {
    const items: VerifiedFactRailItem[] = [];
    recapDivisionOrder.forEach((division) => {
      const leader = (leagueTable[division] ?? []).slice().sort(compareLeagueRowsByRank)[0];
      if (!leader) {
        return;
      }
      items.push({
        id: `verified-${division}`,
        label: displayDivisionName(division),
        headline: officialDivisionSeasonComplete ? `${leader.teamName} won the division` : `${leader.teamName} lead the table`,
        detail: `PLD ${leader.played} • ${leader.points} pts • ${formatSigned(leader.profit)} profit`,
        tone: 'results',
      });
    });
    const masterLeader = masterLeagueTable.slice().sort(compareLeagueRowsByRank)[0];
    if (masterLeader) {
      items.push({
        id: 'verified-master',
        label: 'Master League',
        headline: `${masterLeader.teamName} set the pace`,
        detail: `PLD ${masterLeader.played} • ${masterLeader.points} pts • ${formatSigned(masterLeader.profit)} profit`,
        tone: 'competition',
      });
    }
    if (isSeasonFiveOrLater(currentSeason)) {
      ['Premier League', 'Ligue 1', 'Bundesliga'].forEach((division) => {
        const leader = trioLeagueTable
          .filter((row) => row.division === division)
          .slice()
          .sort(compareLeagueRowsByRank)[0];
        if (!leader) {
          return;
        }
        items.push({
          id: `verified-trio-${division}`,
          label: division,
          headline: `${leader.teamName} top ${division}`,
          detail: `PLD ${leader.played} • ${leader.points} pts • ${formatSigned(leader.profit)} profit`,
          tone: 'competition',
        });
      });
    }
    const liveCupFixture = currentCupFixtures.find((fixture) => fixture.homeTeam && fixture.awayTeam) ?? null;
    if (liveCupFixture) {
      items.push({
        id: `verified-cup-${liveCupFixture.id}`,
        label: 'Bookie Ball Cup',
        headline: `${cupSideLabel(liveCupFixture, 'home')} vs ${cupSideLabel(liveCupFixture, 'away')}`,
        detail: `${cupFixtureScoreLabel(liveCupFixture)} • ${cupFixtureDetailLabel(liveCupFixture)}`,
        tone: 'fixtures',
      });
    }
    if (currentSuperCupFixtures[0]) {
      const fixture = currentSuperCupFixtures[0];
      items.push({
        id: `verified-super-cup-${fixture.id}`,
        label: 'Super Cup',
        headline: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        detail: fixture.winnerTeam
          ? `${fixture.homeProfit.toFixed(2)}-${fixture.awayProfit.toFixed(2)} • ${fixture.winnerTeam} won the standalone curtain-raiser`
          : fixture.pairingExplanation,
        tone: 'fixtures',
      });
    }
    if (isSeasonFiveOrLater(currentSeason) && currentMasterCupFixtures[0]) {
      const fixture = currentMasterCupFixtures[0];
      items.push({
        id: `verified-master-cup-${fixture.id}`,
        label: 'Master Cup',
        headline: `${fixture.homeTeam ?? 'TBD'} vs ${fixture.awayTeam ?? 'TBD'}`,
        detail: `${fixture.roundName} • ${fixture.homeProfit.toFixed(2)}-${fixture.awayProfit.toFixed(2)}${fixture.winnerTeam ? ` • ${fixture.winnerTeam} through` : ''}`,
        tone: 'fixtures',
      });
    }
    if (bookieDorBoard?.holder) {
      items.push({
        id: `verified-bookie-dor-${bookieDorBoard.holder.teamId}`,
        label: "Bookie d'Or",
        headline: `${bookieDorBoard.holder.teamName} hold the lead`,
        detail: `Score ${bookieDorBoard.holder.score.toFixed(1)} • League rank ${bookieDorBoard.holder.leagueRank} • All competitions included`,
        tone: 'movement',
      });
    }
    if (allTimeLeagues?.pointsTable?.[0]) {
      const leader = allTimeLeagues.pointsTable[0];
      items.push({
        id: `verified-alltime-${leader.teamId}`,
        label: 'All-Time Points',
        headline: `${leader.teamName} lead the archive`,
        detail: `${leader.points} pts • ${formatSigned(leader.profit)} profit • ${leader.spins} spins`,
        tone: 'movement',
      });
    }
    return items;
  }, [
    allTimeLeagues,
    bookieDorBoard,
    currentCupFixtures,
    currentSuperCupFixtures,
    currentMasterCupFixtures,
    currentSeason,
    leagueTable,
    masterLeagueTable,
    officialDivisionSeasonComplete,
    recapDivisionOrder,
    trioLeagueTable,
  ]);

  const kickoffOddsPackages = useMemo<SkyStudioBroadcastPackage[]>(() => {
    const packages: SkyStudioBroadcastPackage[] = [];

    const renderFactChips = (facts: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }>) => (
      <div className="studio-live-facts">
        {facts.map((fact) => (
          <span
            key={fact.label}
            className={`studio-live-fact-chip${fact.tone ? ` ${fact.tone}` : ''}`}
          >
            {fact.label}
          </span>
        ))}
      </div>
    );

    const buildTeamFactChips = (
      profile: OddsTeamProfile,
      currentRow: OddsCurrentRow | null,
      teamCount: number,
      seed: number | null,
      liveProfit?: number | null,
      liveEntries?: number,
      limit = 3,
    ): Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }> => {
      const chips: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }> = [];
      if (seed) {
        chips.push({ label: `Seed ${seed}`, tone: 'accent' });
      }
      if (currentRow && currentRow.played > 0) {
        const highRankCutoff = Math.max(2, Math.ceil(teamCount / 4));
        const lowRankCutoff = Math.max(highRankCutoff + 1, teamCount - 1);
        chips.push({
          label: `${ordinal(currentRow.rank)} • PLD ${currentRow.played} • ${currentRow.points} pts`,
          tone: currentRow.rank <= highRankCutoff ? 'positive' : currentRow.rank >= lowRankCutoff ? 'warning' : undefined,
        });
        chips.push({
          label: `${formatSigned(currentRow.profit)} profit • ${compactRecord(currentRow)}`,
          tone: currentRow.profit > 0 ? 'positive' : currentRow.profit < 0 ? 'warning' : undefined,
        });
      }
      if ((liveEntries ?? 0) > 0) {
        chips.push({
          label: `${liveEntries} live entr${liveEntries === 1 ? 'y' : 'ies'} • ${formatSigned(liveProfit ?? 0)}`,
          tone: (liveProfit ?? 0) > 0 ? 'positive' : (liveProfit ?? 0) < 0 ? 'warning' : 'accent',
        });
      }
      const titles = countHistoricalTitles(profile.history);
      if (titles > 0) {
        chips.push({ label: `${titles} title${titles === 1 ? '' : 's'}`, tone: 'accent' });
      }
      const lastSeason = latestArchivedSeasonRow(profile.history, currentSeason);
      if (lastSeason) {
        chips.push({
          label: `${lastSeason.season} ${ordinal(lastSeason.rank)} in ${displayDivisionName(lastSeason.division)}`,
        });
      }
      const trend = teamMetaByName.get(profile.teamName)?.trendCache;
      if (trend && trend.windowSize > 0 && trend.rankDelta !== 0) {
        chips.push({
          label: trend.rankDelta > 0
            ? `up ${trend.rankDelta} over last ${trend.windowSize}`
            : `down ${Math.abs(trend.rankDelta)} over last ${trend.windowSize}`,
          tone: trend.rankDelta > 0 ? 'positive' : 'warning',
        });
      }
      if (chips.length === 0) {
        chips.push({ label: 'Archive still forming' });
      }
      return chips.slice(0, limit);
    };

    const buildDrawFactChips = (
      homeRow: OddsCurrentRow | null,
      awayRow: OddsCurrentRow | null,
      competition: 'division' | 'master' | 'trio' | 'cup' | 'master_cup',
      title: string,
      liveProfitGap?: number,
      liveEntries?: number,
    ): Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }> => {
      const chips: Array<{ label: string; tone?: 'positive' | 'warning' | 'accent' }> = [];
      if (homeRow && awayRow && homeRow.played > 0 && awayRow.played > 0) {
        const pointsGap = Math.abs(homeRow.points - awayRow.points);
        const profitGap = Math.abs(homeRow.profit - awayRow.profit);
        chips.push({ label: `${pointsGap} point gap`, tone: pointsGap <= 2 ? 'positive' : undefined });
        chips.push({ label: `${profitGap.toFixed(2)} profit split`, tone: profitGap <= 0.5 ? 'positive' : undefined });
      }
      if ((liveEntries ?? 0) > 0) {
        chips.push({
          label: `${(liveProfitGap ?? 0).toFixed(2)} live gap after ${liveEntries} entries`,
          tone: Math.abs(liveProfitGap ?? 0) <= 0.2 ? 'positive' : undefined,
        });
      }
      if (competition === 'cup') {
        chips.push({ label: 'Level profit -> spins', tone: 'accent' });
      } else if (competition === 'master_cup' && /semi/i.test(title)) {
        chips.push({ label: 'Aggregate decides the tie', tone: 'accent' });
      } else if (competition === 'master_cup') {
        chips.push({ label: 'Level tie -> higher seed', tone: 'accent' });
      } else if (competition === 'division' && /playoff/i.test(title)) {
        chips.push({ label: 'Level profit -> your penalties', tone: 'accent' });
      }
      if (chips.length === 0) {
        chips.push({ label: 'Ratings tight enough to keep draw live' });
      }
      return chips.slice(0, 2);
    };

    const buildOutrightRow = (
      key: string,
      teamId: number,
      teamName: string,
      odds: number,
      probability: number,
      currentRow: OddsCurrentRow | null,
      teamCount: number,
      fallbackDetail: string,
    ): OddsBoardRow => {
      const profile = oddsProfileByTeamId.get(teamId);
      const teamMeta = teamMetaByName.get(teamName);
      return {
        key,
        label: teamName,
        odds,
        probability,
        detail: currentRow && currentRow.played > 0
          ? `PLD ${currentRow.played} • ${currentRow.points} pts • ${formatSigned(currentRow.profit)}`
          : fallbackDetail,
        facts: profile
          ? buildTeamFactChips(profile, currentRow, Math.max(2, teamCount), null, 3)
          : [{ label: fallbackDetail }],
        ballColor: teamMeta?.ballColor ?? null,
        ringColor: teamMeta?.ringColor ?? null,
        textColor: teamMeta?.textColor ?? null,
      };
    };

    const buildFixtureOddsCard = (
      title: string,
      fixture: {
        id: number;
        gw?: string;
        division?: string;
        stage?: TrioFixture['stage'];
        homeTeam: string;
        awayTeam: string;
        result?: 'home' | 'away' | 'draw' | 'pending';
        homeSeed?: number | null;
        awaySeed?: number | null;
        homeProfit?: number;
        awayProfit?: number;
      },
      competition: 'division' | 'master' | 'trio' | 'cup' | 'master_cup',
      currentRowsByTeamId: Map<number, OddsCurrentRow>,
      explicitTeamCount?: number,
      detail?: string,
    ): FixtureOddsCard | null => {
      const homeTeamId = teamIdByName.get(fixture.homeTeam);
      const awayTeamId = teamIdByName.get(fixture.awayTeam);
      if (!homeTeamId || !awayTeamId) {
        return null;
      }
      const homeProfile = oddsProfileByTeamId.get(homeTeamId);
      const awayProfile = oddsProfileByTeamId.get(awayTeamId);
      if (!homeProfile || !awayProfile) {
        return null;
      }
      const allowsDraw = !(
        competition === 'division'
        && fixture.gw
        && fixture.division
        && isGw8DivisionPlayoffFixture({ gw: fixture.gw, division: fixture.division })
      ) && !(
        competition === 'trio'
        && fixture.stage
        && !trioFixtureAllowsDraw({ stage: fixture.stage })
      );
      const teamCount = explicitTeamCount ?? Math.max(2, currentRowsByTeamId.size || 2);
      const homeRow = currentRowsByTeamId.get(homeTeamId) ?? null;
      const awayRow = currentRowsByTeamId.get(awayTeamId) ?? null;
      const model = buildFixtureOdds({
        home: homeProfile,
        away: awayProfile,
        homeRow,
        awayRow,
        teamCount,
        competition,
        homeSeed: fixture.homeSeed ?? null,
        awaySeed: fixture.awaySeed ?? null,
      });
      const homeEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0;
      const awayEntries = currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0;
      const liveHomeProfit = typeof fixture.homeProfit === 'number'
        ? fixture.homeProfit
        : (currentGwProfitByTeamNameForStudio.get(fixture.homeTeam) ?? 0);
      const liveAwayProfit = typeof fixture.awayProfit === 'number'
        ? fixture.awayProfit
        : (currentGwProfitByTeamNameForStudio.get(fixture.awayTeam) ?? 0);
      const liveEntryTotal = homeEntries + awayEntries;
      const liveProfitGap = liveHomeProfit - liveAwayProfit;
      let adjustedHomeProbability = model.homeProbability;
      let adjustedDrawProbability = model.drawProbability;
      let adjustedAwayProbability = model.awayProbability;
      if (liveEntryTotal > 0) {
        const profitSwing = Math.max(-0.16, Math.min(0.16, liveProfitGap * 0.09));
        const entrySwing = Math.max(-0.06, Math.min(0.06, (homeEntries - awayEntries) * 0.012));
        const totalSwing = Math.max(-0.18, Math.min(0.18, profitSwing + entrySwing));
        const drawSqueeze = Math.max(0, Math.min(0.06, Math.abs(totalSwing) * 0.45 + liveEntryTotal * 0.0025));
        const normalized = normalizeMarketProbabilities(
          model.homeProbability + totalSwing,
          model.drawProbability - drawSqueeze,
          model.awayProbability - totalSwing,
        );
        adjustedHomeProbability = normalized.home;
        adjustedDrawProbability = normalized.draw;
        adjustedAwayProbability = normalized.away;
      }
      if (!allowsDraw) {
        const twoWayTotal = Math.max(0.001, adjustedHomeProbability + adjustedAwayProbability);
        adjustedHomeProbability /= twoWayTotal;
        adjustedAwayProbability /= twoWayTotal;
        adjustedDrawProbability = 0;
      }
      const homeMeta = teamMetaByName.get(fixture.homeTeam);
      const awayMeta = teamMetaByName.get(fixture.awayTeam);
      const liveMarketLine = liveEntryTotal > 0
        ? `${liveProfitGap === 0 ? 'Live market level' : `${liveProfitGap > 0 ? fixture.homeTeam : fixture.awayTeam} currently lead the live board by ${Math.abs(liveProfitGap).toFixed(2)}`}.`
        : null;
      const marketGap = Math.abs(adjustedHomeProbability - adjustedAwayProbability);
      const strongestSelection = [
        { label: fixture.homeTeam, probability: adjustedHomeProbability },
        ...(allowsDraw ? [{ label: 'Draw', probability: adjustedDrawProbability }] : []),
        { label: fixture.awayTeam, probability: adjustedAwayProbability },
      ].sort((left, right) => right.probability - left.probability)[0];
      const stamp = liveEntryTotal > 0
        ? 'MARKET MOVING'
        : allowsDraw && strongestSelection.label === 'Draw'
          ? 'DRAW LIVE'
          : marketGap <= 0.05
            ? 'COIN FLIP'
            : 'EDGE';
      const stampTone: FixtureOddsCard['stampTone'] = liveEntryTotal > 0
        ? 'movement'
        : allowsDraw && strongestSelection.label === 'Draw'
          ? 'fixtures'
          : marketGap <= 0.05
            ? 'warning'
            : 'positive';
      const marketNote = !allowsDraw
        ? `${strongestSelection.label} are market favourite at ${formatProbability(strongestSelection.probability)}. Level profit goes to penalties.`
        : strongestSelection.label === 'Draw'
        ? `Draw is the shortest route at ${formatProbability(adjustedDrawProbability)}.`
        : `${strongestSelection.label} are market favourite at ${formatProbability(strongestSelection.probability)}.`;
      return {
        key: `${competition}-${fixture.id}`,
        title,
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        badgeTone: competitionBadgeTone(competition),
        stamp,
        stampTone,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeOdds: probabilityToOdds(adjustedHomeProbability),
        drawOdds: allowsDraw ? probabilityToOdds(adjustedDrawProbability) : null,
        awayOdds: probabilityToOdds(adjustedAwayProbability),
        homeProbability: adjustedHomeProbability,
        drawProbability: adjustedDrawProbability,
        awayProbability: adjustedAwayProbability,
        allowsDraw,
        reason: liveMarketLine
          ? `${model.reason}. ${liveMarketLine}${allowsDraw ? '' : ' Level profit goes to penalties.'}`
          : allowsDraw
            ? model.reason
            : `${model.reason}. Level profit goes to penalties.`,
        detail: liveEntryTotal > 0
          ? `${detail ? `${detail} ` : ''}Live pricing is reacting to ${liveEntryTotal} entry updates on this tie.`
          : detail,
        marketNote,
        homeFacts: buildTeamFactChips(homeProfile, homeRow, teamCount, fixture.homeSeed ?? null, liveHomeProfit, homeEntries, 3),
        drawFacts: allowsDraw
          ? buildDrawFactChips(homeRow, awayRow, competition, title, liveProfitGap, liveEntryTotal)
          : [{ label: 'Level profit -> your penalties', tone: 'accent' }],
        awayFacts: buildTeamFactChips(awayProfile, awayRow, teamCount, fixture.awaySeed ?? null, liveAwayProfit, awayEntries, 3),
        homeBallColor: homeMeta?.ballColor ?? null,
        homeRingColor: homeMeta?.ringColor ?? null,
        homeTextColor: homeMeta?.textColor ?? null,
        awayBallColor: awayMeta?.ballColor ?? null,
        awayRingColor: awayMeta?.ringColor ?? null,
        awayTextColor: awayMeta?.textColor ?? null,
      };
    };

    const buildFixturePackage = (
      id: string,
      label: string,
      headline: string,
      kicker: string,
      subtitle: string,
      cards: FixtureOddsCard[],
    ): SkyStudioBroadcastPackage | null => {
      if (cards.length === 0) {
        return null;
      }
      const shortestPrice = cards
        .flatMap((card) => ([
          { label: card.homeTeam, odds: card.homeOdds },
          ...(card.allowsDraw && card.drawOdds !== null ? [{ label: 'Draw', odds: card.drawOdds }] : []),
          { label: card.awayTeam, odds: card.awayOdds },
        ]))
        .sort((left, right) => left.odds - right.odds)[0] ?? null;
      return {
        id,
        label,
        headline,
        alert: kicker,
        durationMs: 18000,
        tone: 'fixtures',
        lines: cards.slice(0, 3).map((card) => (
          card.allowsDraw && card.drawOdds !== null
            ? `${card.fixture} • ${card.homeTeam} ${formatOdds(card.homeOdds)} (${formatProbability(card.homeProbability)}) • Draw ${formatOdds(card.drawOdds)} • ${card.awayTeam} ${formatOdds(card.awayOdds)} (${formatProbability(card.awayProbability)})`
            : `${card.fixture} • ${card.homeTeam} ${formatOdds(card.homeOdds)} (${formatProbability(card.homeProbability)}) • ${card.awayTeam} ${formatOdds(card.awayOdds)} (${formatProbability(card.awayProbability)}) • Level profit goes to penalties`
        )),
        content: (
          <div className="studio-odds-slide">
            <div className="studio-fixtures-head studio-odds-head">
              <span className="studio-kicker">{kicker}</span>
              <h3>{headline}</h3>
              <p>{subtitle}</p>
            </div>
            <div className="studio-odds-summary-strip">
              <span className="studio-odds-summary-pill">{cards.length} live market{cards.length === 1 ? '' : 's'}</span>
              {shortestPrice ? (
                <span className="studio-odds-summary-pill accent">
                  Shortest price: {shortestPrice.label} {formatOdds(shortestPrice.odds)}
                </span>
              ) : null}
            </div>
            <div className={`studio-odds-grid studio-scroll-panel ${cards.length === 1 ? 'single' : cards.length >= 6 ? 'dense' : 'balanced'}`}>
              {cards.map((card) => (
                <article key={card.key} className="studio-odds-card">
                  <div className="studio-odds-card-head">
                    <div className="studio-odds-card-title">
                      <span className={`studio-comp-badge ${card.badgeTone}`}>{card.title}</span>
                      <strong>{card.fixture}</strong>
                    </div>
                    <span className={`studio-story-stamp tone-${card.stampTone}`}>{card.stamp}</span>
                  </div>
                  <div className="studio-matchup-note">
                    <span>{card.marketNote}</span>
                    <em>{card.allowsDraw ? '3-way market' : '2-way market • penalties if level'}</em>
                  </div>
                  <div className={`studio-odds-market-grid ${card.allowsDraw ? '' : 'two-way'}`}>
                    <section className="studio-odds-market">
                      <div className="studio-odds-market-head">
                        <div className="team-name">
                          <TeamBadge
                            name={card.homeTeam}
                            ballColor={card.homeBallColor}
                            ringColor={card.homeRingColor}
                            textColor={card.homeTextColor}
                            size={28}
                          />
                          <div className="studio-odds-market-copy">
                            <span className="studio-odds-market-label">Home</span>
                            <strong>{card.homeTeam}</strong>
                          </div>
                        </div>
                        <div className="studio-odds-price-stack">
                          <strong>{formatOdds(card.homeOdds)}</strong>
                          <span>{formatProbability(card.homeProbability)}</span>
                        </div>
                      </div>
                      <LiveOddsMeter
                        probability={card.homeProbability}
                        fillStyle={{
                          background: `linear-gradient(90deg, ${card.homeBallColor ?? '#72d9ff'}, ${card.homeRingColor ?? '#e2ecff'})`,
                        }}
                      />
                      {renderFactChips(card.homeFacts)}
                    </section>
                    {card.allowsDraw && card.drawOdds !== null ? (
                      <section className="studio-odds-market draw">
                        <div className="studio-odds-market-head">
                          <div className="studio-odds-draw-head">
                            <span className="studio-odds-draw-badge">X</span>
                            <div className="studio-odds-market-copy">
                              <span className="studio-odds-market-label">Draw</span>
                              <strong>Level on profit</strong>
                            </div>
                          </div>
                          <div className="studio-odds-price-stack">
                            <strong>{formatOdds(card.drawOdds)}</strong>
                            <span>{formatProbability(card.drawProbability)}</span>
                          </div>
                        </div>
                        <LiveOddsMeter probability={card.drawProbability} draw />
                        {renderFactChips(card.drawFacts)}
                      </section>
                    ) : null}
                    <section className="studio-odds-market away">
                      <div className="studio-odds-market-head">
                        <div className="team-name">
                          <TeamBadge
                            name={card.awayTeam}
                            ballColor={card.awayBallColor}
                            ringColor={card.awayRingColor}
                            textColor={card.awayTextColor}
                            size={28}
                          />
                          <div className="studio-odds-market-copy">
                            <span className="studio-odds-market-label">Away</span>
                            <strong>{card.awayTeam}</strong>
                          </div>
                        </div>
                        <div className="studio-odds-price-stack">
                          <strong>{formatOdds(card.awayOdds)}</strong>
                          <span>{formatProbability(card.awayProbability)}</span>
                        </div>
                      </div>
                      <LiveOddsMeter
                        probability={card.awayProbability}
                        fillStyle={{
                          background: `linear-gradient(90deg, ${card.awayBallColor ?? '#8ef6cb'}, ${card.awayRingColor ?? '#f3fbff'})`,
                        }}
                      />
                      {renderFactChips(card.awayFacts)}
                    </section>
                  </div>
                  <div className="studio-odds-note-row">
                    <p>{card.reason}</p>
                    {card.detail ? <p className="studio-muted">{card.detail}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ),
      };
    };

    const buildOutrightPackage = (
      id: string,
      label: string,
      headline: string,
      kicker: string,
      subtitle: string,
      rows: OddsBoardRow[],
    ): SkyStudioBroadcastPackage | null => {
      if (rows.length === 0) {
        return null;
      }
      const favourite = rows[0] ?? null;
      return {
        id,
        label,
        headline,
        alert: kicker,
        durationMs: 20000,
        tone: 'movement',
        lines: rows.slice(0, 3).map((row) => `${row.label} ${formatOdds(row.odds)} (${formatProbability(row.probability)})`),
        content: (
          <div className="studio-odds-slide">
            <div className="studio-fixtures-head studio-odds-head">
              <span className="studio-kicker">{kicker}</span>
              <h3>{headline}</h3>
              <p>{subtitle}</p>
            </div>
            <div className="studio-odds-summary-strip">
              <span className="studio-odds-summary-pill">{rows.length} runners priced</span>
              {favourite ? (
                <span className="studio-odds-summary-pill accent">
                  Favourite: {favourite.label} {formatOdds(favourite.odds)}
                </span>
              ) : null}
            </div>
            <div className={`studio-odds-board studio-scroll-panel ${rows.length > 12 ? 'dense wide' : rows.length > 8 ? 'dense' : ''}`}>
              {rows.map((row, index) => (
                <article key={row.key} className="studio-odds-board-row">
                  <div className="studio-odds-board-rank">{index + 1}</div>
                  <div className="studio-odds-board-team">
                    <div className="team-name">
                      <TeamBadge
                        name={row.label}
                        ballColor={row.ballColor}
                        ringColor={row.ringColor}
                        textColor={row.textColor}
                        size={26}
                      />
                      <div className="studio-odds-board-copy">
                        <strong>{row.label}</strong>
                        {row.detail ? <span>{row.detail}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="studio-odds-board-market">
                    <strong>{formatOdds(row.odds)}</strong>
                    <span>{formatProbability(row.probability)}</span>
                    <LiveOddsMeter
                      probability={row.probability}
                      compact
                      fillStyle={{
                        background: `linear-gradient(90deg, ${row.ballColor ?? '#7fcfff'}, ${row.ringColor ?? '#eef6ff'})`,
                      }}
                    />
                  </div>
                  {renderFactChips(row.facts)}
                </article>
              ))}
            </div>
          </div>
        ),
      };
    };

    recapDivisionOrder.forEach((division) => {
      const rows = (leagueTable[division] ?? []).slice().sort(compareLeagueRowsByRank);
      const fixture = currentLeagueFixturesForStudio.find((entry) => entry.division === division);
      if (!fixture) {
        return;
      }
      const packageCard = buildFixtureOddsCard(
        displayDivisionName(division),
        fixture,
        'division',
        divisionOddsRowByTeamId,
        rows.length,
        rows.length > 0
          ? officialDivisionSeasonComplete
            ? `Final table: ${rows[0]?.teamName ?? 'Winner pending'} won ${displayDivisionName(division)} on ${rows[0]?.points ?? 0} points.`
            : `Table snapshot: ${rows[0]?.teamName ?? 'Leader pending'} lead ${displayDivisionName(division)} on ${rows[0]?.points ?? 0} points.`
          : undefined,
      );
      const oddsPackage = buildFixturePackage(
        `division-odds-${division}-${currentGw}`,
        `${displayDivisionName(division)} Odds`,
        `${displayDivisionName(division)} odds desk`,
        'ODDS DESK',
        'Three-way prices are built from current position, profit pace, and archived finishes.',
        packageCard ? [packageCard] : [],
      );
      if (oddsPackage) {
        packages.push(oddsPackage);
      }
    });

    const masterCards = currentMasterLeagueFixturesForStudio
      .map((fixture) => buildFixtureOddsCard(
        'Master League',
        fixture,
        'master',
        masterOddsRowByTeamId,
        masterLeagueTable.length,
      ))
      .filter((card): card is FixtureOddsCard => Boolean(card));
    const masterPackage = buildFixturePackage(
      `master-odds-${currentGw}`,
      'Master League Odds',
      'Master League odds desk',
      'MASTER ODDS',
      'Master prices lean on the full-table rating, current output, and historical league strength.',
      masterCards,
    );
    if (masterPackage) {
      packages.push(masterPackage);
    }

    const trioDivisions = Array.from(new Set(currentTrioLeagueFixturesForStudio.map((fixture) => fixture.division)));
    trioDivisions.forEach((division) => {
      const groupRows = trioLeagueTable.filter((row) => row.division === division).slice().sort(compareLeagueRowsByRank);
      const cards = currentTrioLeagueFixturesForStudio
        .filter((fixture) => fixture.division === division)
        .map((fixture) => buildFixtureOddsCard(
          division,
          fixture,
          'trio',
          trioOddsRowByTeamId,
          groupRows.length,
          fixture.stage === 'regular' ? 'Regular-season trio prices.' : 'Promotion playoff prices.',
        ))
        .filter((card): card is FixtureOddsCard => Boolean(card));
      const trioPackage = buildFixturePackage(
        `trio-odds-${division}-${currentGw}`,
        `${division} Odds`,
        `${division} odds desk`,
        'TRIO ODDS',
        'Trio prices are based on the division table, profit pace, and multi-season strength.',
        cards,
      );
      if (trioPackage) {
        packages.push(trioPackage);
      }
    });

    const cupCards = currentCupFixtures
      .filter((fixture) => fixture.homeTeam && fixture.awayTeam)
      .map((fixture) => buildFixtureOddsCard(
        fixture.roundName,
        { id: fixture.id, homeTeam: fixture.homeTeam!, awayTeam: fixture.awayTeam! },
        'cup',
        divisionOddsRowByTeamId,
        Math.max(2, teams.length),
        'Cup ties stay one-leg all the way through the semi-finals, so the current form edge matters more.',
      ))
      .filter((card): card is FixtureOddsCard => Boolean(card));
    const cupPackage = buildFixturePackage(
      `cup-odds-${currentGw}`,
      'Bookie Ball Cup Odds',
      'Bookie Ball Cup odds desk',
      'CUP ODDS',
      'Bookie Ball Cup is still priced as a single-leg tie, with draw odds reflecting level-profit risk before tie-breaks.',
      cupCards,
    );
    if (cupPackage) {
      packages.push(cupPackage);
    }

    const masterCupCards = currentMasterCupFixtures
      .filter((fixture) => fixture.homeTeam && fixture.awayTeam)
      .map((fixture) => buildFixtureOddsCard(
        fixture.roundName,
        {
          id: fixture.id,
          homeTeam: fixture.homeTeam!,
          awayTeam: fixture.awayTeam!,
          homeSeed: fixture.homeSeed,
          awaySeed: fixture.awaySeed,
        },
        'master_cup',
        masterOddsRowByTeamId,
        16,
        fixture.stage === 'semi_final'
          ? 'Master Cup semi-final legs are priced with seed and aggregate context in mind.'
          : 'Master Cup knockouts are priced from the master table plus the seeded bracket.',
      ))
      .filter((card): card is FixtureOddsCard => Boolean(card));
    const masterCupPackage = buildFixturePackage(
      `master-cup-odds-${currentGw}`,
      'Master Cup Odds',
      'Master Cup odds desk',
      'MASTER CUP',
      'Master Cup carries two-legged semi-finals only, while the rest of the bracket is single-match.',
      masterCupCards,
    );
    if (masterCupPackage) {
      packages.push(masterCupPackage);
    }

    if (currentGw === 'GW1') {
      recapDivisionOrder.forEach((division) => {
        const rows = (leagueTable[division] ?? []).slice().sort(compareLeagueRowsByRank);
        const oddsRows = buildOutrightOdds(
          rows
            .map((row) => {
              const profile = oddsProfileByTeamId.get(row.teamId);
              return profile ? { profile, currentRow: divisionOddsRowByTeamId.get(row.teamId) ?? null } : null;
            })
            .filter((entry): entry is { profile: OddsTeamProfile; currentRow: OddsCurrentRow | null } => Boolean(entry)),
          rows.length,
        ).map((row) => {
          const currentRow = rows.find((entry) => entry.teamId === row.teamId);
          return buildOutrightRow(
            `${division}-${row.teamId}`,
            row.teamId,
            row.teamName,
            row.odds,
            row.probability,
            currentRow ? toOddsCurrentRow(currentRow) : null,
            rows.length,
            'Opening division title price from the archive.',
          );
        });
        const outrightPackage = buildOutrightPackage(
          `division-outright-${division}-${currentSeason}`,
          `${displayDivisionName(division)} Title Odds`,
          `${displayDivisionName(division)} title market`,
          'SEASON ODDS',
          'Preseason prices are based on archived league finishes, profit history, and any favourite tag already in the system.',
          oddsRows,
        );
        if (outrightPackage) {
          packages.push(outrightPackage);
        }
      });

      const masterOddsRows = buildOutrightOdds(
        masterLeagueTable
          .map((row) => {
            const profile = oddsProfileByTeamId.get(row.teamId);
            return profile ? { profile, currentRow: masterOddsRowByTeamId.get(row.teamId) ?? null } : null;
          })
          .filter((entry): entry is { profile: OddsTeamProfile; currentRow: OddsCurrentRow | null } => Boolean(entry)),
        masterLeagueTable.length,
      ).map((row) => {
        const currentRow = masterLeagueTable.find((entry) => entry.teamId === row.teamId);
        return buildOutrightRow(
          `master-${row.teamId}`,
          row.teamId,
          row.teamName,
          row.odds,
          row.probability,
          currentRow ? toOddsCurrentRow(currentRow) : null,
          masterLeagueTable.length,
          'Opening master market from archive strength.',
        );
      });
      const masterOutrightPackage = buildOutrightPackage(
        `master-outright-${currentSeason}`,
        'Master League Winner Odds',
        'Master League winner market',
        'SEASON ODDS',
        'Master League prices use the full archive and the current all-team ladder.',
        masterOddsRows,
      );
      if (masterOutrightPackage) {
        packages.push(masterOutrightPackage);
      }

      const trioDivisionsForOutright = Array.from(new Set(trioLeagueTable.map((row) => row.division)));
      trioDivisionsForOutright.forEach((division) => {
        const rows = trioLeagueTable.filter((row) => row.division === division).slice().sort(compareLeagueRowsByRank);
        const oddsRows = buildOutrightOdds(
          rows
            .map((row) => {
              const profile = oddsProfileByTeamId.get(row.teamId);
              return profile ? { profile, currentRow: trioOddsRowByTeamId.get(row.teamId) ?? null } : null;
            })
            .filter((entry): entry is { profile: OddsTeamProfile; currentRow: OddsCurrentRow | null } => Boolean(entry)),
          rows.length,
        ).map((row) => {
          const currentRow = rows.find((entry) => entry.teamId === row.teamId);
          return buildOutrightRow(
            `${division}-${row.teamId}`,
            row.teamId,
            row.teamName,
            row.odds,
            row.probability,
            currentRow ? toOddsCurrentRow(currentRow) : null,
            rows.length,
            'Opening trio division price from archive strength.',
          );
        });
        const trioOutrightPackage = buildOutrightPackage(
          `trio-outright-${division}-${currentSeason}`,
          `${division} Winner Odds`,
          `${division} winner market`,
          'SEASON ODDS',
          'Trio markets are seeded from archive quality and the live trio ladder.',
          oddsRows,
        );
        if (trioOutrightPackage) {
          packages.push(trioOutrightPackage);
        }
      });

      const cupOutrightRows = buildOutrightOdds(
        teams
          .map((team) => {
            const profile = oddsProfileByTeamId.get(team.id);
            return profile ? { profile, currentRow: divisionOddsRowByTeamId.get(team.id) ?? null } : null;
          })
          .filter((entry): entry is { profile: OddsTeamProfile; currentRow: OddsCurrentRow | null } => Boolean(entry)),
        teams.length,
      ).map((row) => buildOutrightRow(
        `cup-outright-${row.teamId}`,
        row.teamId,
        row.teamName,
        row.odds,
        row.probability,
        divisionOddsRowByTeamId.get(row.teamId) ?? null,
        teams.length,
        'Archive-based cup outright price.',
      ));
      const cupOutrightPackage = buildOutrightPackage(
        `cup-outright-${currentSeason}`,
        'Bookie Ball Cup Winner Odds',
        'Bookie Ball Cup winner market',
        'SEASON ODDS',
        'Cup prices are derived from the archive because the live draw is kept separate from fixture generation.',
        cupOutrightRows,
      );
      if (cupOutrightPackage) {
        packages.push(cupOutrightPackage);
      }

      const masterCupParticipants = Array.from(new Map(
        allMasterCupFixtures
          .flatMap((fixture) => (
            [
              fixture.homeTeamId ? { teamId: fixture.homeTeamId, teamName: fixture.homeTeam } : null,
              fixture.awayTeamId ? { teamId: fixture.awayTeamId, teamName: fixture.awayTeam } : null,
            ]
          ))
          .filter((entry): entry is { teamId: number; teamName: string | null } => Boolean(entry))
          .map((entry) => [entry.teamId, entry]),
      ).values());
      const masterCupOutrightRows = buildOutrightOdds(
        masterCupParticipants
          .map((entry) => {
            const profile = oddsProfileByTeamId.get(entry.teamId);
            return profile ? { profile, currentRow: masterOddsRowByTeamId.get(entry.teamId) ?? null } : null;
          })
          .filter((entry): entry is { profile: OddsTeamProfile; currentRow: OddsCurrentRow | null } => Boolean(entry)),
        Math.max(2, masterCupParticipants.length),
      ).map((row) => buildOutrightRow(
        `master-cup-outright-${row.teamId}`,
        row.teamId,
        row.teamName,
        row.odds,
        row.probability,
        masterOddsRowByTeamId.get(row.teamId) ?? null,
        Math.max(2, masterCupParticipants.length),
        'Seeded bracket outright price.',
      ));
      const masterCupOutrightPackage = buildOutrightPackage(
        `master-cup-outright-${currentSeason}`,
        'Master Cup Winner Odds',
        'Master Cup winner market',
        'SEASON ODDS',
        'Master Cup prices blend archive strength with the seeded top-16 bracket.',
        masterCupOutrightRows,
      );
      if (masterCupOutrightPackage) {
        packages.push(masterCupOutrightPackage);
      }
    }

    return packages;
  }, [
    allMasterCupFixtures,
    currentCupFixtures,
    currentGw,
    currentLeagueFixturesForStudio,
    currentMasterCupFixtures,
    currentMasterLeagueFixturesForStudio,
    currentSeason,
    currentTrioLeagueFixturesForStudio,
    divisionOddsRowByTeamId,
    leagueTable,
    masterLeagueTable,
    masterOddsRowByTeamId,
    oddsProfileByTeamId,
    recapDivisionOrder,
    teamIdByName,
    teamMetaByName,
    teams,
    trioLeagueTable,
    trioOddsRowByTeamId,
  ]);

  const competitionBracketPackages = useMemo<SkyStudioBroadcastPackage[]>(() => {
    const packages: SkyStudioBroadcastPackage[] = [];

    const participant = (
      teamName: string | null | undefined,
      score: string | null | undefined,
      winnerTeamName: string | null | undefined,
    ) => {
      const safeTeamName = teamName ?? 'TBD';
      const meta = teamMetaByName.get(safeTeamName);
      return {
        teamName: safeTeamName,
        score: score ?? 'TBD',
        winner: Boolean(winnerTeamName) && winnerTeamName === safeTeamName,
        ballColor: meta?.ballColor ?? null,
        ringColor: meta?.ringColor ?? null,
        textColor: meta?.textColor ?? null,
      };
    };

    const cupRoundSortValue = (roundName: string): number => {
      const normalized = roundName.toLowerCase();
      if (/round\s*of\s*32|r32/.test(normalized)) {
        return 1;
      }
      if (/round\s*of\s*16|r16/.test(normalized)) {
        return 2;
      }
      if (/quarter/.test(normalized)) {
        return 3;
      }
      if (/semi/.test(normalized)) {
        return 4;
      }
      if (/\bfinal\b/.test(normalized)) {
        return 5;
      }
      return 99;
    };

    if (cupFixtures.length > 0) {
      const roundMap = new Map<string, typeof cupFixtures>();
      cupFixtures.forEach((fixture) => {
        const roundFixtures = roundMap.get(fixture.roundName) ?? [];
        roundFixtures.push(fixture);
        roundMap.set(fixture.roundName, roundFixtures);
      });
      const rounds: CompetitionBracketRound[] = Array.from(roundMap.entries())
        .sort((left, right) => cupRoundSortValue(left[0]) - cupRoundSortValue(right[0]))
        .map(([roundName, fixtures]) => ({
          key: roundName,
          label: roundName,
          ties: fixtures
            .slice()
            .sort((left, right) => left.id - right.id)
            .map((fixture) => ({
              id: `cup-${fixture.id}`,
              title: fixture.gw,
              detail: fixture.decidedBy === 'bye' ? 'Bye awarded' : cupFixtureDetailLabel(fixture),
              statusLabel: fixture.winnerTeam ? 'winner' : fixture.gw === currentGw ? 'live' : 'pending',
              active: fixture.gw === currentGw,
              resolved: Boolean(fixture.winnerTeam),
              winnerPath: Boolean(fixture.winnerTeam),
              home: participant(
                cupSideLabel(fixture, 'home'),
                fixture.decidedBy === 'bye' ? null : fixture.homeTeam ? fixture.homeProfit.toFixed(2) : null,
                fixture.winnerTeam,
              ),
              away: participant(
                cupSideLabel(fixture, 'away'),
                fixture.decidedBy === 'bye' ? null : fixture.awayTeam ? fixture.awayProfit.toFixed(2) : null,
                fixture.winnerTeam,
              ),
            })),
        }));
      packages.push({
        id: `cup-bracket-graphic-${currentGw}`,
        label: 'Bookie Ball Cup Bracket',
        headline: 'Bookie Ball Cup bracket',
        alert: 'BRACKET',
        durationMs: 17000,
        tone: 'cup',
        lines: [
          `${cupFixtures.filter((fixture) => fixture.winnerTeam).length}/${cupFixtures.length} cup ties resolved.`,
          currentCupFixtures[0] ? `${currentCupFixtures[0].roundName} is the live cup focus.` : 'Cup bracket is building.',
        ],
        content: (
          <CompetitionBracketBoard
            kicker="Cup Bracket"
            title="Bookie Ball Cup path"
            subtitle="Winner paths light up as each single-leg tie resolves."
            rounds={rounds}
            summary={[
              `${cupFixtures.filter((fixture) => fixture.winnerTeam).length} winners confirmed`,
              `${currentCupFixtures.length} ties on the ${currentGw} board`,
            ]}
          />
        ),
      });
    }

    if (isSeasonFiveOrLater(currentSeason) && allMasterCupFixtures.length > 0) {
      const stageLabel = (stage: MasterCupFixture['stage']): string => {
        if (stage === 'round_of_16') {
          return 'Round of 16';
        }
        if (stage === 'quarter_final') {
          return 'Quarterfinals';
        }
        if (stage === 'semi_final') {
          return 'Semifinals';
        }
        if (stage === 'third_place_playoff') {
          return 'Third Place';
        }
        return 'Final';
      };
      const rounds: CompetitionBracketRound[] = [];
      const singleLegStage = (stage: MasterCupFixture['stage']) =>
        allMasterCupFixtures
          .filter((fixture) => fixture.stage === stage)
          .slice()
          .sort((left, right) => left.tieSlot - right.tieSlot || left.id - right.id);
      (['round_of_16', 'quarter_final'] as const).forEach((stage) => {
        const fixtures = singleLegStage(stage);
        if (fixtures.length === 0) {
          return;
        }
        rounds.push({
          key: stage,
          label: stageLabel(stage),
          ties: fixtures.map((fixture) => ({
            id: `master-cup-${fixture.id}`,
            title: `Seed ${fixture.homeSeed ?? '?'} v ${fixture.awaySeed ?? '?'}`,
            detail: fixture.roundName,
            statusLabel: fixture.winnerTeam ? 'winner' : fixture.gw === currentGw ? 'live' : fixture.gw.toLowerCase(),
            active: fixture.gw === currentGw,
            resolved: Boolean(fixture.winnerTeam),
            winnerPath: Boolean(fixture.winnerTeam),
            home: participant(fixture.homeTeam, fixture.homeTeam ? fixture.homeProfit.toFixed(2) : null, fixture.winnerTeam),
            away: participant(fixture.awayTeam, fixture.awayTeam ? fixture.awayProfit.toFixed(2) : null, fixture.winnerTeam),
          })),
        });
      });
      const semiTies = Array.from(new Set(allMasterCupFixtures.filter((fixture) => fixture.stage === 'semi_final').map((fixture) => fixture.tieSlot)))
        .sort((left, right) => left - right)
        .map((tieSlot) => {
          const legs = allMasterCupFixtures
            .filter((fixture) => fixture.stage === 'semi_final' && fixture.tieSlot === tieSlot)
            .slice()
            .sort((left, right) => left.legNumber - right.legNumber);
          const firstLeg = legs[0] ?? null;
          const secondLeg = legs[1] ?? null;
          const reference = secondLeg ?? firstLeg;
          if (!reference) {
            return null;
          }
          const aggregateAvailable = secondLeg && secondLeg.aggregateHomeProfit !== null && secondLeg.aggregateAwayProfit !== null;
          return {
            id: `master-cup-semi-${tieSlot}`,
            title: `Semi ${tieSlot}`,
            detail: aggregateAvailable
              ? `L1 ${firstLeg?.homeProfit.toFixed(2) ?? '0.00'}-${firstLeg?.awayProfit.toFixed(2) ?? '0.00'} • L2 ${secondLeg?.homeProfit.toFixed(2) ?? '0.00'}-${secondLeg?.awayProfit.toFixed(2) ?? '0.00'}`
              : 'Two-leg semi-final',
            statusLabel: reference.winnerTeam ? 'winner' : reference.gw === currentGw ? 'live' : reference.gw.toLowerCase(),
            active: legs.some((fixture) => fixture.gw === currentGw),
            resolved: Boolean(reference.winnerTeam),
            winnerPath: Boolean(reference.winnerTeam),
            home: participant(
              reference.homeTeam,
              aggregateAvailable ? `Agg ${secondLeg?.aggregateHomeProfit?.toFixed(2) ?? '0.00'}` : (reference.homeTeam ? reference.homeProfit.toFixed(2) : null),
              reference.winnerTeam,
            ),
            away: participant(
              reference.awayTeam,
              aggregateAvailable ? `Agg ${secondLeg?.aggregateAwayProfit?.toFixed(2) ?? '0.00'}` : (reference.awayTeam ? reference.awayProfit.toFixed(2) : null),
              reference.winnerTeam,
            ),
          };
        })
        .filter((tie): tie is CompetitionBracketRound['ties'][number] => Boolean(tie));
      if (semiTies.length > 0) {
        rounds.push({
          key: 'semi_final',
          label: 'Semifinals',
          ties: semiTies,
        });
      }
      const finalDayFixtures = allMasterCupFixtures
        .filter((fixture) => fixture.stage === 'third_place_playoff' || fixture.stage === 'final')
        .slice()
        .sort((left, right) => {
          const stageWeight = left.stage === right.stage ? 0 : left.stage === 'third_place_playoff' ? -1 : 1;
          return stageWeight || left.id - right.id;
        });
      if (finalDayFixtures.length > 0) {
        rounds.push({
          key: 'master-cup-finals',
          label: 'Final Day',
          ties: finalDayFixtures.map((fixture) => ({
            id: `master-cup-final-day-${fixture.id}`,
            title: fixture.stage === 'third_place_playoff' ? 'Third-place playoff' : 'Final',
            detail: fixture.roundName,
            statusLabel: fixture.winnerTeam ? 'winner' : fixture.gw === currentGw ? 'live' : fixture.gw.toLowerCase(),
            active: fixture.gw === currentGw,
            resolved: Boolean(fixture.winnerTeam),
            winnerPath: Boolean(fixture.winnerTeam),
            home: participant(fixture.homeTeam, fixture.homeTeam ? fixture.homeProfit.toFixed(2) : null, fixture.winnerTeam),
            away: participant(fixture.awayTeam, fixture.awayTeam ? fixture.awayProfit.toFixed(2) : null, fixture.winnerTeam),
          })),
        });
      }
      packages.push({
        id: `master-cup-bracket-graphic-${currentGw}`,
        label: 'Master Cup Bracket',
        headline: 'Master Cup bracket',
        alert: 'MASTER CUP',
        durationMs: 17000,
        tone: 'competition',
        lines: [
          `${allMasterCupFixtures.filter((fixture) => fixture.winnerTeam).length}/${allMasterCupFixtures.length} master cup ties resolved.`,
          'Two-legged semi-finals stay on one bracket board with aggregate totals.',
        ],
        content: (
          <CompetitionBracketBoard
            kicker="Master Cup"
            title="Master Cup seeded route"
            subtitle="Seeded ties with two-leg semi-finals and lit winner paths."
            rounds={rounds}
            summary={[
              `${allMasterCupFixtures.filter((fixture) => fixture.stage === 'semi_final').length} semi-final legs logged`,
              `${currentMasterCupFixtures.length} live fixtures on the ${currentGw} slate`,
            ]}
          />
        ),
      });
    }

    const trioPlayoffFixtures = allTrioLeagueFixturesForStudio.filter((fixture) => fixture.stage !== 'regular');
    if (trioPlayoffFixtures.length > 0) {
      const playoffDivisions = Array.from(new Set(trioPlayoffFixtures.map((fixture) => fixture.division)));
      const rounds: CompetitionBracketRound[] = [
        {
          key: 'trio-playoff-semis',
          label: 'Semifinals',
          ties: playoffDivisions.flatMap((division) => (
            trioPlayoffFixtures
              .filter((fixture) => fixture.division === division && fixture.stage === 'playoff_semi')
              .slice()
              .sort((left, right) => left.groupSlot - right.groupSlot || left.id - right.id)
              .map((fixture) => ({
                id: `trio-semi-${fixture.id}`,
                title: division,
                detail: `Semi ${fixture.groupSlot + 1}`,
                statusLabel: fixture.result === 'pending' ? (fixture.gw === currentGw ? 'live' : fixture.gw.toLowerCase()) : 'winner',
                active: fixture.gw === currentGw,
                resolved: fixture.result !== 'pending',
                winnerPath: fixture.winnerTeamId !== null,
                home: participant(fixture.homeTeam, fixture.homeProfit.toFixed(2), fixture.winnerTeamId === fixture.homeTeamId ? fixture.homeTeam : fixture.winnerTeamId === fixture.awayTeamId ? fixture.awayTeam : null),
                away: participant(fixture.awayTeam, fixture.awayProfit.toFixed(2), fixture.winnerTeamId === fixture.homeTeamId ? fixture.homeTeam : fixture.winnerTeamId === fixture.awayTeamId ? fixture.awayTeam : null),
              }))
          )),
        },
        {
          key: 'trio-playoff-finals',
          label: 'Finals',
          ties: playoffDivisions.flatMap((division) => (
            trioPlayoffFixtures
              .filter((fixture) => fixture.division === division && fixture.stage === 'playoff_final')
              .slice()
              .sort((left, right) => left.id - right.id)
              .map((fixture) => ({
                id: `trio-final-${fixture.id}`,
                title: division,
                detail: 'Promotion final',
                statusLabel: fixture.result === 'pending' ? (fixture.gw === currentGw ? 'live' : fixture.gw.toLowerCase()) : 'winner',
                active: fixture.gw === currentGw,
                resolved: fixture.result !== 'pending',
                winnerPath: fixture.winnerTeamId !== null,
                home: participant(fixture.homeTeam, fixture.homeProfit.toFixed(2), fixture.winnerTeamId === fixture.homeTeamId ? fixture.homeTeam : fixture.winnerTeamId === fixture.awayTeamId ? fixture.awayTeam : null),
                away: participant(fixture.awayTeam, fixture.awayProfit.toFixed(2), fixture.winnerTeamId === fixture.homeTeamId ? fixture.homeTeam : fixture.winnerTeamId === fixture.awayTeamId ? fixture.awayTeam : null),
              }))
          )),
        },
      ].filter((round) => round.ties.length > 0);
      packages.push({
        id: `trio-playoff-bracket-${currentGw}`,
        label: 'Trio Playoff Bracket',
        headline: 'Trio playoff bracket',
        alert: 'TRIO PLAYOFFS',
        durationMs: 16000,
        tone: 'competition',
        lines: [
          `${trioPlayoffFixtures.filter((fixture) => fixture.winnerTeamId !== null).length}/${trioPlayoffFixtures.length} trio playoff ties resolved.`,
          'Semifinal winners feed directly into the promotion final board.',
        ],
        content: (
          <CompetitionBracketBoard
            kicker="Trio Playoffs"
            title="Trio playoff path"
            subtitle="Semis and finals sit on one board, with promoted paths lighting up."
            rounds={rounds}
            summary={[
              `${playoffDivisions.length} divisions carrying playoff brackets`,
              `${currentTrioLeagueFixturesForStudio.filter((fixture) => fixture.stage !== 'regular').length} playoff ties live this week`,
            ]}
          />
        ),
      });
    }

    return packages;
  }, [
    allMasterCupFixtures,
    allTrioLeagueFixturesForStudio,
    currentCupFixtures,
    currentGw,
    currentMasterCupFixtures,
    currentSeason,
    currentTrioLeagueFixturesForStudio,
    cupFixtures,
    teamMetaByName,
  ]);

  const studioBroadcastPackages = useMemo<SkyStudioBroadcastPackage[]>(() => {
    const packages: SkyStudioBroadcastPackage[] = [];
    const pickName = (row: PredictionRow | undefined): string | null => {
      if (!row) {
        return null;
      }
      return row.pickOutcome === 'draw' ? 'Draw' : row.pickTeamName;
    };

    const pregamePreviewLines = /kickoff/i.test(kickoffDayPhase.label)
      ? pickPregamePreviewLines(`${currentSeason}-${currentGw}-${kickoffDayPhase.label}`, 2)
      : [];
    packages.push({
      id: `tonight-board-${currentGw}`,
      label: 'Tonight\'s Board',
      headline: `${currentGw} across divisions, trio, master, and cup`,
      lines: [
        `Divisions: ${currentLeagueFixturesForStudio.length} fixtures on the main ladder tonight.`,
        isSeasonFiveOrLater(currentSeason)
          ? `Trio League: ${currentTrioLeagueFixturesForStudio.length} fixtures with the three-tier race now live.`
          : 'Trio League launches from Season 5, so tonight stays on divisions, master, and cup.',
        `Master League: ${currentMasterLeagueFixturesForStudio.length} fixtures on the cross-table board.`,
        currentSuperCupFixtures.length > 0
          ? `Super Cup: ${currentSuperCupFixtures.length} standalone prestige opener on the board.`
          : 'Super Cup: no curtain-raiser on tonight\'s board.',
        currentCupFixtures.length > 0
          ? `Cup: ${currentCupFixtures.length} live ties in the knockout bracket.`
          : 'Cup: no live ties on tonight\'s board.',
      ],
      tone: 'fixtures',
      alert: 'RUNNING ORDER',
    });
    packages.push(...kickoffOddsPackages);
    packages.push(...competitionBracketPackages);
    packages.push({
      id: `day-phase-${currentGw}`,
      label: `${kickoffDayPhase.label} Desk`,
      headline: `${currentGw} day-cycle context`,
      lines: [
        kickoffDayPhase.line,
        ...pregamePreviewLines,
        'No result is confirmed until the gameweek is locked and the board moves on.',
        currentGwLocked
          ? 'Entries are now locked, but calls stay provisional until rollover.'
          : 'Manual entries can still arrive at any time, so this board is still live.',
      ],
      tone: 'fixtures',
      alert: studioTruthLabel,
    });
    const leagueResolvedCount = currentLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length;
    const masterResolvedCount = currentMasterLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length;
    const trioResolvedCount = currentTrioLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length;
    const cupResolvedCount = currentCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length;
    const superCupResolvedCount = currentSuperCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length;
    const superCupStatusLine = currentSuperCupFixtures.length > 0
      ? `Super Cup ${superCupResolvedCount}/${currentSuperCupFixtures.length} updated`
      : 'Super Cup idle';
    const leagueDivisionCalls = recapDivisionOrder
      .map((division) => {
        const fixture = currentLeagueFixturesForStudio.find((row) => row.division === division);
        if (!fixture) {
          return null;
        }
        const leader = fixture.result === 'pending'
          ? null
          : fixture.result === 'draw'
            ? 'level'
            : fixture.result === 'home'
              ? fixture.homeTeam
              : fixture.awayTeam;
        return `${displayDivisionName(division)}: ${leader ? `as it stands ${leader}` : 'no leader yet'} in ${fixture.homeTeam} vs ${fixture.awayTeam}.`;
      })
      .filter((line): line is string => Boolean(line));
    const cupLiveCall = (() => {
      const fixture = currentCupFixtures.find((row) => row.winnerTeam === null) ?? currentCupFixtures[0];
      if (!fixture) {
        return 'Cup board is waiting for fixture updates.';
      }
      const home = cupSideLabel(fixture, 'home');
      const away = cupSideLabel(fixture, 'away');
      return fixture.winnerTeam
        ? `Cup board: ${home} vs ${away}, ${fixture.winnerTeam} currently through.`
        : `Cup board: ${home} vs ${away} is still in play.`;
    })();
    const superCupLiveCall = (() => {
      const fixture = currentSuperCupFixtures[0];
      if (!fixture) {
        return 'Super Cup slot is empty on this board.';
      }
      return fixture.winnerTeam
        ? `Super Cup: ${fixture.homeTeam} vs ${fixture.awayTeam}, ${fixture.winnerTeam} currently hold the curtain-raiser.`
        : `Super Cup: ${fixture.homeTeam} vs ${fixture.awayTeam} is the standalone prestige opener and is still live.`;
    })();
    const masterLiveCall = (() => {
      const fixture = currentMasterLeagueFixturesForStudio.find((row) => row.result === 'pending')
        ?? currentMasterLeagueFixturesForStudio[0];
      if (!fixture) {
        return 'Master League board has no active fixture updates yet.';
      }
      const leader = fixture.result === 'pending'
        ? null
        : fixture.result === 'draw'
          ? 'level'
          : fixture.result === 'home'
            ? fixture.homeTeam
            : fixture.awayTeam;
      return leader
        ? `Master League: ${fixture.homeTeam} vs ${fixture.awayTeam}, as it stands ${leader} lead.`
        : `Master League: ${fixture.homeTeam} vs ${fixture.awayTeam} is still live.`;
    })();
    const trioLiveCall = (() => {
      const fixture = currentTrioLeagueFixturesForStudio.find((row) => row.result === 'pending')
        ?? currentTrioLeagueFixturesForStudio[0];
      if (!fixture) {
        return 'Trio League board has no active fixture updates yet.';
      }
      const leader = fixture.result === 'pending'
        ? null
        : fixture.result === 'draw'
          ? 'level'
          : fixture.result === 'home'
            ? fixture.homeTeam
            : fixture.awayTeam;
      return leader
        ? `${trioFixtureCompetitionLabel(fixture)}: ${fixture.homeTeam} vs ${fixture.awayTeam}, as it stands ${leader} lead.`
        : `${trioFixtureCompetitionLabel(fixture)}: ${fixture.homeTeam} vs ${fixture.awayTeam} is still live.`;
    })();
    if (isSeasonFiveOrLater(currentSeason)) {
      const premierRows = trioLeagueTable.filter((row) => row.division === 'Premier League').slice().sort((a, b) => a.rank - b.rank);
      const ligueRows = trioLeagueTable.filter((row) => row.division === 'Ligue 1').slice().sort((a, b) => a.rank - b.rank);
      const bundesligaRows = trioLeagueTable.filter((row) => row.division === 'Bundesliga').slice().sort((a, b) => a.rank - b.rank);
      packages.push({
        id: `stakes-desk-${currentGw}`,
        label: 'What Matters Today',
        headline: 'Promotion, playoffs, and drop-zone stakes',
        lines: [
          currentGw === 'GW8'
            ? 'Division GW8 is pure playoff and friendly territory, so the tables give way to direct one-off outcomes.'
            : 'Division tables still drive the main season picture, but tonight is also shaping movement elsewhere.',
          `Trio Premier League: ${premierRows.slice(-2).map((row) => row.teamName).join(' and ') || 'the bottom two'} are currently in the relegation places.`,
          `Trio Ligue 1: ${ligueRows[0]?.teamName ?? 'Leader pending'} hold the automatic promotion place, while ${ligueRows.slice(1, 5).map((row) => row.teamName).join(', ') || 'the playoff pack'} sit on the playoff board for the second promotion slot.`,
          `Trio Bundesliga: ${bundesligaRows[0]?.teamName ?? 'Leader pending'} are on the direct route up, with ${bundesligaRows.slice(1, 5).map((row) => row.teamName).join(', ') || 'the playoff line still forming'} chasing the second promotion place.`,
        ],
        tone: 'competition',
        alert: 'STAKES',
      });
      packages.push({
        id: `trio-desk-${currentGw}`,
        label: 'Trio League Desk',
        headline: 'Three-tier trio league check-in',
        lines: [
          premierRows[0]
            ? `Premier League: ${premierRows[0].teamName} lead, while ${premierRows.slice(-2).map((row) => row.teamName).join(' and ')} sit in the current relegation zone.`
            : 'Premier League trio table is still loading.',
          ligueRows[0]
            ? `Ligue 1: ${ligueRows[0].teamName} sit in the automatic promotion place, with ${ligueRows.slice(1, 5).map((row) => row.teamName).join(', ')} on the playoff board.`
            : 'Ligue 1 trio table is still loading.',
          bundesligaRows[0]
            ? `Bundesliga: ${bundesligaRows[0].teamName} hold the direct promotion place, with ${bundesligaRows.slice(1, 5).map((row) => row.teamName).join(', ')} chasing the playoff route.`
            : 'Bundesliga trio table is still loading.',
          trioLiveCall,
        ],
        tone: 'competition',
        alert: 'TRIO LEAGUE',
      });
    }
    packages.push({
      id: `gw-roundup-${currentGw}`,
      label: `Game Week Round-Up • ${currentGw}`,
      headline: `${currentGw} round-up across league, cup, master, and trio`,
      lines: [
        `${currentGw} status board: League ${leagueResolvedCount}/${currentLeagueFixturesForStudio.length} updated, ${superCupStatusLine}, Cup ${cupResolvedCount}/${currentCupFixtures.length} updated, Master ${masterResolvedCount}/${currentMasterLeagueFixturesForStudio.length} updated, Trio ${trioResolvedCount}/${currentTrioLeagueFixturesForStudio.length} updated.`,
        leagueDivisionCalls[0] ?? 'Division callouts are still pending this cycle.',
        leagueDivisionCalls[1] ?? leagueDivisionCalls[2] ?? 'Secondary division boards remain live.',
        superCupLiveCall,
        cupLiveCall,
        masterLiveCall,
        trioLiveCall,
      ],
      tone: 'results',
      alert: 'ROUND-UP',
    });

    if (recapTarget) {
      const recapIsCrossSeason = recapTarget.season !== currentSeason;
      const prevJay = prevWeekScores.find((row) => row.picker === 'Jay');
      const prevComputer = prevWeekScores.find((row) => row.picker === 'Computer');
      const pointsSwing = (prevJay?.points ?? 0) - (prevComputer?.points ?? 0);
      const pointsLinePrefix = recapIsCrossSeason ? 'On last season’s final day' : 'Yesterday';
      const pointsLine = pointsSwing === 0
        ? `${pointsLinePrefix} was level: Jay ${prevJay?.points ?? 0}, Computer ${prevComputer?.points ?? 0}.`
        : pointsSwing > 0
          ? `${pointsLinePrefix}'s edge went to Jay by ${pointsSwing} points.`
          : `${pointsLinePrefix}'s edge went to Computer by ${Math.abs(pointsSwing)} points.`;
      const surpriseLeague = prevLeagueFixtures
        .map((fixture) => {
          if (fixture.result === 'pending') {
            return null;
          }
          const winner = fixture.result === 'draw'
            ? 'Draw'
            : fixture.result === 'home'
              ? fixture.homeTeam
              : fixture.awayTeam;
          const picks = prevPredictionMap.get(`league-${fixture.id}`);
          const jayPick = pickName(picks?.Jay);
          const computerPick = pickName(picks?.Computer);
          if (winner !== 'Draw' && winner !== jayPick && winner !== computerPick) {
            return `${winner} flipped the board in ${fixture.homeTeam} vs ${fixture.awayTeam}.`;
          }
          return null;
        })
        .find((line): line is string => Boolean(line));
      const surpriseCup = prevCupFixtures
        .map((fixture) => {
          if (!fixture.winnerTeam) {
            return null;
          }
          const picks = prevPredictionMap.get(`cup-${fixture.id}`);
          const jayPick = pickName(picks?.Jay);
          const computerPick = pickName(picks?.Computer);
          if (fixture.winnerTeam !== jayPick && fixture.winnerTeam !== computerPick) {
            return `${fixture.winnerTeam} shocked both prediction cards in ${fixture.roundName}.`;
          }
          return null;
        })
        .find((line): line is string => Boolean(line));
      const recapReviewLines = pickRecapReviewLines(
        `${recapTarget.season}-${recapTarget.gw}-${surpriseLeague ?? surpriseCup ?? 'steady'}`,
        2,
      );
      const implication = scoreboardTotals[0] && scoreboardTotals[1]
        ? `${scoreboardTotals[0].picker} now has ${scoreboardTotals[0].points} total points versus ${scoreboardTotals[1].points} for ${scoreboardTotals[1].picker}.`
        : 'Season totals remain in play with pressure building each week.';
      packages.push({
        id: `prediction-recap-${recapTarget.season}-${recapTarget.gw}`,
        label: `Prediction Recap • ${recapTarget.season} ${recapTarget.gw}`,
        headline: recapIsCrossSeason
          ? `Last season recap from ${recapTarget.season} ${recapTarget.gw}`
          : `Previous-day recap from ${recapTarget.season} ${recapTarget.gw}`,
        lines: [
          pointsLine,
          surpriseLeague ?? surpriseCup ?? 'No major shocks landed, but margins were tight across the board.',
          ...recapReviewLines,
          recapIsCrossSeason
            ? `That final-day swing now frames the season opener in ${currentSeason} ${currentGw}.`
            : `Those calls still shape the pressure heading into ${currentGw}.`,
          implication,
        ],
        tone: 'results',
        alert: 'RESULTS DESK',
      });
    }

    if (bookieDorBoard?.holder) {
      const weights = bookieDorBoard.weights;
      const runnerUp = bookieDorBoard.leaderboard[1];
      packages.push({
        id: `bookie-dor-${bookieDorBoard.season}-${bookieDorBoard.gw}`,
        label: "Bookie d'Or Watch",
        headline: `${bookieDorBoard.holder.teamName} currently leads the Bookie d'Or race`,
        lines: [
          `${bookieDorBoard.holder.teamName} on ${bookieDorBoard.holder.score.toFixed(2)} with scoring drawn from divisions, cups, master league, trio league, and tier league.`,
          runnerUp
            ? `${runnerUp.teamName} are the nearest challenger on ${runnerUp.score.toFixed(2)}.`
            : 'No close challenger has formed yet.',
          `Category shares • Divisions ${Math.round(weights.league * 100)}% • Cups ${Math.round(weights.cup * 100)}% • Master ${Math.round(weights.master * 100)}% • Trio + Tier ${Math.round(weights.consistency * 100)}%`,
        ],
        tone: 'movement',
        alert: 'BOOKIE D’OR',
      });

    }

    packages.push({
      id: `studio-pack-premium-${currentGw}`,
      label: 'Studio Pack — Premium (50 lines)',
      headline: 'Studio Pack — Premium (50 lines)',
      lines: [
        "Welcome back — this matchup has had a bit of everything: momentum swings, tight margins, and one or two surprises.",
        "Early indicators suggested a cagey start, but the tempo has lifted and the numbers are beginning to tell a story.",
        "This is where discipline matters: small edges, consistently taken, tend to separate the field over time.",
        "You can feel the tension in the timing — every placement carries weight when the spread is this tight.",
        "We’ve moved into the phase where composure is more valuable than bravado.",
        "It’s a measured approach so far: no panic, no chasing — just calm execution.",
        "There’s a rhythm developing now, and it’s starting to favour the steadier side.",
        "The margins may look modest, but in this format, modest margins are often decisive.",
        "This is smart game management: protect the upside, limit the damage, and let the variance come to you.",
        "A quick reminder: the cleanest runs aren’t always the loudest — they’re the ones that stack quietly and consistently.",
        "We’re seeing a shift in control — not dramatic, but meaningful.",
        "This is the kind of contest where one well-timed move can rewrite the entire narrative.",
        "There’s a patience to this performance that suggests confidence, not caution.",
        "If you’re looking for a turning point, watch what happens in the next sequence — this is where leaders usually emerge.",
        "It’s been a high-precision exchange so far: very few wasted opportunities.",
        "This is professional-level restraint: take the value when it’s there, and leave the rest.",
        "The pace is brisk, but it’s not reckless — it’s purposeful.",
        "One side is beginning to win the smaller battles, and those add up before you realise it.",
        "You don’t need fireworks — you need repeatable decisions. That’s what we’re seeing now.",
        "There’s a clarity to the strategy here: simple, sharp, and hard to disrupt.",
        "A lot of players overreact in this spot — the best ones stay steady and let the data catch up.",
        "We’re in classic ‘pressure minutes’ territory, where the next few outcomes can feel amplified.",
        "That’s a tidy piece of work — controlled, efficient, and exactly what the situation demanded.",
        "This contest is being decided on fine detail — and the fine detail is being handled very well.",
        "It’s not just about winning a moment — it’s about winning the sequence.",
        "You can sense the balance tipping, even if the scoreboard hasn’t fully reflected it yet.",
        "This is where experience shows: no emotional decisions, no unnecessary risk.",
        "A strong response there — not flashy, but extremely effective.",
        "It’s a high-quality exchange: both sides are producing, but only one side is converting cleanly.",
        "We’ve seen enough now to say this isn’t luck — this is structure.",
        "The key here is sustainability: can they keep producing these outcomes without forcing it?",
        "That’s a significant beat — and more importantly, it was created rather than gifted.",
        "There’s a calm authority to the way this is being played.",
        "This is the moment where you either tighten up or drift — and one side has tightened up beautifully.",
        "Excellent sequencing: the timing, the selection, and the control all aligned.",
        "If you’re chasing a comeback, you need a clean run — not a miracle. The door is still ajar, but only just.",
        "This is where the smartest move is sometimes doing less, not more.",
        "The scoreboard pressure is real now — you can’t ignore it, but you also can’t let it dictate panic.",
        "They’ve found a reliable edge and they’re leaning into it without overextending.",
        "That’s a well-earned advantage — built on repeated, sensible decisions.",
        "We’re edging towards the business end, and the tone has changed: it’s sharper, more deliberate.",
        "This is where closing ability matters — can they turn control into a result?",
        "It’s a very clean performance under pressure — and that’s never accidental.",
        "The numbers are pointing one way now, and it would take a notable swing to reverse it.",
        "You can admire the efficiency: no wasted motion, no wasted opportunities.",
        "This is a proper studio-grade contest: tight, technical, and quietly intense.",
        "We’re approaching the finish with a clear leader — but you’d still want the final confirmations before calling it.",
        "Final stretch now — and it’s about keeping the fundamentals intact.",
        "And there it is: a composed finish, a deserved result, and a performance that held up from start to end."
      ],
      tone: 'movement',
      alert: 'STUDIO PACK',
    });

    // Append the Elite Desk studio commentary pack
    packages.push({
      id: `studio-pack-elite-${currentGw}`,
      label: 'Studio Pack — Elite Desk (50 lines)',
      headline: 'Studio Pack — Elite Desk (50 lines)',
      lines: [
        "Welcome to the elite desk — no filler, just pure analysis.",
        "From the start you can see the focus: clear decisions, calm execution.",
        "Pressure points appear early; it’s about handling them, not avoiding them.",
        "When margins compress, detail matters more than narrative.",
        "Small adjustments can become big advantages if made consistently.",
        "Experience shows in how they manage sequences, not in their reactions.",
        "Momentum here is earned through steadiness, not through gambles.",
        "Each exchange builds a picture — the trend is becoming unmistakable.",
        "Both sides are probing; the one who keeps structure will profit.",
        "Mistakes aren’t always obvious; sometimes they’re just missed opportunities.",
        "Energy is high, but the best use of energy is controlled pressure.",
        "There’s a method to this tempo — it’s about setting rather than chasing pace.",
        "You can feel one side asserting; the other must respond with clarity.",
        "These middle passages are where contests are often decided quietly.",
        "Risks are being measured; reckless plays don’t fit in this environment.",
        "You don’t have to dominate every moment; you have to win key ones.",
        "Watch the composure when the board tightens — that’s where edges live.",
        "Numbers now reflect the choices made earlier; no surprises here.",
        "Patience in the pocket, power when needed — that’s the blueprint.",
        "Look for patterns: who repeats high-quality plays, who repeats errors?",
        "This desk rewards sustainability; quick fixes fade fast.",
        "When the tempo rises, the disciplined separate from the desperate.",
        "Clean conversions are the hallmark of this performance so far.",
        "Crafting advantage is about sequencing, not about single swings.",
        "You sense a shift; one side is owning the rhythm, the other is following.",
        "No need for theatrics; scoreboard pressure does the talking.",
        "The teams that handle variance calmly usually come through stronger.",
        "Every time they find daylight, they press just enough to widen it.",
        "Holding serve on your decisions is as important as breaking your opponent’s.",
        "It’s a composed display, heavy on fundamentals, light on fluff.",
        "The story at this stage isn’t about drama — it’s about accumulation.",
        "Even small upticks in efficiency manifest over a full contest.",
        "They’re creating pressure pockets and immediately capitalising on them.",
        "We’re seeing an education in controlling momentum without burning out.",
        "If you’re looking for a hero move, you’ll be disappointed; this is about craft.",
        "In the spotlight, every choice is amplified — they’re absorbing that well.",
        "Confidence can be seen in their patience, not in their showmanship.",
        "The scoreboard doesn’t yet scream it, but the undercurrents favour one side.",
        "It’s nearly time for a decisive burst; who has saved enough for it?",
        "The elite desk demands clean finishes; sloppy closers get exposed.",
        "Closing isn’t about speed — it’s about sticking to what built the lead.",
        "They’re locking in now; you can see the urgency become precision.",
        "The distance is modest, but psychologically it’s significant.",
        "This is a lesson in not blinking when the stakes rise.",
        "The final run requires the same habits as the opening, just under more heat.",
        "A composed close is brewing; they just need to stay on script.",
        "Big plays often start with small reads; those have been accurate tonight.",
        "You’ve got to admire the craft: nothing wasted, nothing gifted.",
        "As we near the end, it’s clear the superior process wins again.",
        "And that’s that: efficient, sharp, and exactly what the elite desk demanded."
      ],
      tone: 'movement',
      alert: 'STUDIO PACK',
    });

    packages.push({
      id: `studio-pack-tight-finish-${currentGw}`,
      label: 'Studio Pack — Tight Finish (50 lines)',
      headline: 'Studio Pack — Tight Finish (50 lines)',
      lines: [
        "This is tightening up beautifully — you can feel it heading toward a statement finish.",
        "We’re in the final minutes now, and every outcome carries double the weight.",
        "The gap is narrow enough that a single clean sequence can flip the entire board.",
        "This is where control beats chaos — stay composed and let the moment come to you.",
        "The tempo has climbed, but precision still has to lead the way.",
        "One small error here doesn’t just cost points — it costs position.",
        "This is the sort of finish producers dream of: close, tense, and totally alive.",
        "You can sense both sides recalibrating in real time — it’s chess at full speed.",
        "The margins are razor-thin now; the next exchange could define the result.",
        "This is pressure with a capital P — and the best performers tend to simplify.",
        "We’ve moved into ‘no freebies’ territory — nothing comes easy from here.",
        "Watch the next two sequences closely — this is where runs are born or buried.",
        "They’re not chasing noise; they’re chasing the cleanest available edge.",
        "The scoreboard is whispering, but the momentum is starting to speak louder.",
        "That’s a critical response — exactly what you need in a tightening finish.",
        "The lead is small enough to be fragile, but large enough to be defended — if managed correctly.",
        "This is where discipline becomes the difference between winning and nearly winning.",
        "One side looks calm, the other looks urgent — and urgency can be expensive.",
        "It’s a superb contest of timing: not just what you do, but when you do it.",
        "You can feel the contest trying to pivot — it’s searching for a defining moment.",
        "That’s a tidy sequence — the kind that keeps you within striking distance.",
        "We’re in that uncomfortable zone where you can’t wait, but you can’t rush either.",
        "The next swing could be decisive — and you can sense both sides bracing for it.",
        "This is where closing ability shows: can you convert pressure into clean points?",
        "A slight wobble there — and wobble is the one thing you can’t afford this late.",
        "That’s an ice-cold decision under heat — very high level.",
        "The lead changes aren’t loud, but they’re meaningful — it’s shifting by inches.",
        "This is a classic late-game trade: risk versus control, and control is winning right now.",
        "They’re still alive here — not by hope, but by structure.",
        "That’s a big moment — not necessarily the biggest, but a big one.",
        "We may be heading toward a finish where the smallest details decide everything.",
        "This is where you want your cleanest execution — no drama, just delivery.",
        "A strong hold there — that’s how you protect a narrow advantage.",
        "The pressure is starting to leak into the decisions — you can see it.",
        "It’s getting tense enough that even the quiet outcomes feel enormous.",
        "This is the danger zone for the leader: protect without becoming passive.",
        "There’s a hint of a late charge building — and it’s gathering pace.",
        "That’s a statement response — you could hear that from the studio desk.",
        "We’re approaching the point where you can taste the finish line.",
        "This is where you don’t need perfection — you need consistency.",
        "One more clean sequence and we may have a definitive separation.",
        "That’s a momentum swing — and momentum this late is priceless.",
        "The contest has compressed into a single question: who blinks first?",
        "They’re still trading, still landing — nobody’s folding here.",
        "This is an elite-level finish: controlled aggression, no loose decisions.",
        "It’s on a knife-edge now — and it could go either way.",
        "Final stretch — expect one last surge, one last attempt to steal it.",
        "They’ve got to execute now; there’s no time left for ‘almost.’",
        "And there it is — a decisive late sequence, timed to perfection."
      ],
      tone: 'movement',
      alert: 'STUDIO PACK',
    });

    packages.push({
      id: `studio-pack-big-upset-${currentGw}`,
      label: 'Studio Pack — Big Upset (50 lines)',
      headline: 'Studio Pack — Big Upset (50 lines)',
      lines: [
        "Hold on — this is turning into something nobody saw coming.",
        "We came in expecting a script, and the underdog has just torn it up.",
        "This is the kind of swing that changes the entire tone of a season.",
        "The favourite looks stunned — and you rarely see that at this level.",
        "That is a serious statement: fearless, composed, and completely against expectation.",
        "This is not a fluke — the underdog is building real control, sequence by sequence.",
        "The momentum has shifted so hard you can practically hear it in the room.",
        "If you’re the favourite, you’re suddenly asking uncomfortable questions.",
        "And if you’re the challenger, you’re thinking: keep going, keep landing, keep believing.",
        "This is where upsets become real — when the underdog stops hoping and starts managing.",
        "That’s another clean outcome — and the favourite is running out of easy answers.",
        "The gap is opening in the one place favourites hate: consistency.",
        "This is the best version of an upset: built on structure, not chaos.",
        "The favourite is still dangerous, but right now they look rattled.",
        "This is a classic ‘nothing to lose’ performance — except it’s executed like everything to win.",
        "You can see the confidence growing — and confidence is contagious.",
        "That’s a pivotal moment: the underdog didn’t just survive pressure, they returned it.",
        "At some point, you stop calling it an upset and start calling it the lead.",
        "This is the challenger playing with house money — but making professional decisions.",
        "The favourite is being dragged into uncomfortable territory.",
        "This is where champions respond — and we’re waiting to see if that response arrives.",
        "Another sequence, another advantage — the underdog is stacking outcomes like a veteran.",
        "The scoreboard is starting to look real, and that’s when nerves usually show.",
        "But look at the body language — calm, composed, and completely unbothered.",
        "This is a genuine shock to the system.",
        "If this holds, it’s a result people will talk about for a long time.",
        "The favourite needs a turning point — not a small one, a big one.",
        "And the underdog knows it — you can feel them tightening the screws.",
        "That’s a ruthless piece of efficiency — and it’s widening the story.",
        "This isn’t luck; it’s preparation meeting opportunity.",
        "The favourite is still within range, but the window is narrowing fast.",
        "This is where underdogs often wobble — the question is: do they stay steady?",
        "They do — and that’s the sign of a real contender on the day.",
        "The favourite is chasing now, and chasing is how mistakes happen.",
        "Another clean decision — the underdog is making this look repeatable.",
        "This is the point where belief becomes certainty.",
        "The favourite is throwing everything at it, but nothing is sticking.",
        "This is the upset maturing into control.",
        "A huge moment — not just on the board, but psychologically.",
        "You can sense the favourite running out of time to reset.",
        "The underdog is doing the hardest thing in sport: closing a surprise lead.",
        "That’s composure — absolute composure — in the biggest moment of their run.",
        "We might be witnessing the result of the day, maybe the result of the month.",
        "The favourite needs a miracle swing, and miracles are in short supply right now.",
        "This has been a masterclass in staying present and taking what’s offered.",
        "The underdog is on the brink of something special.",
        "Final stretch — can they hold their nerve and finish the story they started?",
        "They’ve kept it clean, they’ve kept it calm, and they’ve kept the lead.",
        "And there it is — an upset that’s fully earned, fully delivered, and impossible to ignore."
      ],
      tone: 'movement',
      alert: 'STUDIO PACK',
    });

    packages.push({
      id: `studio-pack-cup-round-${currentGw}`,
      label: 'Studio Pack — Cup Round (Knockout Special)',
      headline: 'Studio Pack — Cup Round (Knockout Special)',
      lines: [
        "Welcome to cup football — where form is useful, but survival is everything.",
        "There are no second legs here, no long seasons to recover — tonight, it’s win or go home.",
        "Cup rounds compress pressure into a single evening, and that changes behaviour.",
        "You don’t manage a cup tie — you endure it, control it, and finish it.",
        "One loose sequence in this format can undo an hour of good work.",
        "The favourites know they’re expected to progress — and expectation is heavy.",
        "The underdogs know they only need one clean run to flip the story.",
        "This is knockout territory — urgency without panic is the balance.",
        "You can already sense the edge — this doesn’t feel like a routine fixture.",
        "In league play you measure risk. In cup play, you survive risk.",
        "That’s a sharp opening — nobody easing their way into this.",
        "Cup ties rarely settle early. They simmer before they explode.",
        "The key tonight is composure under elimination pressure.",
        "Every outcome carries weight because there is no tomorrow in this bracket.",
        "This is where experience whispers — and nerves shout.",
        "A tidy sequence there — exactly what knockout football demands.",
        "The favourite wants control; the challenger wants chaos.",
        "And right now, it’s hovering somewhere between the two.",
        "That’s the first real statement of intent.",
        "Cup football rewards bravery — but only if it’s disciplined bravery.",
        "The tension is building — you can feel both sides calculating.",
        "This is the stage where mistakes become headlines.",
        "Knockout formats punish hesitation as much as recklessness.",
        "One clean swing here could tilt the entire tie.",
        "The underdog is still alive — and in cup football, that’s dangerous.",
        "The longer it stays close, the more belief grows.",
        "That’s a pressure exchange — and pressure is the true opponent tonight.",
        "No one wants to blink first in a tie like this.",
        "We’re entering the phase where every decision feels amplified.",
        "Cup rounds are decided by margins so small you barely see them forming.",
        "That’s a massive moment — not just on the board, but psychologically.",
        "The favourite looks uncomfortable — and discomfort breeds opportunity.",
        "This is what giant-killings are built on: discipline and timing.",
        "A composed response there — that might steady the nerves.",
        "In knockout sport, momentum is currency.",
        "You can sense the urgency rising as the clock tightens.",
        "Nobody wants extra drama — but cup ties thrive on it.",
        "That’s a brave move in a high-risk moment.",
        "This is where leaders step forward and simplify the chaos.",
        "The underdog is playing like they belong — and that’s half the battle.",
        "One more clean sequence could define this entire round.",
        "The pressure now is suffocating — every outcome feels enormous.",
        "Cup exits linger. Cup wins echo.",
        "We’re in the business end — survival instincts engaged.",
        "The favourite needs authority; the challenger needs belief.",
        "That’s a huge swing — and swings like that decide knockout ties.",
        "Final stretch now — no safety nets, no safety plays.",
        "It’s on a knife-edge — exactly how cup drama is supposed to feel.",
        "This is where reputations are forged or fractured.",
        "And there it is — a cup round decided by nerve, discipline, and who handled the moment."
      ],
      tone: 'movement',
      alert: 'STUDIO PACK',
    });

    if (predictionsLocked) {
      const disagreements: string[] = [];
      let overlapCount = 0;
      let disagreementCount = 0;
      currentLeagueFixtures.forEach((fixture) => {
        const picks = currentPredictionMap.get(`league-${fixture.id}`);
        const jayPick = pickName(picks?.Jay);
        const computerPick = pickName(picks?.Computer);
        if (!jayPick || !computerPick) {
          return;
        }
        if (jayPick === computerPick) {
          overlapCount += 1;
          return;
        }
        disagreementCount += 1;
        disagreements.push(`${fixture.homeTeam} vs ${fixture.awayTeam}: Jay on ${jayPick}, Computer on ${computerPick}.`);
      });
      currentCupFixtures.forEach((fixture) => {
        const picks = currentPredictionMap.get(`cup-${fixture.id}`);
        const jayPick = pickName(picks?.Jay);
        const computerPick = pickName(picks?.Computer);
        if (!jayPick || !computerPick) {
          return;
        }
        if (jayPick === computerPick) {
          overlapCount += 1;
          return;
        }
        disagreementCount += 1;
        disagreements.push(`${cupSideLabel(fixture, 'home')} vs ${cupSideLabel(fixture, 'away')}: Jay on ${jayPick}, Computer on ${computerPick}.`);
      });
      currentMasterLeagueFixtures.forEach((fixture) => {
        const picks = currentPredictionMap.get(`master-${fixture.id}`);
        const jayPick = pickName(picks?.Jay);
        const computerPick = pickName(picks?.Computer);
        if (!jayPick || !computerPick) {
          return;
        }
        if (jayPick === computerPick) {
          overlapCount += 1;
          return;
        }
        disagreementCount += 1;
        disagreements.push(`${fixture.homeTeam} vs ${fixture.awayTeam} (Master): Jay on ${jayPick}, Computer on ${computerPick}.`);
      });
      currentTrioLeagueFixtures.forEach((fixture) => {
        const picks = currentPredictionMap.get(`trio-${fixture.id}`);
        const jayPick = pickName(picks?.Jay);
        const computerPick = pickName(picks?.Computer);
        if (!jayPick || !computerPick) {
          return;
        }
        if (jayPick === computerPick) {
          overlapCount += 1;
          return;
        }
        disagreementCount += 1;
        disagreements.push(`${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.division}): Jay on ${jayPick}, Computer on ${computerPick}.`);
      });
      const riskLine = disagreementCount >= overlapCount
        ? 'Risk profile is aggressive: more split calls than overlaps.'
        : 'Risk profile is controlled: overlap picks still anchor the card.';
      packages.push({
        id: `picks-locked-${currentGw}`,
        label: `Picks Locked • ${currentGw}`,
        headline: `Quick show: what both sides went for in ${currentGw}`,
        lines: [
          `${overlapCount} overlap picks, ${disagreementCount} disagreement picks.`,
          disagreements[0] ?? 'Most fixtures are aligned between both cards.',
          disagreements[1] ?? riskLine,
          riskLine,
        ],
        tone: 'fixtures',
        alert: 'PICKS LOCKED',
      });
    }

    if (currentGw === 'GW1') {
      const launchLines: string[] = [];
      recapDivisionOrder.forEach((division) => {
        const firstFixture = currentLeagueFixturesForStudio.find((fixture) => fixture.division === division);
        if (!firstFixture) {
          return;
        }
        launchLines.push(`${displayDivisionName(division)} opens with ${firstFixture.homeTeam} vs ${firstFixture.awayTeam}.`);
      });
      if (currentMasterLeagueFixturesForStudio.length > 0) {
        const masterLead = currentMasterLeagueFixturesForStudio[0];
        if (masterLead) {
          launchLines.push(`Master League launch tie: ${masterLead.homeTeam} vs ${masterLead.awayTeam}.`);
        }
      }
      if (currentTrioLeagueFixturesForStudio.length > 0) {
        const trioLead = currentTrioLeagueFixturesForStudio[0];
        if (trioLead) {
          launchLines.push(`${trioFixtureCompetitionLabel(trioLead)} opens with ${trioLead.homeTeam} vs ${trioLead.awayTeam}.`);
        }
      }
      if (currentSuperCupFixtures[0]) {
        launchLines.push(`Super Cup curtain-raiser: ${currentSuperCupFixtures[0].homeTeam} vs ${currentSuperCupFixtures[0].awayTeam}.`);
      }
      if (allTimeLeagues?.pointsTable?.[0]) {
        launchLines.push(`All-time leader right now is ${allTimeLeagues.pointsTable[0].teamName}.`);
      }
      packages.push({
        id: `matchday-launch-${currentGw}`,
        label: 'Matchday Launch Show',
        headline: `Matchday 1 hype across divisions, trio, master league, and all-time boards`,
        lines: launchLines.slice(0, 6),
        tone: 'fixtures',
        alert: 'LAUNCH NIGHT',
      });
    }

    if (currentGw === 'GW1') {
      const cupDrawLines = currentCupFixtures
        .slice(0, 6)
        .map((fixture) => `${cupSideLabel(fixture, 'home')} vs ${cupSideLabel(fixture, 'away')}.`);
      packages.push({
        id: `cup-draw-tease-${currentGw}`,
        label: 'Cup Draw Tomorrow',
        headline: 'Bookie Trophy Draw • Friday, February 20, 2026',
        lines: cupDrawLines.length > 0
          ? cupDrawLines
          : ['The envelope desk is ready. Full tie reveal lands tomorrow night.'],
        tone: 'cup',
        alert: 'DRAW NIGHT',
      });
    }

    if (draw) {
      const spotlightTeam = studioTeams.find((team) => team.id === draw.teamId) ?? null;
      if (spotlightTeam) {
        const masterRow = masterLeagueTable.find((row) => row.teamId === spotlightTeam.id);
        const trioRow = trioLeagueTable.find((row) => row.teamId === spotlightTeam.id) ?? null;
        const tierRow = tierLeagueTable.find((row) => row.teamId === spotlightTeam.id) ?? null;
        const leagueLines = [
          spotlightTeam.rank
            ? `Sydney: ${spotlightTeam.league} - ${ordinal(spotlightTeam.rank)} on ${spotlightTeam.points} points with ${formatSigned(spotlightTeam.seasonProfit)} profit.`
            : `Sydney: ${spotlightTeam.league} position is still pending.`,
          masterRow
            ? `Jess: Master League - ${ordinal(masterRow.rank)} on ${masterRow.points} points with ${formatSigned(masterRow.profit)} profit.`
            : null,
          trioRow
            ? `Miles: Trio League • ${trioRow.division} - ${ordinal(trioRow.rank)} on ${trioRow.points} points with ${formatSigned(trioRow.profit)} profit.`
            : null,
          tierRow
            ? `Sydney: Tier League • ${tierRow.division} - ${ordinal(tierRow.rank)} on ${tierRow.points} points with ${formatSigned(tierRow.profit)} profit.`
            : null,
        ].filter((line): line is string => line !== null);
        const fixtureLines = (spotlightTeam.weeklyFixtures ?? []).map((fixture, index) => {
          const speaker = index % 3 === 0 ? 'Sydney' : index % 3 === 1 ? 'Jess' : 'Miles';
          return `${speaker}: ${fixture.competition} - ${fixture.fixture}. ${fixture.status}.`;
        });
        packages.push({
          id: `kickoff-team-brief-${spotlightTeam.id}-${currentGw}`,
          label: 'Kick-Off Team Brief',
          headline: `${spotlightTeam.name} league positions and fixtures`,
          lines: [
            ...leagueLines,
            ...fixtureLines,
          ],
          tone: 'team',
          alert: 'SPOTLIGHT TEAM',
        });
      }
    }

    if (allTimeLeagues?.pointsTable?.length) {
      const pointsLeader = allTimeLeagues.pointsTable[0];
      const profitLeader = allTimeLeagues.profitTable[0];
      const spinsLeader = allTimeLeagues.spinsTable[0];
      packages.push({
        id: `all-time-pulse-${currentGw}`,
        label: 'All-Time Pulse',
        headline: 'Legacy table check across all seasons',
        lines: [
          pointsLeader ? `${pointsLeader.teamName} lead the all-time points table.` : 'All-time points board is loading.',
          profitLeader ? `${profitLeader.teamName} top the all-time profit chart at ${formatSigned(profitLeader.profit)}.` : 'All-time profit board is loading.',
          spinsLeader ? `${spinsLeader.teamName} have the highest all-time spin volume at ${spinsLeader.spins}.` : 'All-time spins board is loading.',
        ],
        tone: 'movement',
        alert: 'ALL-TIME',
      });
    }

    if (studioMovements.length > 0) {
      packages.push({
        id: `since-last-update-${currentGw}`,
        label: 'Since Last Update',
        headline: studioMovements[0]?.headline ?? 'Table movement update',
        lines: studioMovements.slice(0, 4).map((item) => `${item.headline}. ${item.detail}`),
        tone: 'movement',
        alert: 'DELTA',
      });
    }

    return packages.slice(0, 30);
  }, [
    allTimeLeagues,
    bookieDorBoard,
    currentSeason,
    currentGwLocked,
    currentCupFixtures,
    currentGw,
    currentLeagueFixtures,
    currentLeagueFixturesForStudio,
    currentMasterLeagueFixtures,
    currentMasterLeagueFixturesForStudio,
    currentSuperCupFixtures,
    currentTierLeagueFixturesForStudio,
    currentTrioLeagueFixtures,
    currentTrioLeagueFixturesForStudio,
    tierLeagueTable,
    trioLeagueTable,
    currentPredictionMap,
    draw,
    predictionsLocked,
    prevCupFixtures,
    prevLeagueFixtures,
    prevPredictionMap,
    prevWeekScores,
    recapTarget,
    recapDivisionOrder,
    scoreboardTotals,
    competitionBracketPackages,
    kickoffOddsPackages,
    studioMovements,
    studioTeams,
    kickoffDayPhase.label,
    kickoffDayPhase.line,
    studioTruthLabel,
  ]);

  const recapFixtureRows = useMemo(() => {
    const divisionIndex = new Map(recapDivisionOrder.map((division, idx) => [division, idx]));

    const leagueRows = currentLeagueFixtures
      .slice()
      .sort((a, b) => {
        const aIdx = divisionIndex.get(a.division) ?? recapDivisionOrder.length;
        const bIdx = divisionIndex.get(b.division) ?? recapDivisionOrder.length;
        return aIdx - bIdx || a.id - b.id;
      })
      .map((fixture) => {
        const score =
          fixture.result === 'pending'
            ? 'vs'
            : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
        const outcome =
          fixture.result === 'pending'
            ? 'Pending'
            : fixture.result === 'draw'
              ? 'Draw'
              : `${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} won`;
        return {
          id: `league-${fixture.id}`,
          competition: `League • ${displayDivisionName(fixture.division)}`,
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          score,
          outcome,
          profit:
            fixture.result === 'pending'
              ? '—'
              : `${Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2)} swing`,
        };
      });

    const masterRows = currentMasterLeagueFixtures
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((fixture) => {
        const score =
          fixture.result === 'pending'
            ? 'vs'
            : `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}`;
        const outcome =
          fixture.result === 'pending'
            ? 'Pending'
            : fixture.result === 'draw'
              ? 'Draw'
              : `${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} won`;
        return {
          id: `master-${fixture.id}`,
          competition: 'Master League',
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          score,
          outcome,
          profit:
            fixture.result === 'pending'
              ? '—'
              : `${Math.abs(fixture.homeProfit - fixture.awayProfit).toFixed(2)} swing`,
        };
      });

    const cupRows = currentCupFixtures
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((fixture) => {
        const home = fixture.homeTeam ?? 'TBD';
        const away = fixture.awayTeam ?? 'TBD';
        const tieLabel = fixture.homeTeam && fixture.awayTeam ? `${home} vs ${away}` : `${home === 'TBD' ? away : home} bye`;
        return {
          id: `cup-${fixture.id}`,
          competition: `Cup • ${fixture.roundName}`,
          fixture: tieLabel,
          score: fixture.winnerTeam ? `Winner: ${fixture.winnerTeam}` : 'Pending',
          outcome: fixture.winnerTeam ? `${fixture.winnerTeam} advanced` : 'Pending',
          profit: '—',
        };
      });

    const superCupRows = currentSuperCupFixtures
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((fixture) => ({
        id: `super-cup-${fixture.id}`,
        competition: 'Super Cup',
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        score: fixture.played ? `${fixture.homeProfit.toFixed(2)} - ${fixture.awayProfit.toFixed(2)}` : 'Pending',
        outcome: fixture.winnerTeam ? `${fixture.winnerTeam} won` : 'Pending',
        profit: fixture.pairingExplanation,
      }));

    return [...leagueRows, ...masterRows, ...cupRows, ...superCupRows];
  }, [currentCupFixtures, currentLeagueFixtures, currentMasterLeagueFixtures, currentSuperCupFixtures, recapDivisionOrder]);

  const recapFixturePages = useMemo(() => {
    if (recapFixtureRows.length === 0) {
      return [] as Array<typeof recapFixtureRows>;
    }
    const pages: Array<typeof recapFixtureRows> = [];
    for (let cursor = 0; cursor < recapFixtureRows.length; cursor += RECAP_FIXTURES_PAGE_SIZE) {
      pages.push(recapFixtureRows.slice(cursor, cursor + RECAP_FIXTURES_PAGE_SIZE));
    }
    return pages;
  }, [recapFixtureRows]);

  const activeRecapFixturePage = recapFixturePages[recapFixturePageIndex] ?? [];
  const recapPageTotal = recapFixturePages.length;
  const recapPageLabel = recapPageTotal > 0 ? `${recapFixturePageIndex + 1}/${recapPageTotal}` : '0/0';

  useEffect(() => {
    if (recapFixturePages.length === 0) {
      setRecapFixturePageIndex(0);
      return;
    }
    setRecapFixturePageIndex((prev) => (prev >= recapFixturePages.length ? 0 : prev));
  }, [recapFixturePages.length]);

  const kickoffBlocked = currentGw === 'GW1' && !cupDrawStarted;
  const canStartKickoffShow = predictionsLocked && !kickoffBlocked;
  const leagueFixturesReady = currentLeagueFixtures.length > 0;
  const masterFixturesReady = currentMasterLeagueFixtures.length > 0;
  const masterCupFixturesReady = !isSeasonFiveOrLater(currentSeason) || currentMasterCupFixtures.length > 0;
  const trioFixturesReady = !isSeasonFiveOrLater(currentSeason) || currentTrioLeagueFixtures.length > 0;
  const gw1FixtureSetupNeeded = currentGw === 'GW1' && (!leagueFixturesReady || !masterFixturesReady || !masterCupFixturesReady || !trioFixturesReady);
  const activeKickoffFlowStep: KickoffFlowStep = kickoffFlowStep;
  const showOnlyKickoffStudio = activeKickoffFlowStep === 'show' || activeKickoffFlowStep === 'recap';
  const divisionCarouselActive = drawWheelStage === 'division' || drawWheelStage === 'division-result';
  const teamCarouselActive = drawWheelStage === 'team' || drawWheelStage === 'team-result';
  const selectedDivisionLabel = displayDivisionName(selectedDrawDivision?.division);
  const divisionCarouselBaseItems = drawPool.map((group) => ({
    id: group.division,
    label: displayDivisionName(group.division),
    helper: `${group.teams.length} team${group.teams.length === 1 ? '' : 's'} ready`,
    accent: group.teams[0]?.ballColor ?? '#f6bf4f',
    textColor: group.teams[0]?.textColor ?? '#10213a',
  }));
  const divisionCarouselItems = orderKickoffItems(divisionCarouselBaseItems, divisionCarouselOrderIds);
  const teamCarouselBaseItems = (selectedDrawDivision?.teams ?? []).map((team) => ({
    id: String(team.teamId),
    label: team.teamName,
    helper: `${team.leagueOpponent} • ${team.cupOpponent}`,
    badge: (
      <TeamBadge
        name={team.teamName}
        ballColor={team.ballColor}
        ringColor={team.ringColor}
        textColor={team.textColor}
        size={28}
      />
    ),
    accent: team.ballColor ?? '#77efdb',
    textColor: team.textColor ?? '#10213a',
  }));
  const teamCarouselItems = orderKickoffItems(teamCarouselBaseItems, teamCarouselOrderIds);
  const divisionCarouselLabelList = divisionCarouselItems.map((item) => item.label).join(', ');

  let kickoffWheelHeadline = 'Preparing the live draw';
  let kickoffWheelCopy = 'Loading the remaining divisions and teams for this gameweek.';
  if (drawWheelStage === 'division') {
    kickoffWheelHeadline = 'Division carousel shuffling';
    kickoffWheelCopy = divisionCarouselLabelList
      ? `${divisionCarouselLabelList} ${divisionCarouselItems.length === 1 ? 'is' : 'are'} cycling through the live draw.`
      : 'The remaining divisions are in the mix.';
  } else if (drawWheelStage === 'division-result' && selectedDivisionLabel) {
    kickoffWheelHeadline = `${selectedDivisionLabel} locked in`;
    kickoffWheelCopy = 'Bringing the four-team carousel on next.';
  } else if (drawWheelStage === 'team' && selectedDivisionLabel) {
    kickoffWheelHeadline = `${selectedDivisionLabel} team carousel shuffling`;
    kickoffWheelCopy = 'One team from the selected division will be sent straight into the show.';
  } else if (drawWheelStage === 'team-result' && selectedDrawTeam) {
    kickoffWheelHeadline = `${selectedDrawTeam.teamName} selected`;
    kickoffWheelCopy = 'Opening the team in the kickoff studio now.';
  }

  const activeStepLabel =
    activeKickoffFlowStep === 'results'
      ? 'Results Desk'
      : activeKickoffFlowStep === 'picks'
        ? 'Prediction Slate'
        : activeKickoffFlowStep === 'show'
          ? 'Live Studio'
          : 'End Recap';
  const kickoffReadinessLabel = canStartKickoffShow
    ? 'Ready'
    : kickoffBlocked
      ? 'Draw First'
      : predictionsLocked
        ? 'Stand By'
        : 'Lock Picks';
  const kickoffReadinessDetail = canStartKickoffShow
    ? 'Predictions are locked and the studio can go live.'
    : kickoffBlocked
      ? 'GW1 still needs the BookieBall Cup draw completed.'
      : predictionsLocked
        ? 'The slate is locked, but another setup block still needs clearing.'
        : 'Finish the slate and lock predictions to open the studio.';
  const kickoffShowTeam = useMemo(() => {
    if (!draw) {
      return null;
    }
    return studioTeams.find((team) => team.id === draw.teamId) ?? null;
  }, [draw, studioTeams]);
  const kickoffShowPositionRows = useMemo(() => {
    if (!kickoffShowTeam) {
      return [] as Array<{ label: string; detail: string }>;
    }
    const rows = [
      {
        label: kickoffShowTeam.league,
        detail: `${ordinal(kickoffShowTeam.rank)} • ${kickoffShowTeam.points} pts`,
      },
    ];
    if (kickoffShowTeam.masterPosition) {
      rows.push({
        label: 'Master League',
        detail: `${ordinal(kickoffShowTeam.masterPosition.rank)} • ${kickoffShowTeam.masterPosition.points} pts`,
      });
    }
    const trioRow = trioLeagueTable.find((row) => row.teamId === kickoffShowTeam.id) ?? null;
    if (trioRow) {
      rows.push({
        label: `Trio League • ${trioRow.division}`,
        detail: `${ordinal(trioRow.rank)} • ${trioRow.points} pts`,
      });
    }
    const tierRow = tierLeagueTable.find((row) => row.teamId === kickoffShowTeam.id) ?? null;
    if (tierRow) {
      rows.push({
        label: `Tier League • ${tierRow.division}`,
        detail: `${ordinal(tierRow.rank)} • ${tierRow.points} pts`,
      });
    }
    return rows;
  }, [kickoffShowTeam, tierLeagueTable, trioLeagueTable]);
  const kickoffShowFixtureRows = useMemo(() => {
    if (kickoffShowTeam?.weeklyFixtures?.length) {
      return kickoffShowTeam.weeklyFixtures.map((fixture) => ({
        id: fixture.id,
        competition: fixture.competition,
        fixture: fixture.fixture,
        status: fixture.status,
      }));
    }
    if (!draw) {
      return [] as Array<{ id: string; competition: string; fixture: string; status: string }>;
    }
    const fallbackRows: Array<{ id: string; competition: string; fixture: string; status: string }> = [];
    if (draw.leagueOpponent && draw.leagueOpponent !== 'No Fixture') {
      fallbackRows.push({
        id: `fallback-league-${draw.teamId}`,
        competition: 'League',
        fixture: `${draw.teamName} vs ${draw.leagueOpponent}`,
        status: currentGw,
      });
    }
    if (draw.cupOpponent && draw.cupOpponent !== 'No Fixture') {
      fallbackRows.push({
        id: `fallback-cup-${draw.teamId}`,
        competition: 'Cup',
        fixture: `${draw.teamName} vs ${draw.cupOpponent}`,
        status: currentGw,
      });
    }
    return fallbackRows;
  }, [currentGw, draw, kickoffShowTeam]);
  const kickoffHeroMetrics = [
    {
      label: 'Live Window',
      value: `${currentSeason} ${currentGw}`,
      detail: currentGwLocked ? 'Gameweek locked' : 'Gameweek open',
    },
    {
      label: 'Prediction Slate',
      value: String(predictionSlate.length || 0),
      detail: `${predictionSlateMissingCount > 0 ? `${predictionSlateMissingCount} still loading` : 'All fixtures loaded'}`,
    },
    {
      label: 'Studio Gate',
      value: kickoffReadinessLabel,
      detail: kickoffReadinessDetail,
    },
    {
      label: 'Current Focus',
      value: activeStepLabel,
      detail: `Step ${activeKickoffFlowStep === 'results' ? '1' : activeKickoffFlowStep === 'picks' ? '2' : activeKickoffFlowStep === 'show' ? '3' : '4'} of 4`,
    },
  ] as const;

  return (
    <section className={`page gameshow-page${showOnlyKickoffStudio ? ' kickoff-show-page' : ''}`}>
      <div className="hub-showcase">
        <div className="hub-showcase-hero hub-showcase-hero-gameshow">
          <div className="hub-showcase-hero-head">
            <div className="hub-showcase-hero-copy">
              <span className="hub-showcase-kicker">Interactive Show Hub</span>
              <h1>The Kick-Off Show</h1>
              <p>
                Prediction results first, then weekly guesses, then the live one-screen studio.
                This top layer now mirrors the same visual language as the Analytics Hub, Leagues,
                and Cups launch pages.
              </p>
            </div>
            <div className="hub-showcase-link-row">
              <Link to="/reports" className="hub-showcase-link">Open Analytics Hub</Link>
              <Link to="/fixtures" className="hub-showcase-link">Browse Fixtures</Link>
              <Link to="/cup-draw" className="hub-showcase-link">Cup Draw Studio</Link>
            </div>
          </div>

          <div className="hub-showcase-meta-grid">
            {kickoffHeroMetrics.map((item) => (
              <article key={item.label} className="hub-showcase-meta-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="kickoff-step-strip" role="tablist" aria-label="Kick-Off steps">
        <button
          type="button"
          className={`kickoff-step-chip${activeKickoffFlowStep === 'results' ? ' active' : ''}`}
          onClick={() => setKickoffFlowStep('results')}
        >
          Step 1 • Previous Results ({recapTargetLabel ?? 'N/A'})
        </button>
        <button
          type="button"
          className={`kickoff-step-chip${activeKickoffFlowStep === 'picks' ? ' active' : ''}`}
          onClick={() => setKickoffFlowStep('picks')}
        >
          Step 2 • {currentGw} Predictions
        </button>
        <button
          type="button"
          className={`kickoff-step-chip${activeKickoffFlowStep === 'show' ? ' active' : ''}`}
          onClick={() => setKickoffFlowStep('show')}
          disabled={!predictionsLocked}
          title={!predictionsLocked ? 'Lock predictions first to open Kick-Off Show mode.' : undefined}
        >
          Step 3 • Kick-Off Show
        </button>
        <button
          type="button"
          className={`kickoff-step-chip${activeKickoffFlowStep === 'recap' ? ' active' : ''}`}
          onClick={() => setKickoffFlowStep('recap')}
          disabled={!predictionsLocked}
          title={!predictionsLocked ? 'Complete picks first to view the end recap.' : undefined}
        >
          Step 4 • End Recap
        </button>
      </div>

      {activeKickoffFlowStep === 'results' && (
        <div className="panel kickoff-panel kickoff-flow-shell kickoff-flow-shell-results">
          <div className="kickoff-header">
            <div>
              <h3>Step 1 • Prediction Results</h3>
              <p className="muted">The opening screen shows the last completed 10-game prediction slate only.</p>
              <p className="muted">Last completed gameweek: {recapTargetLabel ?? 'None yet'} • Current gameweek: {currentSeason} {currentGw}</p>
            </div>
            <div className="kickoff-header-actions">
              <button
                className="action"
                type="button"
                onClick={() => setKickoffFlowStep('picks')}
              >
                Done • Go To Weekly Picks
              </button>
            </div>
          </div>
          <div className="kickoff-grid kickoff-grid-results">
            <div className="kickoff-card kickoff-card-scroll kickoff-results-board-card">
              <div className="panel-header">
                <h4>{recapTargetLabel ? `${recapTargetLabel} Prediction Results` : 'Previous Prediction Results'}</h4>
                <span className="muted">{previousPredictionRecapRows.length}/10 games</span>
              </div>
              {previousPredictionRecapRows.length > 0 ? (
                <div className="kickoff-results-board">
                  {previousPredictionRecapColumns.map((column, columnIdx) => (
                    <div key={`previous-results-column-${columnIdx + 1}`} className="kickoff-results-column">
                      {column.map((row) => (
                        <article key={row.key} className="kickoff-results-item">
                          <div className="kickoff-results-item-head">
                            <span className="news-chip">Game {previousPredictionRecapRows.indexOf(row) + 1}</span>
                            <span className="muted">{row.competitionLabel} • {row.detailLabel}</span>
                          </div>
                          <strong>{row.fixtureLabel}</strong>
                          <div className="kickoff-results-item-lines">
                            <div className="kickoff-results-line">
                              <span className="muted">You</span>
                              <strong>{row.jayPick}</strong>
                              <span className={`kickoff-results-state ${row.jayState}`}>{row.jayState === 'correct' ? 'Correct' : row.jayState === 'missed' ? 'Missed' : 'Pending'}</span>
                            </div>
                            <div className="kickoff-results-line">
                              <span className="muted">Computer</span>
                              <strong>{row.computerPick}</strong>
                              <span className={`kickoff-results-state ${row.computerState}`}>{row.computerState === 'correct' ? 'Correct' : row.computerState === 'missed' ? 'Missed' : 'Pending'}</span>
                            </div>
                            <div className="kickoff-results-line kickoff-results-line-actual">
                              <span className="muted">Actual</span>
                              <strong>{row.actualLabel}</strong>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No last-gameweek prediction slate is available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeKickoffFlowStep === 'picks' && (
        <div className="panel kickoff-panel kickoff-flow-shell">
          <div className="kickoff-header">
            <div>
              <h3>Step 2 • Weekly Prediction Guesses</h3>
              <p className="muted">Pick the {predictionSlate.length || 10}-game slate for {currentGw}, lock predictions, then press Done.</p>
            </div>
            <span className={`lock-chip ${predictionsLocked ? 'locked' : 'open'}`}>{predictionsLocked ? 'Locked' : 'Open'}</span>
          </div>
          {kickoffBlocked && (
            <div className="kickoff-locked-summary warning">
              <span className="muted">GW1 kick-off requires the cup draw first.</span>{' '}
              <Link to="/cup-draw" className="action-link">Go To Cup Draw</Link>
            </div>
          )}
          {predictionsLocked && (
            <div className="kickoff-locked-summary">
              <span className="muted">Predictions are locked for {currentGw}. Unlock if you need to edit this gameweek.</span>
              <button
                className="secondary"
                type="button"
                onClick={unlockPredictionsForCurrentGw}
                disabled={predictionSaving}
              >
                {predictionSaving ? `Unlocking ${currentGw}...` : `Unlock ${currentGw} Picks`}
              </button>
            </div>
          )}
          {currentGw === 'GW1' && (
            <div className={`kickoff-locked-summary${gw1FixtureSetupNeeded ? ' warning' : ''}`}>
              <span className="muted">
                Fixture setup: League {leagueFixturesReady ? `${currentLeagueFixtures.length} loaded` : 'not loaded'} • Master {masterFixturesReady ? `${currentMasterLeagueFixtures.length} loaded` : 'not loaded'}{isSeasonFiveOrLater(currentSeason) ? ` • Master Cup ${masterCupFixturesReady ? `${currentMasterCupFixtures.length} loaded` : 'not loaded'} • Trio ${trioFixturesReady ? `${currentTrioLeagueFixtures.length} loaded` : 'not loaded'}` : ''}
              </span>
              <div className="grid-row">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void loadLeagueFixturesForGw()}
                  disabled={fixtureSetupBusy !== null}
                >
                  {fixtureSetupBusy === 'league' ? 'Loading League Fixtures...' : 'Load League Fixtures'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void loadMasterFixturesForGw()}
                  disabled={fixtureSetupBusy !== null}
                >
                  {fixtureSetupBusy === 'master' ? 'Loading Master Fixtures...' : 'Load Master Fixtures'}
                </button>
                {isSeasonFiveOrLater(currentSeason) && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void loadTrioFixturesForGw()}
                    disabled={fixtureSetupBusy !== null}
                  >
                    {fixtureSetupBusy === 'trio' ? 'Loading Trio Fixtures...' : 'Load Trio Fixtures'}
                  </button>
                )}
              </div>
              {fixtureSetupNotice && (
                <span className="muted" style={fixtureSetupNotice.type === 'error' ? { color: 'var(--danger)' } : undefined}>
                  {fixtureSetupNotice.text}
                </span>
              )}
            </div>
          )}
          <div className="kickoff-grid kickoff-grid-picks">
            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header">
                <h4>{currentGw} 10-Game Slate</h4>
                <span className="muted">{predictionSlate.length} selected</span>
              </div>
              <div className="prediction-list">
                {predictionSlate.length === 0 ? (
                  <p className="muted">No prediction slate has been generated for {currentGw} yet.</p>
                ) : predictionSlateMissingCount > 0 ? (
                  <p className="muted">Loading {predictionSlateMissingCount} slate fixtures...</p>
                ) : (
                  predictionSlateFixtures.map((fixture, index) => {
                    const selected = predictionSelections[fixture.key];
                    const currentPredictions = currentPredictionMap.get(fixture.key);
                    return (
                      <div key={fixture.key} className="prediction-fixture">
                        <div className="prediction-meta-row">
                          <span>{index + 1}. {fixture.competitionLabel}</span>
                          <span>{fixture.detailLabel}</span>
                        </div>
                        <div className={`prediction-team-row ${fixture.allowsDraw ? 'prediction-team-row-3' : 'prediction-team-row-2'}`}>
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'home' ? 'active' : ''}`}
                            onClick={() => fixture.homeTeamId && !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [fixture.key]: 'home' }))}
                            disabled={!fixture.homeTeamId || predictionsLocked}
                          >
                            {fixture.homeTeam}
                          </button>
                          {fixture.allowsDraw ? (
                            <button
                              type="button"
                              className={`prediction-team ${selected === 'draw' ? 'active' : ''}`}
                              onClick={() => !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [fixture.key]: 'draw' }))}
                              disabled={predictionsLocked}
                            >
                              Draw
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'away' ? 'active' : ''}`}
                            onClick={() => fixture.awayTeamId && !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [fixture.key]: 'away' }))}
                            disabled={!fixture.awayTeamId || predictionsLocked}
                          >
                            {fixture.awayTeam}
                          </button>
                        </div>
                        {!fixture.allowsDraw ? (
                          <div className="prediction-rule-note">Level profit goes to penalties</div>
                        ) : null}
                        {predictionsLocked ? (
                          <div className="prediction-meta-row">
                            <span>Jay: {pickLabel(currentPredictions?.Jay)}</span>
                            <span>Computer: {pickLabel(currentPredictions?.Computer)}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="kickoff-actions">
            <button className="secondary" type="button" onClick={() => setKickoffFlowStep('results')}>
              Back To Results
            </button>
            <button className="secondary" type="button" onClick={submitPredictions} disabled={predictionsLocked || predictionSaving}>
              {predictionSaving ? 'Submitting...' : 'Submit & Lock Predictions'}
            </button>
            <button className="action" type="button" onClick={() => setKickoffFlowStep('show')} disabled={!predictionsLocked}>
              Done • Go To Kick-Off Show
            </button>
            {predictionMessage && <span className="muted">{predictionMessage}</span>}
          </div>
        </div>
      )}

      {activeKickoffFlowStep === 'show' && (
        <div className="kickoff-show-screen">
          <div className="panel kickoff-show-controls-bar log-panel-compact">
            <div className="controlsBar">
              <div className="miniStack">
                <button
                  className="secondary log-mini-btn"
                  type="button"
                  title="Add free spins line"
                  disabled={!draw || !showLog}
                  onClick={() => setLogRows((prev) => [...prev, createLogRow('free_spins')])}
                >
                  +S
                </button>
                <button
                  className="secondary log-mini-btn"
                  type="button"
                  title="Add bonus line"
                  disabled={!draw || !showLog}
                  onClick={() => setLogRows((prev) => [...prev, createLogRow('bonus')])}
                >
                  +B
                </button>
              </div>

              <div className="fieldsRows">
                {!draw || !showLog ? (
                  <p className="muted controls-placeholder">Press Start to unlock money entry.</p>
                ) : (
                  logRows.map((row, idx) => (
                    <div key={`log-row-${idx}`} className="fieldsRow">
                      <label className="money-field">
                        <span>Type</span>
                        <select
                          className="log-field log-field-type"
                          aria-label="Entry type"
                          value={row.entryType}
                          onChange={(e) => {
                            const nextType = e.target.value as 'free_spins' | 'bonus';
                            setLogRows((prev) => prev.map((r, i) => (
                              i === idx
                                ? {
                                    ...r,
                                    entryType: nextType,
                                    spins: nextType === 'bonus' ? '' : r.spins,
                                    stake: nextType === 'bonus'
                                      ? (r.entryType === 'bonus' ? r.stake : '')
                                      : (r.stake || '0.10'),
                                  }
                                : r
                            )));
                          }}
                        >
                          <option value="free_spins">Spins</option>
                          <option value="bonus">Bonus</option>
                        </select>
                      </label>

                      <label className="money-field">
                        <span>Stake</span>
                        <input
                          className="log-field log-field-stake"
                          aria-label="Stake"
                          type="number"
                          step="0.01"
                          placeholder="Stake"
                          value={row.stake}
                          onChange={(e) => setLogRows((prev) => prev.map((r, i) => (i === idx ? { ...r, stake: e.target.value } : r)))}
                        />
                      </label>

                      <label className="money-field">
                        <span>No. of spins</span>
                        <input
                          className="log-field log-field-spins"
                          aria-label="Number of spins"
                          type="number"
                          placeholder="No. of spins"
                          value={row.entryType === 'bonus' ? '' : row.spins}
                          disabled={row.entryType === 'bonus'}
                          onChange={(e) => setLogRows((prev) => prev.map((r, i) => (i === idx ? { ...r, spins: e.target.value } : r)))}
                        />
                      </label>

                      <label className="money-field">
                        <span>Profit</span>
                        <input
                          className="log-field log-field-profit"
                          aria-label="Profit"
                          type="number"
                          placeholder="Profit"
                          value={row.profit}
                          onChange={(e) => setLogRows((prev) => prev.map((r, i) => (i === idx ? { ...r, profit: e.target.value } : r)))}
                        />
                      </label>

                      <div className="actions rowActions">
                        {idx === 0 ? (
                          <button className="action log-save-btn" onClick={saveLogs}>Save</button>
                        ) : (
                          <span className="save-placeholder" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          className="secondary row-remove log-row-remove-inline danger"
                          onClick={() => setLogRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                className="secondary openTeam"
                type="button"
                disabled={!draw || !showLog}
                onClick={() => {
                  if (!draw) {
                    return;
                  }
                  const target = drawWindowRef.current;
                  if (target && !target.closed) {
                    try {
                      target.location.href = draw.teamUrl;
                      target.focus();
                      return;
                    } catch (error) {
                      drawWindowRef.current = null;
                    }
                  }
                  window.open(draw.teamUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                Open Team Site
              </button>

              <div className="rightActions">
                <span className={`lock-chip ${predictionsLocked ? 'locked' : 'open'}`}>{predictionsLocked ? 'Locked' : 'Open'}</span>
                <button className="secondary" type="button" onClick={() => setKickoffFlowStep('picks')}>
                  Back
                </button>
                <button
                  className="action"
                  type="button"
                  onClick={startShow}
                  disabled={loading || !canStartKickoffShow}
                >
                  Start
                </button>
                <button className="secondary" type="button" onClick={() => setKickoffFlowStep('recap')}>
                  Done
                </button>
              </div>
            </div>

            {kickoffBlocked && (
              <div className="kickoff-show-notice">
                <span className="muted">Cup draw must be completed first on GW1.</span>
                <Link to="/cup-draw" className="action-link">Go To Cup Draw</Link>
              </div>
            )}
            {drawError && <div className="kickoff-show-notice muted">{drawError}</div>}
          </div>

          <div className="kickoff-simple-shell">
            {!kickoffShowTeam ? (
              <div className="panel kickoff-simple-empty">
                <h3>Press Start to draw a team</h3>
                <p className="muted">Once a team is selected, this screen will show that team, their current table positions, and every game they have in {currentGw}.</p>
              </div>
            ) : (
              <div className="kickoff-simple-grid">
                <section className="panel kickoff-simple-card kickoff-simple-team-card">
                  <div className="kickoff-simple-team-head">
                    <TeamBadge
                      name={kickoffShowTeam.name}
                      ballColor={kickoffShowTeam.ballColor}
                      ringColor={kickoffShowTeam.ringColor}
                      textColor={kickoffShowTeam.textColor}
                      size={64}
                    />
                    <div>
                      <span className="news-chip">{currentSeason} {currentGw}</span>
                      <h2>{kickoffShowTeam.name}</h2>
                      <p className="muted">{kickoffShowTeam.league}</p>
                    </div>
                  </div>
                </section>

                <section className="panel kickoff-simple-card">
                  <div className="panel-header">
                    <h3>Current Table Positions</h3>
                  </div>
                  {kickoffShowPositionRows.length > 0 ? (
                    <div className="kickoff-simple-list">
                      {kickoffShowPositionRows.map((row) => (
                        <div key={`position-${row.label}`} className="kickoff-simple-row">
                          <strong>{row.label}</strong>
                          <span>{row.detail}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No table positions available yet.</p>
                  )}
                </section>

                <section className="panel kickoff-simple-card">
                  <div className="panel-header">
                    <h3>Games This Gameweek</h3>
                  </div>
                  {kickoffShowFixtureRows.length > 0 ? (
                    <div className="kickoff-simple-fixtures">
                      {kickoffShowFixtureRows.map((fixture) => (
                        <article key={fixture.id} className="kickoff-simple-fixture">
                          <span className="news-chip">{fixture.competition}</span>
                          <strong>{fixture.fixture}</strong>
                          <span className="muted">{fixture.status}</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No games are loaded for {kickoffShowTeam.name} in {currentGw} yet.</p>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {activeKickoffFlowStep === 'recap' && (
        <div className="panel kickoff-panel kickoff-flow-shell kickoff-recap-shell">
          <div className="kickoff-header">
            <div>
              <h3>Step 4 • End of Kick-Off Show Recap</h3>
              <p className="muted">Gameweek profit board, full tables, and movement up/down.</p>
            </div>
            <div className="kickoff-header-actions">
              <span className="lock-chip locked">Recap</span>
              <button className="secondary" type="button" onClick={() => setKickoffFlowStep('show')}>
                Back To Kick-Off Show
              </button>
            </div>
          </div>

          <div className="kickoff-grid kickoff-grid-recap">
            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header kickoff-recap-page-head">
                <h4>{currentGw} Fixtures Recap</h4>
                <span className="muted">{recapFixtureRows.length} fixtures • Page {recapPageLabel}</span>
              </div>
              {recapFixtureRows.length === 0 ? (
                <p className="muted">No fixture data yet for {currentGw}.</p>
              ) : (
                <>
                  <div className="kickoff-recap-fixtures-table-wrap">
                    <table className="scoreboard-table kickoff-recap-fixtures-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Competition</th>
                          <th>Fixture</th>
                          <th>Score</th>
                          <th>Outcome</th>
                          <th>Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRecapFixturePage.map((row, idx) => {
                          const absoluteIndex = (recapFixturePageIndex * RECAP_FIXTURES_PAGE_SIZE) + idx + 1;
                          return (
                            <tr key={row.id}>
                              <td>{absoluteIndex}</td>
                              <td>{row.competition}</td>
                              <td>{row.fixture}</td>
                              <td>{row.score}</td>
                              <td>{row.outcome}</td>
                              <td>{row.profit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="kickoff-recap-page-controls">
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => setRecapFixturePageIndex((prev) => (prev + 1) % recapFixturePages.length)}
                      disabled={recapFixturePages.length <= 1}
                    >
                      Next Page
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header">
                <h4>All Division Tables</h4>
                <span className="muted">Movement vs previous GW</span>
              </div>
              <div className="kickoff-recap-division-list">
                {recapDivisionOrder.map((division) => {
                  const rows = leagueTable[division] ?? [];
                  return (
                    <div key={`recap-division-${division}`} className="kickoff-recap-division">
                      <strong>{displayDivisionName(division)}</strong>
                      {rows.length === 0 ? (
                        <p className="muted">No rows yet.</p>
                      ) : (
                        <table className="scoreboard-table kickoff-recap-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Team</th>
                              <th>PLD</th>
                              <th>W</th>
                              <th>L</th>
                              <th>D</th>
                              <th>Pts</th>
                              <th>Spins</th>
                              <th>Profit</th>
                              <th>Move</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => {
                              const delta = leagueMovement?.[division]?.[row.teamId] ?? 0;
                              const moveLabel = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '•';
                              const moveClass = delta > 0 ? 'rank-up' : delta < 0 ? 'rank-down' : 'rank-flat';
                              return (
                                <tr key={`recap-${division}-${row.teamId}`}>
                                  <td>{row.rank}</td>
                                  <td>{row.teamName}</td>
                                  <td>{row.played}</td>
                                  <td>{row.wins}</td>
                                  <td>{row.losses}</td>
                                  <td>{row.draws}</td>
                                  <td>{row.points}</td>
                                  <td>{row.spins}</td>
                                  <td>{row.profit}</td>
                                  <td><span className={moveClass}>{moveLabel}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header">
                <h4>Master League Snapshot</h4>
                <span className="muted">{masterLeagueBaselineGw ? `Baseline ${masterLeagueBaselineGw}` : 'No baseline yet'}</span>
              </div>
              {masterLeagueTable.length === 0 ? (
                <p className="muted">Master League table not available yet.</p>
              ) : (
                <table className="scoreboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>PLD</th>
                      <th>W</th>
                      <th>L</th>
                      <th>D</th>
                      <th>Pts</th>
                      <th>Spins</th>
                      <th>Profit</th>
                      <th>Move</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterLeagueTable.map((row) => {
                      const delta = masterLeagueMovement[row.teamId] ?? 0;
                      const moveLabel = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '•';
                      const moveClass = delta > 0 ? 'rank-up' : delta < 0 ? 'rank-down' : 'rank-flat';
                      return (
                        <tr key={`recap-master-${row.teamId}`}>
                          <td>{row.rank}</td>
                          <td>{row.teamName}</td>
                          <td>{row.played}</td>
                          <td>{row.wins}</td>
                          <td>{row.losses}</td>
                          <td>{row.draws}</td>
                          <td>{row.points}</td>
                          <td>{row.spins}</td>
                          <td>{row.profit.toFixed(2)}</td>
                          <td><span className={moveClass}>{moveLabel}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {drawWheelStage !== null && (
        <div className="overlay kickoff-wheel-overlay">
          <div className="kickoff-wheel-overlay-card">
            <div className="kickoff-wheel-overlay-head">
              <span className="news-chip">{teamCarouselActive ? 'Team Carousel' : divisionCarouselActive ? 'Division Carousel' : 'Draw Pool'}</span>
              <h2>{kickoffWheelHeadline}</h2>
              <p>{kickoffWheelCopy}</p>
            </div>

            {drawWheelStage === 'loading' ? (
              <div className="kickoff-wheel-loading">
                <div className="kickoff-wheel-loading-disc" aria-hidden="true" />
                <strong>Building the live pool...</strong>
                <span>Only undrawn teams for {currentSeason} {currentGw} are included.</span>
              </div>
            ) : divisionCarouselActive ? (
              <KickoffSpinCarousel
                eyebrow="Stage 1"
                title="Division Selection"
                subtitle="One division appears at a time until the live draw locks the chosen board."
                statusLabel={drawWheelStage === 'division-result' ? 'Locked In' : 'Shuffling'}
                items={divisionCarouselItems}
                activeId={activeDrawDivisionId}
                lockedId={selectedDrawDivision?.division ?? null}
              />
            ) : (
              <div className="kickoff-wheel-stage-grid">
                <div className="kickoff-wheel-locked-card">
                  <span className="news-chip">Division Locked</span>
                  <h3>{selectedDivisionLabel || 'Division pending'}</h3>
                  <div className="kickoff-wheel-team-list">
                    {(selectedDrawDivision?.teams ?? []).map((team) => (
                      <div
                        key={`locked-division-team-${team.teamId}`}
                        className={`kickoff-wheel-team-row${selectedDrawTeam?.teamId === team.teamId ? ' active' : ''}`}
                      >
                        <TeamBadge
                          name={team.teamName}
                          ballColor={team.ballColor}
                          ringColor={team.ringColor}
                          textColor={team.textColor}
                          size={28}
                        />
                        <div>
                          <strong>{team.teamName}</strong>
                          <span>{team.leagueOpponent} • {team.cupOpponent}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <KickoffSpinCarousel
                  eyebrow="Stage 2"
                  title="Team Selection"
                  subtitle={`Four teams from ${selectedDivisionLabel || 'the selected division'} are cycling through the live draw.`}
                  statusLabel={drawWheelStage === 'team-result' && selectedDrawTeam ? 'Selected' : 'Shuffling'}
                  items={teamCarouselItems}
                  activeId={activeDrawTeamId}
                  lockedId={selectedDrawTeam ? String(selectedDrawTeam.teamId) : null}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
