import { animate, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { StudioSlide } from './SlideDeck';
import { TeamBadge } from './TeamBadge';
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
  competition: 'League' | 'Cup';
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

export type TeamSeasonArchiveRow = {
  season: string;
  division: string;
  rank: number;
  points: number;
  profit: number;
  spins: number;
  cupFinish: string;
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
  statusCode: WeeklyFixtureStatusCode;
  status: string;
  winnerName?: string | null;
  opponentName?: string | null;
  teamScore: string;
  opponentScore: string;
  picks: string;
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
  zoneLabel: string;
  divisionMovement: string;
  seasonStory: TeamSeasonStoryPoint[];
  previousSeasons?: TeamSeasonArchiveRow[];
  previousCupRuns?: TeamCupArchiveRow[];
  currentLeagueJourney?: TeamLeagueJourneyRow[];
  currentCupJourney?: TeamCupJourneyRow[];
  analytics?: TeamAnalytics;
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

function lastResolvedCupRound(rows: TeamCupJourneyRow[]): TeamCupJourneyRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row && row.result !== 'Pending') {
      return row;
    }
  }
  return null;
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
  if (opponentScore === null || !opponentName || opponentName.toUpperCase() === 'BYE') {
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

export function TeamSpotlightSlides(teams: TeamSpotlightData[]): StudioSlide[] {
  const slides: StudioSlide[] = [];

  teams.forEach((team) => {
    const prefix = `team-${team.id}`;
    const rankShift =
      team.rank !== null && team.predictedRank !== null
        ? team.rank - team.predictedRank
        : 0;
    const rankShiftLabel =
      rankShift > 0
        ? `Projected up ${rankShift}`
        : rankShift < 0
          ? `Projected down ${Math.abs(rankShift)}`
          : 'Hold position';
    const rankShiftClass = rankShift > 0 ? 'up' : rankShift < 0 ? 'down' : 'flat';

    const previousSeasons = team.previousSeasons ?? [];
    const previousCupRuns = team.previousCupRuns ?? [];
    const currentLeagueJourney = team.currentLeagueJourney ?? [];
    const currentCupJourney = team.currentCupJourney ?? [];
    const analytics: TeamAnalytics = team.analytics ?? {
      bestGw: null,
      bestGwProfit: null,
      worstGw: null,
      worstGwProfit: null,
      avgGwProfit: null,
      totalLeagueProfit: team.seasonProfit,
      totalLeagueSpins: team.spins,
      spinEfficiency: team.spins > 0 ? team.seasonProfit / team.spins : null,
      cupAdvances: team.cupForm.filter((value) => value === 'W' || value === 'B').length,
      bestMatchLabel: null,
    };
    const maxBarAbs = Math.max(
      1,
      Math.abs(analytics.bestGwProfit ?? 0),
      Math.abs(analytics.worstGwProfit ?? 0),
      Math.abs(team.currentGwProfit ?? 0),
      Math.abs(team.seasonProfit),
    );
    const weeklyFixtures = team.weeklyFixtures ?? [];
    const predictionCredit = team.predictionCredit ?? {
      jayPoints: 0,
      jayCorrect: 0,
      computerPoints: 0,
      computerCorrect: 0,
      resolved: 0,
    };
    const lastSeasonSummary = team.lastSeasonSummary ?? null;
    const liveOpponentRows = weeklyFixtures;
    const liveInPlayCount = liveOpponentRows.filter((fixture) => isWeeklyStatusInPlay(fixture.statusCode)).length;
    const liveResolvedCount = liveOpponentRows.filter((fixture) => isWeeklyStatusResolved(fixture.statusCode)).length;
    const livePendingCount = Math.max(0, liveOpponentRows.length - liveInPlayCount - liveResolvedCount);
    const liveScoreDeltas = liveOpponentRows
      .map((fixture) => {
        const teamScore = parseScoreValue(fixture.teamScore);
        const opponentScore = parseScoreValue(fixture.opponentScore);
        if (teamScore === null || opponentScore === null) {
          return null;
        }
        return teamScore - opponentScore;
      })
      .filter((value): value is number => value !== null);
    const averageLiveDelta = liveScoreDeltas.length > 0
      ? liveScoreDeltas.reduce((sum, value) => sum + value, 0) / liveScoreDeltas.length
      : null;
    const topLiveDelta = liveScoreDeltas.length > 0
      ? Math.max(...liveScoreDeltas)
      : null;
    const predictionAlignment = liveOpponentRows.reduce((acc, fixture) => {
      const picks = parsePickSummary(fixture.picks);
      if (picks.jay === '—' || picks.computer === '—') {
        return acc;
      }
      acc.total += 1;
      if (normalizePickToken(picks.jay) === normalizePickToken(picks.computer)) {
        acc.aligned += 1;
      }
      return acc;
    }, { aligned: 0, total: 0 });
    const predictionAgreementPct = predictionAlignment.total > 0
      ? Math.round((predictionAlignment.aligned / predictionAlignment.total) * 100)
      : null;
    const predictionPointEdge = predictionCredit.jayPoints - predictionCredit.computerPoints;
    const predictionEdgeLine = predictionPointEdge === 0
      ? 'Prediction points are level.'
      : predictionPointEdge > 0
        ? 'Jay currently leads the prediction race.'
        : 'Computer currently leads the prediction race.';
    const resolvedWinnerNames = liveOpponentRows
      .filter((fixture) => isWeeklyStatusResolved(fixture.statusCode))
      .map((fixture) => inferFixtureWinnerName(team.name, fixture))
      .filter((winner): winner is string => Boolean(winner));
    const resultTruth = team.resultTruth ?? 'live';
    const isConfirmedTruth = resultTruth === 'confirmed';
    const winnerCallouts = liveOpponentRows
      .map((fixture) => buildWinnerCallout(team.name, fixture, resultTruth))
      .filter((callout): callout is string => Boolean(callout));
    const opponentScoreCallouts = liveOpponentRows
      .map((fixture) => buildOpponentScoreCallout(team.name, fixture))
      .filter((callout): callout is string => Boolean(callout));
    const opponentScoreDeskLine = opponentScoreCallouts.length > 0
      ? opponentScoreCallouts.slice(0, 3).join(' ')
      : 'Opponent score updates will be called once entries are recorded.';
    const winnersDeskLine = resolvedWinnerNames.length > 0
      ? `${isConfirmedTruth ? 'Confirmed winners so far are' : 'As it stands, winners are'} ${presenterList(resolvedWinnerNames.slice(0, 4))}.`
      : liveInPlayCount > 0
        ? 'No final winner call yet, because this board still has live games.'
        : isConfirmedTruth
          ? 'No confirmed winner calls are available yet.'
          : 'Winner calls remain provisional until lock and rollover.';
    const winnerNarration = winnerCallouts.length > 0
      ? `${winnerCallouts.slice(0, 3).join(' ')} ${opponentScoreDeskLine}`.trim()
      : winnersDeskLine;
    const liveBoardNarration = liveOpponentRows.length === 0
      ? 'No fixture board is loaded yet.'
      : liveInPlayCount > 0
        ? 'Some fixtures are still live and moving.'
        : liveResolvedCount > 0
          ? 'Most fixtures have now settled.'
          : 'Fixtures are waiting for updates.';
    const modelNarration = predictionAgreementPct === null
      ? 'Prediction models are still loading for this board.'
      : predictionAgreementPct >= 70
        ? 'Jay and Computer mostly agree on likely winners.'
        : predictionAgreementPct <= 35
          ? 'Jay and Computer are reading this board differently.'
          : 'Jay and Computer are split on several ties.';
    const projectionConfidence = team.rank === null || team.predictedRank === null
      ? 40
      : Math.max(12, 100 - Math.abs(team.rank - team.predictedRank) * 18);

    const momentumCard: InterpretationCard = averageLiveDelta === null
      ? {
        lens: 'Momentum Lens',
        headline: 'Signal Pending',
        detail: 'Numeric score deltas arrive once fixtures fully settle.',
        tone: 'flat',
      }
      : averageLiveDelta >= 0.4
        ? {
          lens: 'Momentum Lens',
          headline: 'You Lead The Duels',
          detail: `Average edge ${formatSigned(averageLiveDelta)} across ${liveScoreDeltas.length} scored board${liveScoreDeltas.length === 1 ? '' : 's'}${topLiveDelta !== null ? `, with a best swing of ${formatSigned(topLiveDelta)}` : ''}.`,
          tone: 'up',
        }
        : averageLiveDelta <= -0.4
          ? {
            lens: 'Momentum Lens',
            headline: 'Opponents Holding Edge',
            detail: `Average deficit ${formatSigned(averageLiveDelta)} with recovery still possible in live ties.`,
            tone: 'down',
          }
          : {
            lens: 'Momentum Lens',
            headline: 'Margins Are Tight',
            detail: `Average swing ${formatSigned(averageLiveDelta)} shows a near-even board.`,
            tone: 'flat',
          };

    const tempoCard: InterpretationCard = liveOpponentRows.length === 0
      ? {
        lens: 'Tempo Lens',
        headline: 'Awaiting Kickoff',
        detail: 'No fixtures loaded yet for this gameweek.',
        tone: 'flat',
      }
      : liveInPlayCount >= Math.max(2, Math.ceil(liveOpponentRows.length / 2))
        ? {
          lens: 'Tempo Lens',
          headline: 'Live Volatility High',
          detail: `${liveInPlayCount} fixture${liveInPlayCount === 1 ? '' : 's'} currently in play with rapid movement risk.`,
          tone: 'up',
        }
        : liveResolvedCount >= Math.max(2, liveOpponentRows.length - 1)
          ? {
            lens: 'Tempo Lens',
            headline: 'Board Mostly Settled',
            detail: `${liveResolvedCount}/${liveOpponentRows.length} fixtures resolved, so decisions can be data-led.`,
            tone: 'flat',
          }
          : {
            lens: 'Tempo Lens',
            headline: 'Mixed Board State',
            detail: `${livePendingCount} pending, ${liveInPlayCount} in play, ${liveResolvedCount} resolved.`,
            tone: 'flat',
          };

    const modelCard: InterpretationCard = predictionAgreementPct === null
      ? {
        lens: 'Model Lens',
        headline: 'Picks Not In Yet',
        detail: 'Prediction alignment appears once Jay and Computer picks are populated.',
        tone: 'flat',
      }
      : predictionAgreementPct >= 70
        ? {
          lens: 'Model Lens',
          headline: 'Strong Consensus',
          detail: `${predictionAgreementPct}% Jay/Computer agreement, lowering variance this week. ${predictionEdgeLine}`,
          tone: 'up',
        }
        : predictionAgreementPct <= 35
          ? {
            lens: 'Model Lens',
            headline: 'Split Read',
            detail: `${predictionAgreementPct}% agreement means more contrarian opportunities. ${predictionEdgeLine}`,
            tone: 'down',
          }
          : {
            lens: 'Model Lens',
            headline: 'Balanced Read',
            detail: `${predictionAgreementPct}% agreement keeps the board open for late swings. ${predictionEdgeLine}`,
            tone: 'flat',
          };

    const interpretationCards: InterpretationCard[] = [momentumCard, tempoCard, modelCard];
    const actionLine = team.zoneLabel.toLowerCase().includes('relegation')
      ? 'Action cue: prioritize safe points before high-variance spins.'
      : team.zoneLabel.toLowerCase().includes('promotion') || team.zoneLabel.toLowerCase().includes('title')
        ? 'Action cue: protect the advantage and force opponents to chase.'
        : 'Action cue: one aggressive pick can still move this team up the table.';
    const movementLine = team.divisionMovement
      ? `What changed: ${team.divisionMovement}.`
      : 'What changed: movement signal not available yet.';
    const projectionShiftLine = team.predictedRank !== null && team.rank !== null
      ? rankShift > 0
        ? `Projection swing: up ${rankShift} places versus model expectation.`
        : rankShift < 0
          ? `Projection swing: down ${Math.abs(rankShift)} places against model expectation.`
          : 'Projection swing: holding the expected lane.'
      : 'Projection swing: model comparison pending.';
    const formLine = team.streak && team.streak !== 'No form'
      ? `League streak right now: ${team.streak}.`
      : 'Form line is still building this week.';
    const leagueGamesPlayed = Math.max(
      currentLeagueJourney.filter((fixture) => fixture.result !== 'P').length,
      team.wins + team.draws + team.losses,
    );
    const seasonComplete = isSeasonLikelyComplete(team, currentLeagueJourney, weeklyFixtures);
    const canConfirmSeasonVerdict = seasonComplete && isConfirmedTruth;
    const playoffContext = team.playoffContext ?? null;
    const inferredPhase: TeamPlayoffPhase = canConfirmSeasonVerdict ? 'playoffs' : 'regular';
    const storyPhase = playoffContext?.phase ?? inferredPhase;
    const endgamePhase = storyPhase === 'playoffs' || storyPhase === 'run-in';
    const dayPhaseLine = team.dayPhaseLine ?? (
      team.dayPhase === 'middle'
        ? 'Middle phase: this board can still swing either way.'
        : team.dayPhase === 'latter'
          ? 'Latter phase: pressure is rising as full-time nears.'
          : team.dayPhase === 'closing'
            ? 'Closing window: only a few moments remain before lock.'
            : 'Kickoff phase: early exchanges are shaping the board.'
    );
    const liveTruthLine = isConfirmedTruth
      ? 'Confirmed wrap-up: this gameweek has rolled and results are now final.'
      : 'As it stands, results remain provisional until lock and rollover.';
    const seasonStartRows = currentLeagueJourney.filter((fixture) => fixture.result !== 'P').slice(0, 2);
    const earlySeasonLine = seasonStartRows.length > 0
      ? `They opened with ${seasonStartRows.map((fixture) => {
        const outcome = fixture.result === 'W'
          ? 'a win'
          : fixture.result === 'D'
            ? 'a draw'
            : 'a loss';
        return `${fixture.gw} ${fixture.venue === 'H' ? 'at home to' : 'away to'} ${fixture.opponent}, which was ${outcome}`;
      }).join(', and ')}.`
      : 'Their season start is still forming with early fixtures pending.';
    const seasonNowLine = team.rank === null
      ? `Right now ${team.name} are still waiting for a live rank update in ${team.league}.`
      : `Right now ${team.name} sit ${formatOrdinal(team.rank)} in ${team.league} and the current read is ${team.zoneLabel}.`;
    const rankStoryLine = buildRankStoryLine(team, seasonComplete, leagueGamesPlayed, prefix);
    const cupJourneyLine = summarizeCupJourney(team.name, currentCupJourney, team.nextCupFixture);
    const nextStoryLine = team.nextLeagueFixture.toLowerCase().includes('no pending')
      ? `League fixtures are complete, and cup watch is ${team.nextCupFixture}.`
      : `Next up in league play is ${team.nextLeagueFixture}. Cup watch is ${team.nextCupFixture}. No call is final until rollover.`;
    const lastSeasonDescriptor = lastSeasonSummary ? formatSeasonNarrative(lastSeasonSummary.season) : null;
    const lastSeasonLine = lastSeasonSummary
      ? `In their ${lastSeasonDescriptor ?? 'previous season'}, they finished ${formatOrdinal(lastSeasonSummary.rank)} in ${lastSeasonSummary.division}, with ${lastSeasonSummary.cupFinish} in the cup.`
      : 'Last-season archive depth is limited, so this campaign carries most of the narrative weight.';
    const isKickoffSeason = team.currentGw === 'GW1';
    const kickoffRecapLine = lastSeasonSummary
      ? `${team.name} in their ${lastSeasonDescriptor ?? 'previous season'} finished ${formatOrdinal(lastSeasonSummary.rank)} in ${lastSeasonSummary.division}, on ${lastSeasonSummary.points} points with ${formatSigned(lastSeasonSummary.profit)} profit, plus ${lastSeasonSummary.cupFinish} in the cup.`
      : 'Last season recap: archive depth is limited, so this season sets the baseline.';
    const kickoffChallengeLine = lastSeasonSummary
      ? lastSeasonSummary.rank === 1
        ? 'Challenge ahead: defend the crown and keep the pace from the opening fixtures.'
        : lastSeasonSummary.rank <= 2
          ? 'Challenge ahead: turn last season momentum into a title push.'
          : lastSeasonSummary.rank === 3
            ? 'Challenge ahead: climb into the promotion places and close the gap early.'
            : 'Challenge ahead: reset after last season and move clear of the lower spots quickly.'
      : 'Challenge ahead: set an early benchmark and avoid a slow start.';
    const kickoffSeasonLine = `${kickoffRecapLine} ${kickoffChallengeLine} ${nextStoryLine}`;
    const seasonStartLine = isKickoffSeason
      ? kickoffSeasonLine
      : endgamePhase
        ? pickBySeed(`${prefix}-endgame-open`, [
          'The early season phase is behind them, and this is now a run-in story.',
          'Opening-week noise is gone; this is now about endgame positions.',
          'The start of the season is in the rear-view mirror and the race is now live.',
        ])
        : earlySeasonLine;
    const rivalryDeskLine = team.rivalry
      ? `Rivalry monitor says keep an eye on ${team.rivalry.opponent}.`
      : 'No direct rivalry alarm is active this week.';
    const playoffRaceLine = playoffContext
      ? `${playoffContext.outlookLabel}. ${playoffContext.raceLine} ${playoffContext.pointsGapLine}`
      : rankStoryLine;
    const bracketLine = playoffContext?.bracketLine ?? '';
    const preseasonExpectationLine = team.preseasonFavorite
      ? team.rank !== null && team.rank >= 4
        ? 'Surprising slide for a pre-season favorite.'
        : 'Pre-season favorite tag and current output remain aligned.'
      : '';
    const expectationLine = playoffContext?.expectationLine ?? (preseasonExpectationLine || movementLine);
    const trendLine = playoffContext?.trendLine ?? formLine;
    const actionCueLine = playoffContext?.actionLine ?? actionLine;
    const verdictLine = canConfirmSeasonVerdict
      ? `Season verdict: ${playoffRaceLine} ${expectationLine} Cup summary: ${cupJourneyLine}`
      : `Season trajectory, as it stands: ${playoffRaceLine} ${trendLine}`;
    const introStoryLine = pickBySeed(`${prefix}-story-intro`, [
      `${team.name} are in our main spotlight from ${team.league}.`,
      `Spotlight check-in now for ${team.name} in ${team.league}.`,
      `Main story now is ${team.name} from ${team.league}.`,
    ]);
    const verdictLastSeasonLine = isKickoffSeason ? '' : lastSeasonLine;
    const storySections = [
      { label: 'Intro', text: introStoryLine },
      { label: 'League', text: `${dayPhaseLine} ${seasonStartLine} ${seasonNowLine} ${playoffRaceLine} ${opponentScoreDeskLine}` },
      { label: 'Cup', text: `${cupJourneyLine} ${bracketLine}`.trim() },
      { label: 'Verdict', text: `${canConfirmSeasonVerdict ? verdictLine : `Current read: ${playoffRaceLine}`} ${liveTruthLine} ${expectationLine} ${verdictLastSeasonLine}`.trim() },
      { label: 'Next', text: `${nextStoryLine} ${actionCueLine} ${liveTruthLine} ${bracketLine}`.trim() },
    ];
    const storyNarration = storySections
      .map((section) => `${section.label}: ${section.text}`)
      .join(' ');
    const winnersDigest = winnerCallouts.length > 0
      ? `${winnerCallouts.slice(0, 2).join(' ')} ${opponentScoreDeskLine}`.trim()
      : winnersDeskLine;

    const liveNarration = `${pickBySeed(`${prefix}-voice-live`, [
      `Live desk update for ${team.name}.`,
      `${team.name} check-in from the studio desk.`,
      `Analyst view on ${team.name}.`,
    ])} ${dayPhaseLine} ${seasonStartLine} ${seasonNowLine} ${playoffRaceLine} ${expectationLine} ${winnersDigest} ${liveTruthLine} ${cupJourneyLine} ${bracketLine} ${nextStoryLine} ${actionCueLine}`;
    const weeklyNarration = `${pickBySeed(`${prefix}-voice-weekly`, [
      `Match-centre update for ${team.name}.`,
      `Weekly board read for ${team.name}.`,
      `${team.name} fixture desk summary.`,
    ])} ${dayPhaseLine} ${winnerNarration} ${trendLine} ${playoffRaceLine} ${rivalryDeskLine} ${opponentScoreDeskLine} ${liveTruthLine} ${bracketLine} ${nextStoryLine} ${actionCueLine}`;
    const legacyNarration = `${pickBySeed(`${prefix}-voice-legacy`, [
      `Archive check for ${team.name}.`,
      `${team.name} historical profile.`,
      `Legacy view on ${team.name}.`,
    ])} Historical season trends and cup journeys are on screen. ${lastSeasonLine}`;
    const seasonJourneyNarration = `${pickBySeed(`${prefix}-voice-journey`, [
      `${team.name} season journey snapshot.`,
      `Progress tracker for ${team.name}.`,
      `This-season route for ${team.name}.`,
    ])} League and cup journeys are visible for this season. ${dayPhaseLine} ${seasonStartLine} ${seasonNowLine} ${playoffRaceLine} ${liveTruthLine} ${bracketLine} ${verdictLine} ${nextStoryLine}`;
    const analyticsNarration = `${pickBySeed(`${prefix}-voice-analytics`, [
      `${team.name} analytics desk.`,
      `Performance view for ${team.name}.`,
      `Form readout on ${team.name}.`,
    ])} Form, efficiency, and standout gameweek signals are on screen. ${seasonNowLine} ${liveBoardNarration} ${modelNarration}`;
    const projectionNarration = `${pickBySeed(`${prefix}-voice-projection`, [
      `${team.name} projection briefing.`,
      `Forward view for ${team.name}.`,
      `Run-in projection for ${team.name}.`,
    ])} Projection direction and movement trend are on screen. ${dayPhaseLine} ${projectionShiftLine} ${playoffRaceLine} ${liveTruthLine} ${bracketLine} ${verdictLine} ${nextStoryLine} ${actionCueLine}`;

    slides.push({
      id: `${prefix}-story-spotlight`,
      label: `${team.name} • Story Spotlight`,
      durationMs: 15000,
      narration: storyNarration,
      tone: 'team',
      content: (
        <div className="studio-story-spotlight">
          <div className="studio-story-spotlight-head">
            <span className="studio-kicker">Card 1 • Story Spotlight</span>
            <div className="studio-story-spotlight-title">
              <TeamBadge
                name={team.name}
                ballColor={team.ballColor}
                ringColor={team.ringColor}
                textColor={team.textColor}
                size={34}
              />
              <div>
                <h3>{team.name}</h3>
                <p>
                  {storyPhase === 'playoffs'
                    ? 'Playoff phase verdict with promotion and drop context.'
                    : storyPhase === 'run-in'
                      ? 'Run-in phase read with race context.'
                      : 'Live season trajectory with cup context.'}
                </p>
              </div>
            </div>
            <div className="studio-story-spotlight-meta">
              <span>{team.league}</span>
              <span>{team.rank !== null ? formatOrdinal(team.rank) : 'Rank pending'}</span>
              <span>{team.points} pts</span>
              {playoffContext?.outlookLabel && <span>{playoffContext.outlookLabel}</span>}
            </div>
          </div>

          <div className="studio-story-progress-inline" aria-label="Story sections">
            {storySections.map((section) => (
              <span key={`${prefix}-section-${section.label}`} className="studio-story-progress-chip">{section.label}</span>
            ))}
          </div>

          <div className="studio-story-spotlight-grid">
            <article className="studio-story-spotlight-card">
              <h4>Story Arc</h4>
              <ul className="studio-story-spotlight-list">
                {storySections.map((section) => (
                  <li key={`${prefix}-story-${section.label}`}>
                    <strong>{section.label}:</strong> <span>{section.text}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="studio-story-spotlight-card">
              <h4>Winners & Snapshot</h4>
              <div className="studio-story-spotlight-metrics">
                <span>{team.wins}W {team.draws}D {team.losses}L</span>
                <span>{formatSigned(team.seasonProfit)} season profit</span>
                <span>{team.spins} spins</span>
              </div>
              <div className="studio-story-spotlight-results">
                {winnerCallouts.length > 0 ? (
                  winnerCallouts.slice(0, 4).map((callout, index) => (
                    <p key={`${prefix}-winner-${index}`}>{callout}</p>
                  ))
                ) : (
                  <p>{winnersDeskLine}</p>
                )}
                {opponentScoreCallouts.length > 0 && opponentScoreCallouts.slice(0, 3).map((callout, index) => (
                  <p key={`${prefix}-opponent-score-${index}`}>{callout}</p>
                ))}
              </div>
            </article>
          </div>
        </div>
      ),
    });

    slides.push({
      id: `${prefix}-live-opponent-scores`,
      label: `${team.name} • Live Match Lens`,
      durationMs: 12000,
      narration: liveNarration,
      tone: 'team',
      content: (
        <div className="studio-team-split">
          <div className="studio-team-head">
            <span className="studio-kicker">Card 1 • Live Opponent Scores</span>
            <h3>{team.name}</h3>
            <p>Read the board through momentum, tempo, and model alignment instead of raw scores only.</p>
          </div>
          <div className="studio-insight-stack">
            <div className="studio-quick-stats">
              <div className="studio-quick-stat">
                <span>Fixtures</span>
                <strong>{liveOpponentRows.length}</strong>
              </div>
              <div className="studio-quick-stat">
                <span>In Play</span>
                <strong>{liveInPlayCount}</strong>
              </div>
              <div className="studio-quick-stat">
                <span>Resolved</span>
                <strong>{liveResolvedCount}</strong>
              </div>
            </div>
            <div className="studio-interpret-grid">
              {interpretationCards.map((card) => (
                <article key={`${prefix}-interpret-${card.lens}`} className={`studio-interpret-card ${card.tone}`}>
                  <span>{card.lens}</span>
                  <strong>{card.headline}</strong>
                  <p>{card.detail}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="studio-team-three-col split">
            <div className="studio-recent-board studio-scroll-panel">
              <h4>{team.currentGw} Scoreboard</h4>
              {liveOpponentRows.length > 0 ? (
                liveOpponentRows.map((fixture) => (
                  <article key={`live-${fixture.id}`} className={`studio-result-item outcome-${weeklyStatusTone(fixture.statusCode)}`}>
                    <div className="studio-result-head">
                      <span className="studio-comp-badge league">{fixture.competition}</span>
                      <strong>{fixture.fixture}</strong>
                      <span className={`studio-inline-result ${weeklyStatusTone(fixture.statusCode)}`}>{fixture.status}</span>
                    </div>
                    <div className="studio-result-meta">
                      <span className="studio-data-chip">You {fixture.teamScore}</span>
                      <span className="studio-data-chip">Opp {fixture.opponentScore}</span>
                    </div>
                    <ScoreDuelBars teamScore={fixture.teamScore} opponentScore={fixture.opponentScore} />
                  </article>
                ))
              ) : (
                <p className="studio-muted">No live opponent scores yet.</p>
              )}
            </div>
            <div className="studio-upcoming-board studio-scroll-panel">
              <h4>Prediction Context</h4>
              {liveOpponentRows.length > 0 ? (
                liveOpponentRows.map((fixture) => {
                  const picks = parsePickSummary(fixture.picks);
                  return (
                    <article key={`live-pick-${fixture.id}`} className="studio-result-item">
                      <div className="studio-result-head">
                        <span className="studio-comp-badge cup">Picks</span>
                        <strong>{fixture.competition}</strong>
                      </div>
                      <div className="studio-pick-pill-row">
                        <span className="studio-pick-pill jay">Jay {picks.jay}</span>
                        <span className="studio-pick-pill computer">Computer {picks.computer}</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="studio-muted">Predictions load once fixtures are available.</p>
              )}
            </div>
          </div>
        </div>
      ),
    });

    slides.push({
      id: `${prefix}-weekly-match-centre`,
      label: `${team.name} • Weekly Match Centre`,
      durationMs: 12000,
      narration: weeklyNarration,
      tone: 'team',
      content: (
        <div className="studio-team-split">
          <div className="studio-team-head">
            <span className="studio-kicker">Card 2 • Weekly Match Centre</span>
            <h3>{team.name}</h3>
            <p>{team.currentGw} fixtures across league, master league, and cup with credit and context layers.</p>
          </div>
          <div className="studio-team-three-col split">
            <div className="studio-recent-board studio-scroll-panel">
              <h4>{team.currentGw} Fixtures</h4>
              {weeklyFixtures.length > 0 ? (
                weeklyFixtures.map((fixture) => {
                  const picks = parsePickSummary(fixture.picks);
                  return (
                    <article key={fixture.id} className={`studio-result-item outcome-${weeklyStatusTone(fixture.statusCode)}`}>
                      <div className="studio-result-head">
                        <span className="studio-comp-badge league">{fixture.competition}</span>
                        <strong>{fixture.fixture}</strong>
                        <span className={`studio-inline-result ${weeklyStatusTone(fixture.statusCode)}`}>{fixture.status}</span>
                      </div>
                      <div className="studio-result-meta">
                        <span className="studio-data-chip">You {fixture.teamScore}</span>
                        <span className="studio-data-chip">Opp {fixture.opponentScore}</span>
                      </div>
                      <ScoreDuelBars teamScore={fixture.teamScore} opponentScore={fixture.opponentScore} />
                      <div className="studio-pick-pill-row">
                        <span className="studio-pick-pill jay">Jay {picks.jay}</span>
                        <span className="studio-pick-pill computer">Computer {picks.computer}</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="studio-muted">No fixtures for this gameweek.</p>
              )}
            </div>
            <div className="studio-upcoming-board studio-scroll-panel">
              <h4>Guessing Credit</h4>
              <PredictionRace jayPoints={predictionCredit.jayPoints} computerPoints={predictionCredit.computerPoints} />
              <article className="studio-result-item">
                <div className="studio-result-head">
                  <span className="studio-comp-badge league">Jay</span>
                  <strong>{predictionCredit.jayPoints} pts</strong>
                </div>
                <div className="studio-result-meta">
                  <span>{predictionCredit.jayCorrect}/{predictionCredit.resolved} correct</span>
                  <span>5 points per correct result</span>
                </div>
              </article>
              <article className="studio-result-item">
                <div className="studio-result-head">
                  <span className="studio-comp-badge league">Computer</span>
                  <strong>{predictionCredit.computerPoints} pts</strong>
                </div>
                <div className="studio-result-meta">
                  <span>{predictionCredit.computerCorrect}/{predictionCredit.resolved} correct</span>
                  <span>Team-earned prediction return</span>
                </div>
              </article>
              <h4>Last Season</h4>
              {lastSeasonSummary ? (
                <article className="studio-result-item">
                  <div className="studio-result-head">
                  <span className="studio-comp-badge cup">{formatSeasonBadge(lastSeasonSummary.season)}</span>
                    <strong>{lastSeasonSummary.division}</strong>
                    <span className="studio-rivalry-flag">#{lastSeasonSummary.rank}</span>
                  </div>
                  <div className="studio-result-meta">
                    <span>{lastSeasonSummary.points} pts</span>
                    <span>{formatSigned(lastSeasonSummary.profit)}</span>
                    <span>{lastSeasonSummary.cupFinish}</span>
                  </div>
                </article>
              ) : (
                <p className="studio-muted">No prior season record yet.</p>
              )}
            </div>
          </div>
        </div>
      ),
    });

    slides.push({
      id: `${prefix}-legacy-story`,
      label: `${team.name} • Legacy Story`,
      durationMs: 12000,
      narration: legacyNarration,
      tone: 'team',
      content: (
        <div className="studio-team-split">
          <div className="studio-team-head">
            <span className="studio-kicker">Card 3 • Legacy Story</span>
            <h3>{team.name}</h3>
            <p>Previous seasons and cup journeys that shaped this team.</p>
          </div>
          <div className="studio-team-three-col split">
            <div className="studio-recent-board studio-scroll-panel">
              <h4>Previous Seasons</h4>
              {previousSeasons.length > 0 ? (
                previousSeasons.map((season) => (
                  <article key={`${prefix}-season-${season.season}`} className="studio-result-item">
                    <div className="studio-result-head">
                      <span className="studio-comp-badge league">{formatSeasonBadge(season.season)}</span>
                      <strong>{season.division}</strong>
                      <span className="studio-rivalry-flag">#{season.rank}</span>
                    </div>
                    <div className="studio-result-meta">
                      <span className="studio-data-chip">{season.points} pts</span>
                      <span className="studio-data-chip">{formatSigned(season.profit)}</span>
                      <span className="studio-data-chip">{season.spins} spins</span>
                    </div>
                    <div className="studio-season-rank-meter">
                      <span>Rank Strength</span>
                      <div className="studio-season-rank-track">
                        <motion.span
                          className="studio-season-rank-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(10, 100 - (season.rank - 1) * 12)}%` }}
                          transition={{ duration: 0.85, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="studio-muted">No previous season history yet.</p>
              )}
            </div>
            <div className="studio-upcoming-board studio-scroll-panel">
              <h4>Previous Cup Runs</h4>
              {previousCupRuns.length > 0 ? (
                previousCupRuns.map((cupRun) => (
                  <article key={`${prefix}-cup-${cupRun.season}`} className="studio-result-item">
                    <div className="studio-result-head">
                      <span className="studio-comp-badge cup">{formatSeasonBadge(cupRun.season)}</span>
                      <strong>{cupRun.cupFinish}</strong>
                    </div>
                    <div className="studio-cup-timeline">
                      <span className="studio-cup-dot" aria-hidden="true" />
                      <span>{cupRun.cupFinish}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="studio-muted">No cup archive data yet.</p>
              )}
            </div>
          </div>
        </div>
      ),
    });

    slides.push({
      id: `${prefix}-season-journey`,
      label: `${team.name} • This Season`,
      durationMs: 12000,
      narration: seasonJourneyNarration,
      tone: 'team',
      content: (
        <div className="studio-team-split">
          <div className="studio-team-head">
            <span className="studio-kicker">Card 4 • This Season</span>
            <h3>{team.name}</h3>
            <p>Complete league and cup journey across this season.</p>
          </div>
          <div className="studio-team-three-col split">
            <div className="studio-recent-board studio-scroll-panel">
              <h4>League Journey</h4>
              {currentLeagueJourney.length > 0 ? (
                currentLeagueJourney.map((fixture) => (
                  <article
                    key={`${prefix}-league-${fixture.gw}-${fixture.opponent}-${fixture.venue}`}
                    className={`studio-result-item outcome-${journeyResultClass(fixture.result)}`}
                  >
                    <div className="studio-result-head">
                      <span className="studio-comp-badge league">{fixture.gw}</span>
                      <strong>{fixture.venue === 'H' ? 'vs' : '@'} {fixture.opponent}</strong>
                      <span className={`studio-inline-result ${journeyResultClass(fixture.result)}`}>{fixture.result}</span>
                    </div>
                    <div className="studio-result-meta">
                      <span className="studio-data-chip">{fixture.profit !== null ? formatSigned(fixture.profit) : 'Pending'}</span>
                      <span className="studio-data-chip">{fixture.spins !== null ? `${fixture.spins} spins` : '—'}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="studio-muted">No league fixtures logged yet.</p>
              )}
            </div>
            <div className="studio-upcoming-board studio-scroll-panel">
              <h4>Cup Journey</h4>
              {currentCupJourney.length > 0 ? (
                currentCupJourney.map((round) => (
                  <article key={`${prefix}-cup-${round.gw}-${round.round}`} className={`studio-result-item outcome-${journeyResultClass(round.result)}`}>
                    <div className="studio-result-head">
                      <span className="studio-comp-badge cup">{round.gw}</span>
                      <strong>{round.round}</strong>
                      <span className={`studio-inline-result ${journeyResultClass(round.result)}`}>{round.result}</span>
                    </div>
                    <div className="studio-result-meta">
                      <span>{round.opponent}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="studio-muted">No cup fixtures logged yet.</p>
              )}
            </div>
          </div>
        </div>
      ),
    });

    slides.push({
      id: `${prefix}-analytics-board`,
      label: `${team.name} • Analytics`,
      durationMs: 12000,
      narration: analyticsNarration,
      tone: 'team',
      content: (
        <div className={`studio-team-dense${team.rivalry ? ' rivalry-overlay' : ''}`}>
          <div className="studio-team-top">
            <div className="studio-team-identity">
              <TeamBadge
                name={team.name}
                ballColor={team.ballColor}
                ringColor={team.ringColor}
                textColor={team.textColor}
                size={34}
              />
              <div>
                <h3>{team.name}</h3>
                <div className="studio-team-meta-badges">
                  <span className="studio-division-pill">{team.league}</span>
                  <span className="studio-streak-pill">{team.streak}</span>
                  {team.rivalry && <span className="studio-rivalry-pill-gold">Rivalry Week</span>}
                </div>
              </div>
            </div>
            <div className={`studio-rank-chip ${rankShiftClass}`}>
              <strong>{team.rank ?? '-'}</strong>
              <span>{rankShift > 0 ? '↑' : rankShift < 0 ? '↓' : '→'} {rankShiftLabel}</span>
            </div>
          </div>

          <div className="studio-form-cluster-wrap">
            <div className="studio-form-cluster">
              <span>League Form</span>
              <FormBadges values={team.leagueForm} />
            </div>
            <div className="studio-form-cluster">
              <span>Cup Form</span>
              <FormBadges values={team.cupForm} />
            </div>
          </div>

          <div className="studio-team-three-col">
            <div className="studio-metric-grid-dense">
              <div className="studio-metric-tile"><span>Points</span><AnimatedMetric value={team.points} className="studio-stat-value" /></div>
              <div className="studio-metric-tile"><span>Season Profit</span><AnimatedMetric value={team.seasonProfit} decimals={2} className="studio-stat-value" /></div>
              <div className="studio-metric-tile"><span>Total Spins</span><strong>{team.spins}</strong></div>
              <div className="studio-metric-tile"><span>Best GW</span><strong>{analytics.bestGw ?? '—'}</strong></div>
              <div className="studio-metric-tile"><span>Best GW Profit</span><strong>{formatSigned(analytics.bestGwProfit)}</strong></div>
              <div className="studio-metric-tile"><span>Worst GW Profit</span><strong>{formatSigned(analytics.worstGwProfit)}</strong></div>
              <div className="studio-metric-tile"><span>Avg GW Profit</span><strong>{formatSigned(analytics.avgGwProfit)}</strong></div>
              <div className="studio-metric-tile"><span>Spin Efficiency</span><strong>{formatSigned(analytics.spinEfficiency)}</strong></div>
              <div className="studio-metric-tile"><span>Cup Advances</span><strong>{analytics.cupAdvances}</strong></div>
            </div>
            <div className="studio-profit-bars">
              <ProfitGlowBar label={`Best GW (${analytics.bestGw ?? '—'})`} value={analytics.bestGwProfit ?? 0} maxAbs={maxBarAbs} />
              <ProfitGlowBar label={`Worst GW (${analytics.worstGw ?? '—'})`} value={analytics.worstGwProfit ?? 0} maxAbs={maxBarAbs} />
              <ProfitGlowBar label="Current GW" value={team.currentGwProfit ?? 0} maxAbs={maxBarAbs} />
              <div className="studio-record-line">
                <span>Best Match</span>
                <strong>{analytics.bestMatchLabel ?? 'Awaiting best match data'}</strong>
              </div>
            </div>
          </div>
        </div>
      ),
    });

    slides.push({
      id: `${prefix}-projection-story`,
      label: `${team.name} • Projection`,
      durationMs: 12000,
      narration: projectionNarration,
      tone: 'team',
      content: (
        <div className="studio-projection-shell">
          <div className="studio-team-head">
            <span className="studio-kicker">Card 6 • Projection</span>
            <h3>{team.name}</h3>
            <p>Projected finish and how the season trend is moving.</p>
          </div>
          <div className="studio-team-three-col projection">
            <div className="studio-projection-grid-dense">
              <div className="studio-metric-tile"><span>Pred Finish</span><strong>{team.predictedFinish}</strong></div>
              <div className="studio-metric-tile"><span>Pred Points</span><strong>{team.predictedPoints}</strong></div>
              <div className="studio-metric-tile"><span>Current Rank</span><strong>{team.rank ?? '-'}</strong></div>
              <div className="studio-metric-tile"><span>Zone</span><strong>{team.zoneLabel}</strong></div>
              <div className="studio-metric-tile"><span>Movement</span><strong>{team.divisionMovement}</strong></div>
              <div className="studio-metric-tile"><span>Next League</span><strong>{team.nextLeagueFixture}</strong></div>
              <div className="studio-metric-tile"><span>Next Cup</span><strong>{team.nextCupFixture}</strong></div>
            </div>
            <div className="studio-story-cluster">
              <div className="studio-story-head">
                <span className="studio-zone-chip">{team.zoneLabel}</span>
                <span className={`studio-movement-chip ${rankShiftClass}`}>{rankShift > 0 ? '↑' : rankShift < 0 ? '↓' : '→'} {rankShiftLabel}</span>
              </div>
              <div className="studio-confidence-meter">
                <div className="studio-confidence-head">
                  <span>Projection Confidence</span>
                  <strong>{projectionConfidence}%</strong>
                </div>
                <div className="studio-confidence-track">
                  <motion.span
                    className="studio-confidence-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${projectionConfidence}%` }}
                    transition={{ duration: 0.95, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <StoryGraph points={team.seasonStory} />
            </div>
          </div>
        </div>
      ),
    });

    if (previousSeasons.length > 8 || currentLeagueJourney.length > 8 || currentCupJourney.length > 6) {
      slides.push({
        id: `${prefix}-extended-archive`,
        label: `${team.name} • Extended Archive`,
        durationMs: 12000,
        narration: `${pickBySeed(`${prefix}-voice-extended`, [
          `${team.name} extended archive summary.`,
          `Deep dataset note for ${team.name}.`,
          `${team.name} long-run archive check.`,
        ])} Extended archive context is loaded across seasons, league fixtures, and cup fixtures.`,
        tone: 'team',
        content: (
          <div className="studio-team-slide">
            <div className="studio-team-head">
              <span className="studio-kicker">Extended Data</span>
              <h3>{team.name}</h3>
              <p>Additional archive context due to larger dataset.</p>
            </div>
            <div className="studio-stat-grid">
              <div className="studio-stat">
                <span>Seasons Logged</span>
                <strong>{previousSeasons.length}</strong>
              </div>
              <div className="studio-stat">
                <span>Cup Entries</span>
                <strong>{previousCupRuns.length}</strong>
              </div>
              <div className="studio-stat">
                <span>League Fixtures</span>
                <strong>{currentLeagueJourney.length}</strong>
              </div>
              <div className="studio-stat">
                <span>Cup Fixtures</span>
                <strong>{currentCupJourney.length}</strong>
              </div>
              <div className="studio-stat">
                <span>Total League Profit</span>
                <strong>{formatSigned(analytics.totalLeagueProfit)}</strong>
              </div>
              <div className="studio-stat">
                <span>Total League Spins</span>
                <strong>{analytics.totalLeagueSpins}</strong>
              </div>
            </div>
          </div>
        ),
      });
    }
  });

  return slides;
}
