import cors from 'cors';
import express from 'express';
import {
  advanceGameweek,
  drawRandomTeam,
  ensureCupProgress,
  ensureCpuPredictions,
  getPredictionScoreboard,
  getSeasonGameweekProfitTotals,
  getPredictions,
  getMasterLeagueFixtures,
  getMasterLeagueMovement,
  getMasterLeagueTable,
  getHeadToHead,
  getSeasonAchievements,
  getSnapshots,
  isGameweekLocked,
  isPredictionsLocked,
  getCupDrawStarted,
  getCupDebug,
  getCupRoundStatus,
  getCupTieFixtures,
  getCupBracket,
  getAllTimeLeagues,
  getLeagueFixtures,
  getLeagueTable,
  getSnapshotPayloadById,
  getSnapshotPayloadForGw,
  getTeamSeasonHistory,
  getTeamRatings,
  getEntryAuditLog,
  getEntries,
  getBookieDorSnapshot,
  getLastCompletedGameweek,
  getTeamTrendCache,
  getPendingSeasonFinale,
  getState,
  getTeamStats,
  getTeams,
  getTrophyRoom,
  loadLeagueFixturesForSeason,
  loadMasterLeagueFixturesForRange,
  lockGameweekWithSnapshot,
  refreshSnapshotsForSeason,
  markCupDrawStarted,
  openDatabase,
  saveEntries,
  savePredictions,
  updateEntry,
  setPredictionsLocked,
  setCupFixtureWinner,
  setCupTieBreakMode,
  startCupDraw,
  resetCupFromRound,
  restoreSnapshotById,
  setGameweekLock,
  setGameweek,
  undoLastEntryBatch,
} from '../db/database.js';
import { DIVISION_ORDER, GAMEWEEKS } from '../shared/constants.js';
import { STUDIO_DESK_MASTER_PROMPT } from '../shared/studioDeskPrompt.js';
import type { EntryInput } from '../shared/types.js';

type StorylineTone = 'positive' | 'warning' | 'neutral';

type ReportStoryline = {
  id: string;
  headline: string;
  detail: string;
  tone: StorylineTone;
  metric?: string;
};

type RivalryDeskItem = {
  id: string;
  matchup: string;
  record: string;
  edge: string;
  avgMargin: string;
  nextMeeting: string;
  narrative: string;
};

function gwOrderValue(gw: string): number {
  const value = Number(gw.replace('GW', ''));
  return Number.isFinite(value) ? value : 99;
}

function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function hashValue(input: string): number {
  let hash = 0;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash * 31 + input.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

function pickDeterministic<T>(values: T[], seed: string): T {
  return values[hashValue(seed) % values.length];
}

function buildStorylineReport(db: ReturnType<typeof openDatabase>, season: `S${number}`, gw: string): {
  season: `S${number}`;
  gw: string;
  storylines: ReportStoryline[];
  tickerItems: string[];
  summary: {
    fixtures: number;
    resolved: number;
    cupFixtures: number;
    cupResolved: number;
  };
} {
  const leagueFixtures = getLeagueFixtures(db, season, gw);
  const cupFixtures = getCupBracket(db, season, gw).filter((fixture) => fixture.gw === gw);
  const entries = getEntries(db, season, { gw, limit: 1000 });
  const table = getLeagueTable(db, season, gw);
  const scoreboards = getPredictionScoreboard(db, season);

  const resolvedFixtures = leagueFixtures.filter((fixture) => fixture.result !== 'pending');
  const rankingByTeam = new Map<string, number>();
  Object.values(table).forEach((rows) => {
    rows.forEach((row) => rankingByTeam.set(row.teamName, row.rank));
  });

  const profitsByTeam = new Map<string, number>();
  entries.forEach((entry) => {
    profitsByTeam.set(entry.teamName, (profitsByTeam.get(entry.teamName) ?? 0) + entry.profit);
  });
  const topProfit = Array.from(profitsByTeam.entries())
    .map(([teamName, profit]) => ({ teamName, profit: Number(profit.toFixed(2)) }))
    .sort((a, b) => b.profit - a.profit || a.teamName.localeCompare(b.teamName))[0] ?? null;

  const biggestSwing = resolvedFixtures
    .map((fixture) => ({
      fixture,
      margin: Math.abs(fixture.homeProfit - fixture.awayProfit),
    }))
    .sort((a, b) => b.margin - a.margin)[0] ?? null;

  const upset = resolvedFixtures
    .map((fixture) => {
      if (fixture.result === 'draw') {
        return null;
      }
      const winner = fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam;
      const loser = fixture.result === 'home' ? fixture.awayTeam : fixture.homeTeam;
      const winnerRank = rankingByTeam.get(winner);
      const loserRank = rankingByTeam.get(loser);
      if (!winnerRank || !loserRank || winnerRank <= loserRank) {
        return null;
      }
      const rankGap = winnerRank - loserRank;
      const margin = Math.abs(fixture.homeProfit - fixture.awayProfit);
      return {
        fixture,
        winner,
        loser,
        rankGap,
        margin,
        score: rankGap * 100 + margin,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.score - a.score)[0] ?? null;

  const divisionLeaderLine = DIVISION_ORDER
    .map((division) => table[division]?.[0])
    .filter((row): row is NonNullable<typeof row> => !!row)
    .slice(0, 3)
    .map((row) => `${row.teamName} (${row.points} pts)`)
    .join(' • ');

  const relegationPressure = DIVISION_ORDER
    .map((division) => {
      const rows = table[division] ?? [];
      if (rows.length < 2) {
        return null;
      }
      const bottom = rows[rows.length - 1];
      const safe = rows[rows.length - 2];
      return {
        division,
        bottom: bottom.teamName,
        safe: safe.teamName,
        gap: safe.points - bottom.points,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.gap - b.gap)[0] ?? null;

  const predictionLeader = scoreboards.totals
    .slice()
    .sort((a, b) => b.points - a.points || b.correct - a.correct || a.picker.localeCompare(b.picker))[0] ?? null;

  const cupResolved = cupFixtures.filter((fixture) => fixture.winnerTeam !== null).length;
  const storylines: ReportStoryline[] = [];
  const seed = `${season}:${gw}`;

  storylines.push({
    id: 'gw-progress',
    tone: 'neutral',
    headline: pickDeterministic(
      [
        `${gw} scoreboard taking shape`,
        `${gw} update from across the divisions`,
        `${gw} live round-up`,
      ],
      `${seed}:progress`,
    ),
    detail: `${resolvedFixtures.length}/${leagueFixtures.length} league fixtures resolved, ${cupResolved}/${cupFixtures.length} cup ties resolved.`,
    metric: `${resolvedFixtures.length}/${leagueFixtures.length}`,
  });

  if (topProfit) {
    storylines.push({
      id: 'top-profit',
      tone: topProfit.profit >= 0 ? 'positive' : 'warning',
      headline: `${topProfit.teamName} lead the GW profit chart`,
      detail: `${topProfit.teamName} currently sit on ${formatSigned(topProfit.profit)} this gameweek.`,
      metric: formatSigned(topProfit.profit),
    });
  }

  if (biggestSwing) {
    const winner =
      biggestSwing.fixture.result === 'draw'
        ? 'Draw'
        : biggestSwing.fixture.result === 'home'
          ? biggestSwing.fixture.homeTeam
          : biggestSwing.fixture.awayTeam;
    storylines.push({
      id: 'biggest-swing',
      tone: 'positive',
      headline: pickDeterministic(
        [
          `Biggest swing: ${winner}`,
          `${winner} delivered the widest margin`,
          `${winner} posted the standout result`,
        ],
        `${seed}:swing`,
      ),
      detail: `${biggestSwing.fixture.homeTeam} ${biggestSwing.fixture.homeProfit.toFixed(2)} - ${biggestSwing.fixture.awayProfit.toFixed(2)} ${biggestSwing.fixture.awayTeam} (${displayDivision(biggestSwing.fixture.division)}).`,
      metric: biggestSwing.margin.toFixed(2),
    });
  }

  if (upset) {
    storylines.push({
      id: 'upset-watch',
      tone: 'warning',
      headline: `${upset.winner} stunned ${upset.loser}`,
      detail: `Rank gap ${upset.rankGap} in ${displayDivision(upset.fixture.division)} with a ${upset.margin.toFixed(2)} profit margin.`,
      metric: `${upset.rankGap} ranks`,
    });
  }

  if (divisionLeaderLine.length > 0) {
    storylines.push({
      id: 'leaders',
      tone: 'positive',
      headline: 'Division leaders snapshot',
      detail: divisionLeaderLine,
    });
  }

  if (relegationPressure) {
    storylines.push({
      id: 'pressure',
      tone: relegationPressure.gap <= 1 ? 'warning' : 'neutral',
      headline: `Pressure zone in ${displayDivision(relegationPressure.division)}`,
      detail: `${relegationPressure.bottom} trail ${relegationPressure.safe} by ${relegationPressure.gap} pts near the drop line.`,
      metric: `${relegationPressure.gap} pts`,
    });
  }

  if (predictionLeader) {
    storylines.push({
      id: 'predictions',
      tone: 'neutral',
      headline: `${predictionLeader.picker} lead prediction race`,
      detail: `${predictionLeader.points} pts • ${predictionLeader.correct}/${predictionLeader.total} correct picks.`,
      metric: `${predictionLeader.points} pts`,
    });
  }

  const tickerItems = storylines
    .slice(0, 8)
    .map((line) => `${line.headline} • ${line.detail}`);

  return {
    season,
    gw,
    storylines,
    tickerItems,
    summary: {
      fixtures: leagueFixtures.length,
      resolved: resolvedFixtures.length,
      cupFixtures: cupFixtures.length,
      cupResolved,
    },
  };
}

function displayDivision(division: string): string {
  return division
    .replace('Bookies', '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRivalryDesk(
  db: ReturnType<typeof openDatabase>,
  season: `S${number}`,
  upToGw: string,
): RivalryDeskItem[] {
  const allFixtures = getLeagueFixtures(db, season).filter((fixture) => gwOrderValue(fixture.gw) <= gwOrderValue(upToGw));
  const ratingByTeam = new Map(getTeamRatings(db).map((row) => [row.teamName, row.rating]));
  const byPair = new Map<string, {
    teamA: string;
    teamB: string;
    aWins: number;
    bWins: number;
    draws: number;
    marginSum: number;
    played: number;
    nextMeetingGw: string | null;
  }>();

  allFixtures.forEach((fixture) => {
    const ordered = [fixture.homeTeam, fixture.awayTeam].sort((a, b) => a.localeCompare(b));
    const key = `${ordered[0]}::${ordered[1]}`;
    const entry = byPair.get(key) ?? {
      teamA: ordered[0],
      teamB: ordered[1],
      aWins: 0,
      bWins: 0,
      draws: 0,
      marginSum: 0,
      played: 0,
      nextMeetingGw: null,
    };
    if (fixture.result === 'pending') {
      if (!entry.nextMeetingGw || gwOrderValue(fixture.gw) < gwOrderValue(entry.nextMeetingGw)) {
        entry.nextMeetingGw = fixture.gw;
      }
      byPair.set(key, entry);
      return;
    }
    entry.played += 1;
    entry.marginSum += Math.abs(fixture.homeProfit - fixture.awayProfit);
    if (fixture.result === 'draw') {
      entry.draws += 1;
    } else {
      const winner = fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam;
      if (winner === entry.teamA) {
        entry.aWins += 1;
      } else {
        entry.bWins += 1;
      }
    }
    byPair.set(key, entry);
  });

  return Array.from(byPair.entries())
    .map(([key, row]) => {
      const ratingGap = Math.abs((ratingByTeam.get(row.teamA) ?? 0) - (ratingByTeam.get(row.teamB) ?? 0));
      const avgMargin = row.played > 0 ? row.marginSum / row.played : 0;
      const closeness = row.played * 4 - Math.abs(row.aWins - row.bWins) * 2 - ratingGap;
      const edge =
        row.aWins === row.bWins
          ? 'Even'
          : row.aWins > row.bWins
            ? `${row.teamA} +${row.aWins - row.bWins}`
            : `${row.teamB} +${row.bWins - row.aWins}`;
      return {
        id: key,
        matchup: `${row.teamA} vs ${row.teamB}`,
        record: `${row.aWins}-${row.draws}-${row.bWins}`,
        edge,
        avgMargin: avgMargin.toFixed(2),
        nextMeeting: row.nextMeetingGw ?? 'TBD',
        narrative:
          row.played === 0
            ? 'No completed meetings yet.'
            : row.draws > 0
              ? 'Tight rivalry with frequent momentum swings.'
              : 'Results have been decisive so far.',
        closeness,
      };
    })
    .filter((row) => row.record !== '0-0-0' || row.nextMeeting !== 'TBD')
    .sort((a, b) => b.closeness - a.closeness || a.matchup.localeCompare(b.matchup))
    .slice(0, 8)
    .map(({ closeness: _closeness, ...item }) => item);
}

function buildSnapshotCompare(
  db: ReturnType<typeof openDatabase>,
  season: `S${number}`,
  fromGw: string,
  toGw: string,
): {
  season: `S${number}`;
  fromGw: string;
  toGw: string;
  divisions: Array<{
    division: string;
    topRise: { teamName: string; delta: number } | null;
    topDrop: { teamName: string; delta: number } | null;
    movers: Array<{ teamName: string; delta: number; currentRank: number }>;
  }>;
} {
  const baselineTable = getLeagueTable(db, season, fromGw);
  const currentTable = getLeagueTable(db, season, toGw);

  const divisions = DIVISION_ORDER.map((division) => {
    const baseline = baselineTable[division] ?? [];
    const current = currentTable[division] ?? [];
    const baselineRank = new Map(baseline.map((row) => [row.teamId, row.rank]));
    const movers = current
      .map((row) => ({
        teamName: row.teamName,
        delta: (baselineRank.get(row.teamId) ?? row.rank) - row.rank,
        currentRank: row.rank,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.currentRank - b.currentRank);
    const topRise = movers.filter((row) => row.delta > 0)[0] ?? null;
    const topDrop = movers.filter((row) => row.delta < 0)[0] ?? null;
    return {
      division,
      topRise,
      topDrop,
      movers: movers.filter((row) => row.delta !== 0).slice(0, 5),
    };
  });

  return {
    season,
    fromGw,
    toGw,
    divisions,
  };
}

function buildReportPack(db: ReturnType<typeof openDatabase>, season: `S${number}`, gw: string) {
  const story = buildStorylineReport(db, season, gw);
  const rivalryDesk = buildRivalryDesk(db, season, gw);
  const achievements = getSeasonAchievements(db, season);
  const snapshots = getSnapshots(db, season).slice(0, 10);
  const scoreboard = getPredictionScoreboard(db, season);
  const seasonProfit = getSeasonGameweekProfitTotals(db);
  const currentIdx = GAMEWEEKS.indexOf(gw as (typeof GAMEWEEKS)[number]);
  const fromGw = currentIdx > 0 ? GAMEWEEKS[currentIdx - 1] : gw;
  const compare = buildSnapshotCompare(db, season, fromGw, gw);

  const presenterNotes = [
    ...story.storylines.slice(0, 4).map((line) => `${line.headline}: ${line.detail}`),
    ...rivalryDesk.slice(0, 2).map((item) => `${item.matchup} (${item.record}) • ${item.edge}`),
  ];
  const textBlocks = [
    `Bookieball Report Pack • ${season} ${gw}`,
    '',
    'Top Storylines:',
    ...story.storylines.slice(0, 6).map((line, idx) => `${idx + 1}. ${line.headline} — ${line.detail}`),
    '',
    'Rivalry Desk:',
    ...rivalryDesk.slice(0, 6).map((item, idx) => `${idx + 1}. ${item.matchup} (${item.record}) • ${item.edge} • Next ${item.nextMeeting}`),
    '',
    'Presenter Notes:',
    ...presenterNotes.map((line, idx) => `${idx + 1}. ${line}`),
  ];

  return {
    generatedAt: new Date().toISOString(),
    season,
    gw,
    story,
    rivalryDesk,
    achievements,
    snapshots,
    snapshotCompare: compare,
    predictionScoreboard: scoreboard,
    seasonProfitComparison: seasonProfit,
    presenterNotes,
    reportText: textBlocks.join('\n'),
  };
}

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/studio/prompt', (_req, res) => {
    res.json({ prompt: STUDIO_DESK_MASTER_PROMPT });
  });

  app.get('/api/state', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const cupDrawStarted = getCupDrawStarted(db, state.currentSeason);
      const gwLocked = isGameweekLocked(db, state.currentSeason, state.currentGw);
      res.json({ ...state, cupDrawStarted, gwLocked });
    } finally {
      db.close();
    }
  });

  app.get('/api/last-completed-gw', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const lastCompleted = getLastCompletedGameweek(db, state.currentSeason, state.currentGw);
      res.json({
        currentSeason: state.currentSeason,
        currentGw: state.currentGw,
        lastCompleted,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/bookie-dor', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const seasonParam = typeof req.query.season === 'string' ? req.query.season : null;
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : null;
      const season = seasonParam && /^S\d+$/.test(seasonParam) ? (seasonParam as `S${number}`) : state.currentSeason;
      const gw = gwParam && GAMEWEEKS.includes(gwParam as (typeof GAMEWEEKS)[number]) ? gwParam : state.currentGw;
      const payload = getBookieDorSnapshot(db, season, gw);
      res.json(payload);
    } finally {
      db.close();
    }
  });

  app.get('/api/season-finale', (_req, res) => {
    const db = openDatabase();
    try {
      const pending = getPendingSeasonFinale(db);
      res.json(pending ?? { pending: false });
    } finally {
      db.close();
    }
  });

  app.get('/api/teams', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const teams = getTeams(db, state.currentSeason);
      const trendRows = getTeamTrendCache(db, state.currentSeason, state.currentGw);
      const trendByTeamId = new Map(trendRows.map((row) => [row.teamId, row]));
      res.json(teams.map((team) => ({
        ...team,
        trendCache: trendByTeamId.get(team.id) ?? null,
      })));
    } finally {
      db.close();
    }
  });

  app.get('/api/team-trends', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const gw = GAMEWEEKS.includes(gwParam as (typeof GAMEWEEKS)[number]) ? gwParam : state.currentGw;
      const trends = getTeamTrendCache(db, state.currentSeason, gw);
      res.json({
        season: state.currentSeason,
        gw,
        trends,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/league-table', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const table = getLeagueTable(db, state.currentSeason, state.currentGw);
      res.json(table);
    } finally {
      db.close();
    }
  });

  app.get('/api/league-movement', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const table = getLeagueTable(db, state.currentSeason, state.currentGw);
      const currentIdx = GAMEWEEKS.indexOf(state.currentGw as (typeof GAMEWEEKS)[number]);
      const prevGw = currentIdx > 0 ? GAMEWEEKS[currentIdx - 1] : null;
      const snapshot = prevGw ? getSnapshotPayloadForGw(db, state.currentSeason, prevGw) : null;
      const baseline = snapshot?.payload?.table as Record<string, Array<{ teamId: number; rank: number }>> | undefined;
      const movement: Record<string, Record<number, number>> = {};

      Object.entries(table).forEach(([division, rows]) => {
        const baselineRows = baseline?.[division] ?? [];
        const baseMap = new Map(baselineRows.map((row) => [row.teamId, row.rank]));
        const deltaMap: Record<number, number> = {};
        rows.forEach((row) => {
          const prevRank = baseMap.get(row.teamId) ?? row.rank;
          deltaMap[row.teamId] = prevRank - row.rank;
        });
        movement[division] = deltaMap;
      });

      res.json({
        baselineGw: snapshot?.gw ?? null,
        baselineLabel: snapshot?.label ?? null,
        movement,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/league-fixtures', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const seasonParam = typeof req.query.season === 'string' ? req.query.season : null;
      const season = seasonParam && /^S\d+$/.test(seasonParam) ? (seasonParam as `S${number}`) : state.currentSeason;
      const includeAll = req.query.all === '1';
      const fixtures = includeAll ? getLeagueFixtures(db, season) : getLeagueFixtures(db, season, gwParam);
      res.json(fixtures);
    } finally {
      db.close();
    }
  });

  app.get('/api/master-league/table', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gw = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const table = getMasterLeagueTable(db, state.currentSeason, gw);
      const movement = getMasterLeagueMovement(db, state.currentSeason, gw);
      res.json({
        gw,
        table,
        baselineGw: movement.baselineGw,
        movement: movement.movement,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/master-league/fixtures', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const includeAll = req.query.all === '1';
      loadMasterLeagueFixturesForRange(db, state.currentSeason, 'GW1', gwParam);
      const fixtures = includeAll
        ? getMasterLeagueFixtures(db, state.currentSeason)
        : getMasterLeagueFixtures(db, state.currentSeason, gwParam);
      res.json(fixtures);
    } finally {
      db.close();
    }
  });

  app.get('/api/all-time-leagues', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const leagues = getAllTimeLeagues(db, state.currentSeason, state.currentGw);
      res.json(leagues);
    } finally {
      db.close();
    }
  });

  app.get('/api/season-profit-comparison', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const totals = getSeasonGameweekProfitTotals(db);
      res.json({ currentSeason: state.currentSeason, ...totals });
    } finally {
      db.close();
    }
  });

  app.get('/api/report/storylines', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const gw = GAMEWEEKS.includes(gwParam as (typeof GAMEWEEKS)[number]) ? gwParam : state.currentGw;
      const payload = buildStorylineReport(db, state.currentSeason, gw);
      res.json({
        generatedAt: new Date().toISOString(),
        ...payload,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/report/rivalry-desk', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const gw = GAMEWEEKS.includes(gwParam as (typeof GAMEWEEKS)[number]) ? gwParam : state.currentGw;
      const rivalries = buildRivalryDesk(db, state.currentSeason, gw);
      res.json({
        generatedAt: new Date().toISOString(),
        season: state.currentSeason,
        gw,
        rivalries,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/report/snapshot-compare', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const toParam = typeof req.query.toGw === 'string' ? req.query.toGw : state.currentGw;
      const toGw = GAMEWEEKS.includes(toParam as (typeof GAMEWEEKS)[number]) ? toParam : state.currentGw;
      const fromParam = typeof req.query.fromGw === 'string' ? req.query.fromGw : null;
      const toIdx = GAMEWEEKS.indexOf(toGw as (typeof GAMEWEEKS)[number]);
      const defaultFrom = toIdx > 0 ? GAMEWEEKS[toIdx - 1] : toGw;
      const fromGw = fromParam && GAMEWEEKS.includes(fromParam as (typeof GAMEWEEKS)[number]) ? fromParam : defaultFrom;
      const payload = buildSnapshotCompare(db, state.currentSeason, fromGw, toGw);
      const fromSnapshot = getSnapshotPayloadForGw(db, state.currentSeason, fromGw);
      const toSnapshot = getSnapshotPayloadForGw(db, state.currentSeason, toGw);
      res.json({
        generatedAt: new Date().toISOString(),
        ...payload,
        fromSnapshot: fromSnapshot ? { id: fromSnapshot.id, label: fromSnapshot.label, createdAt: fromSnapshot.createdAt } : null,
        toSnapshot: toSnapshot ? { id: toSnapshot.id, label: toSnapshot.label, createdAt: toSnapshot.createdAt } : null,
      });
    } finally {
      db.close();
    }
  });

  app.get('/api/report/pack', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const gw = GAMEWEEKS.includes(gwParam as (typeof GAMEWEEKS)[number]) ? gwParam : state.currentGw;
      const pack = buildReportPack(db, state.currentSeason, gw);
      res.json(pack);
    } finally {
      db.close();
    }
  });

  app.get('/api/cup', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const seasonParam = typeof req.query.season === 'string' ? req.query.season : null;
      const gwParam = typeof req.query.gw === 'string' ? req.query.gw : state.currentGw;
      const season = seasonParam && /^S\d+$/.test(seasonParam) ? (seasonParam as `S${number}`) : state.currentSeason;
      const gw = GAMEWEEKS.includes(gwParam as (typeof GAMEWEEKS)[number]) ? gwParam : state.currentGw;
      const cup = getCupBracket(db, season, gw);
      res.json(cup);
    } finally {
      db.close();
    }
  });

  app.get('/api/cup/status', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const status = getCupRoundStatus(db, state.currentSeason, state.currentGw);
      res.json(status);
    } finally {
      db.close();
    }
  });

  app.post('/api/cup/start-draw', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      if (state.currentGw !== 'GW1') {
        res.status(400).json({ error: 'Cup draw can only be started in GW1' });
        return;
      }
      startCupDraw(db, state.currentSeason);
      markCupDrawStarted(db, state.currentSeason);
      const cup = getCupBracket(db, state.currentSeason, state.currentGw);
      const gw2Fixtures = cup.filter((fixture) => fixture.gw === 'GW2');
      res.json({ ok: true, fixtures: gw2Fixtures });
    } finally {
      db.close();
    }
  });

  app.get('/api/team/:id/stats', (req, res) => {
    const teamId = Number(req.params.id);
    if (!Number.isFinite(teamId)) {
      res.status(400).json({ error: 'Invalid team id' });
      return;
    }

    const db = openDatabase();
    try {
      const state = getState(db);
      const stats = getTeamStats(db, teamId, state.currentSeason);
      res.json(stats);
    } finally {
      db.close();
    }
  });

  app.get('/api/team/:id/history', (req, res) => {
    const teamId = Number(req.params.id);
    if (!Number.isFinite(teamId)) {
      res.status(400).json({ error: 'Invalid team id' });
      return;
    }

    const db = openDatabase();
    try {
      const history = getTeamSeasonHistory(db, teamId);
      res.json({ seasons: history });
    } finally {
      db.close();
    }
  });

  app.post('/api/team/history-bulk', (req, res) => {
    const requestedIds: unknown[] | null = Array.isArray(req.body?.teamIds) ? (req.body.teamIds as unknown[]) : null;
    const db = openDatabase();
    try {
      const state = getState(db);
      const seasonTeams = getTeams(db, state.currentSeason).map((team) => team.id);
      const validSet = new Set(seasonTeams);
      const teamIds = requestedIds
        ? requestedIds
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isFinite(value) && validSet.has(value))
        : seasonTeams;
      const histories: Record<number, ReturnType<typeof getTeamSeasonHistory>> = {};
      teamIds.forEach((teamId: number) => {
        histories[teamId] = getTeamSeasonHistory(db, teamId);
      });
      res.json({ histories });
    } finally {
      db.close();
    }
  });

  app.get('/api/trophy-room', (_req, res) => {
    const db = openDatabase();
    try {
      const trophies = getTrophyRoom(db);
      res.json(trophies);
    } finally {
      db.close();
    }
  });

  app.get('/api/team-ratings', (_req, res) => {
    const db = openDatabase();
    try {
      const ratings = getTeamRatings(db);
      res.json(ratings);
    } finally {
      db.close();
    }
  });

  app.get('/api/achievements', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const achievements = getSeasonAchievements(db, state.currentSeason);
      res.json(achievements);
    } finally {
      db.close();
    }
  });

  app.get('/api/head-to-head', (req, res) => {
    const teamA = Number(req.query.teamA);
    const teamB = Number(req.query.teamB);
    if (!Number.isFinite(teamA) || !Number.isFinite(teamB)) {
      res.status(400).json({ error: 'teamA and teamB are required' });
      return;
    }
    const db = openDatabase();
    try {
      const state = getState(db);
      const h2h = getHeadToHead(db, state.currentSeason, teamA, teamB);
      res.json(h2h);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load head-to-head' });
    } finally {
      db.close();
    }
  });

  app.post('/api/gameshow/draw', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const draw = drawRandomTeam(db, state.currentSeason, state.currentGw);
      if (!draw) {
        res.status(409).json({ error: 'All teams already drawn for this gameweek' });
        return;
      }
      res.json(draw);
    } finally {
      db.close();
    }
  });

  app.get('/api/predictions', (req, res) => {
    const gwParam = typeof req.query.gw === 'string' ? req.query.gw : null;
    const seasonParam = typeof req.query.season === 'string' ? req.query.season : null;
    const db = openDatabase();
    try {
      const state = getState(db);
      const season = seasonParam && /^S\d+$/.test(seasonParam) ? (seasonParam as `S${number}`) : state.currentSeason;
      const gw = gwParam ?? state.currentGw;
      const predictions = getPredictions(db, season, gw);
      const locked = isPredictionsLocked(db, season, gw);
      res.json({ season, gw, locked, predictions });
    } finally {
      db.close();
    }
  });

  app.get('/api/predictions/scoreboard', (req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const seasonParam = typeof req.query.season === 'string' ? req.query.season : null;
      const season = seasonParam ?? state.currentSeason;
      const scoreboard = getPredictionScoreboard(db, season as typeof state.currentSeason);
      res.json(scoreboard);
    } finally {
      db.close();
    }
  });

  app.post('/api/predictions', (req, res) => {
    const { gw, competition, picks, picker } = req.body as {
      gw?: string;
      competition?: string;
      picks?: Array<{
        fixtureId: number;
        pickTeamId?: number | null;
        pickOutcome?: 'team' | 'draw';
        predictedHomeScore?: number | null;
        predictedAwayScore?: number | null;
      }>;
      picker?: string;
    };

    if (!gw || typeof gw !== 'string') {
      res.status(400).json({ error: 'gw is required' });
      return;
    }
    if (competition !== 'league' && competition !== 'cup') {
      res.status(400).json({ error: 'competition must be league or cup' });
      return;
    }
    if (!Array.isArray(picks)) {
      res.status(400).json({ error: 'picks must be an array' });
      return;
    }

    const db = openDatabase();
    try {
      const state = getState(db);
      const pickerName = typeof picker === 'string' && picker.length ? picker : 'Jay';
      const sanitized = picks
        .map((row) => {
          const pickOutcome: 'team' | 'draw' = row.pickOutcome === 'draw' ? 'draw' : 'team';
          const pickTeamId = row.pickTeamId === null || row.pickTeamId === undefined ? null : Number(row.pickTeamId);
          const predictedHomeScore = row.predictedHomeScore === null || row.predictedHomeScore === undefined ? null : Number(row.predictedHomeScore);
          const predictedAwayScore = row.predictedAwayScore === null || row.predictedAwayScore === undefined ? null : Number(row.predictedAwayScore);
          return {
            fixtureId: Number(row.fixtureId),
            pickTeamId: Number.isFinite(pickTeamId as number) ? (pickTeamId as number) : null,
            pickOutcome,
            predictedHomeScore: Number.isFinite(predictedHomeScore as number) ? (predictedHomeScore as number) : null,
            predictedAwayScore: Number.isFinite(predictedAwayScore as number) ? (predictedAwayScore as number) : null,
          };
        })
        .filter((row) => Number.isFinite(row.fixtureId) && (row.pickOutcome === 'draw' || Number.isFinite(row.pickTeamId as number)));
      const result = savePredictions(db, state.currentSeason, gw, pickerName, competition, sanitized);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save predictions' });
    } finally {
      db.close();
    }
  });

  app.post('/api/predictions/lock', (req, res) => {
    const { gw } = req.body as { gw?: string };
    const db = openDatabase();
    try {
      const state = getState(db);
      const targetGw = gw ?? state.currentGw;
      setPredictionsLocked(db, state.currentSeason, targetGw, true);
      const cpuAdded = ensureCpuPredictions(db, state.currentSeason, targetGw);
      res.json({ ok: true, locked: true, cpuAdded });
    } finally {
      db.close();
    }
  });

  app.post('/api/predictions/unlock', (req, res) => {
    const { gw } = req.body as { gw?: string };
    const db = openDatabase();
    try {
      const state = getState(db);
      const targetGw = gw ?? state.currentGw;
      setPredictionsLocked(db, state.currentSeason, targetGw, false);
      res.json({ ok: true, locked: false });
    } finally {
      db.close();
    }
  });

  app.get('/api/entries', (req, res) => {
    const gw = typeof req.query.gw === 'string' ? req.query.gw : undefined;
    const entryType = typeof req.query.type === 'string' ? req.query.type : undefined;
    const teamId = typeof req.query.teamId === 'string' ? Number(req.query.teamId) : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined;

    if (teamId !== undefined && !Number.isFinite(teamId)) {
      res.status(400).json({ error: 'Invalid teamId' });
      return;
    }
    if (limit !== undefined && !Number.isFinite(limit)) {
      res.status(400).json({ error: 'Invalid limit' });
      return;
    }
    if (offset !== undefined && !Number.isFinite(offset)) {
      res.status(400).json({ error: 'Invalid offset' });
      return;
    }

    const db = openDatabase();
    try {
      const state = getState(db);
      const entries = getEntries(db, state.currentSeason, {
        gw,
        teamId: teamId && teamId > 0 ? teamId : undefined,
        entryType: entryType === 'free_spins' || entryType === 'bonus' ? entryType : undefined,
        limit,
        offset,
      });
      res.json(entries);
    } finally {
      db.close();
    }
  });

  app.post('/api/entries', (req, res) => {
    const { entries } = req.body as { entries?: unknown };
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries must be a non-empty array' });
      return;
    }

    const db = openDatabase();
    try {
      const state = getState(db);
      saveEntries(db, state, entries as EntryInput[]);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save entries' });
    } finally {
      db.close();
    }
  });

  app.patch('/api/entries/:id', (req, res) => {
    const entryId = Number(req.params.id);
    if (!Number.isFinite(entryId)) {
      res.status(400).json({ error: 'Invalid entry id' });
      return;
    }

    const { entryType, profit, spins, stake, notes, noWin, actor } = req.body as {
      entryType?: unknown;
      profit?: unknown;
      spins?: unknown;
      stake?: unknown;
      notes?: unknown;
      noWin?: unknown;
      actor?: unknown;
    };

    if (entryType !== 'free_spins' && entryType !== 'bonus') {
      res.status(400).json({ error: 'entryType must be free_spins or bonus' });
      return;
    }
    if (!Number.isFinite(Number(profit))) {
      res.status(400).json({ error: 'profit must be a number' });
      return;
    }
    if (spins !== undefined && spins !== null && !Number.isFinite(Number(spins))) {
      res.status(400).json({ error: 'spins must be a number' });
      return;
    }
    if (stake !== undefined && stake !== null && !Number.isFinite(Number(stake))) {
      res.status(400).json({ error: 'stake must be a number' });
      return;
    }
    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      res.status(400).json({ error: 'notes must be a string' });
      return;
    }

    const db = openDatabase();
    try {
      const state = getState(db);
      updateEntry(db, state, entryId, {
        entryType,
        profit: Number(profit),
        spins: spins === undefined ? undefined : spins === null ? null : Number(spins),
        stake: stake === undefined ? undefined : stake === null ? null : Number(stake),
        notes: notes === undefined ? undefined : notes === null ? null : notes,
        noWin: Boolean(noWin),
      }, typeof actor === 'string' ? actor : 'admin');
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update entry' });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/undo-last-entries', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const result = undoLastEntryBatch(db, state);
      res.json({ ok: true, result });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to undo entries' });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/advance-gw', (_req, res) => {
    const db = openDatabase();
    try {
      const state = advanceGameweek(db);
      res.json(state);
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/load-league-fixtures', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const created = loadLeagueFixturesForSeason(db, state.currentSeason);
      res.json({ ok: true, message: 'League fixtures loaded', created });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/master-league/generate-upcoming', (req, res) => {
    const { fromGw, toGw } = req.body as { fromGw?: string; toGw?: string };
    const db = openDatabase();
    try {
      const state = getState(db);
      const currentIdx = GAMEWEEKS.indexOf(state.currentGw as (typeof GAMEWEEKS)[number]);
      const defaultFrom = currentIdx >= 0 && currentIdx < GAMEWEEKS.length - 1
        ? GAMEWEEKS[currentIdx + 1]
        : GAMEWEEKS[GAMEWEEKS.length - 1];
      const targetFrom = fromGw ?? defaultFrom;
      const targetTo = toGw ?? 'GW8';

      if (!GAMEWEEKS.includes(targetFrom as (typeof GAMEWEEKS)[number]) || !GAMEWEEKS.includes(targetTo as (typeof GAMEWEEKS)[number])) {
        res.status(400).json({ error: 'Invalid fromGw or toGw' });
        return;
      }

      const fromIdx = GAMEWEEKS.indexOf(targetFrom as (typeof GAMEWEEKS)[number]);
      const toIdx = GAMEWEEKS.indexOf(targetTo as (typeof GAMEWEEKS)[number]);
      if (fromIdx > toIdx) {
        res.json({ ok: true, created: 0, fromGw: targetFrom, toGw: targetTo });
        return;
      }

      const created = loadMasterLeagueFixturesForRange(db, state.currentSeason, targetFrom, targetTo);
      res.json({ ok: true, created, fromGw: targetFrom, toGw: targetTo });
    } finally {
      db.close();
    }
  });

  app.get('/api/admin/snapshots', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const snapshots = getSnapshots(db, state.currentSeason);
      res.json(snapshots);
    } finally {
      db.close();
    }
  });

  app.get('/api/admin/snapshot', (req, res) => {
    const idParam = typeof req.query.id === 'string' ? Number(req.query.id) : null;
    const gwParam = typeof req.query.gw === 'string' ? req.query.gw : null;
    if (idParam !== null && !Number.isFinite(idParam)) {
      res.status(400).json({ error: 'Invalid snapshot id' });
      return;
    }

    const db = openDatabase();
    try {
      const state = getState(db);
      const payload = idParam
        ? getSnapshotPayloadById(db, idParam)
        : gwParam
          ? getSnapshotPayloadForGw(db, state.currentSeason, gwParam)
          : null;
      if (!payload) {
        res.status(404).json({ error: 'Snapshot not found' });
        return;
      }
      res.json(payload);
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/restore-snapshot', (req, res) => {
    const { id } = req.body as { id?: number };
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Snapshot id is required.' });
      return;
    }
    const db = openDatabase();
    try {
      const restored = restoreSnapshotById(db, Number(id));
      const state = getState(db);
      res.json({
        ok: true,
        restored,
        state,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to restore snapshot.' });
    } finally {
      db.close();
    }
  });

  app.get('/api/admin/entry-audit', (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
    if (!Number.isFinite(limit)) {
      res.status(400).json({ error: 'Invalid limit' });
      return;
    }
    const db = openDatabase();
    try {
      const state = getState(db);
      const rows = getEntryAuditLog(db, state.currentSeason, limit);
      res.json(rows);
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/refresh-snapshots', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const result = refreshSnapshotsForSeason(db, state.currentSeason, state.currentGw);
      res.json({ ok: true, ...result });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/set-gw', (req, res) => {
    const { season, gw } = req.body as { season?: string; gw?: string };
    if (!season || !gw || !GAMEWEEKS.includes(gw as (typeof GAMEWEEKS)[number])) {
      res.status(400).json({ error: 'Invalid season or gw' });
      return;
    }

    const db = openDatabase();
    try {
      const state = setGameweek(db, season as `S${number}`, gw);
      res.json(state);
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/lock-gw', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      setGameweekLock(db, state.currentSeason, state.currentGw, true);
      res.json({ ok: true });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/lock-gw-safe', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      lockGameweekWithSnapshot(db, state);
      res.json({ ok: true });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/unlock-gw', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      setGameweekLock(db, state.currentSeason, state.currentGw, false);
      res.json({ ok: true });
    } finally {
      db.close();
    }
  });

  app.get('/api/admin/cup/debug', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const debug = getCupDebug(db, state.currentSeason, state.currentGw);
      res.json(debug);
    } finally {
      db.close();
    }
  });

  app.get('/api/admin/cup/ties', (_req, res) => {
    const db = openDatabase();
    try {
      const state = getState(db);
      const ties = getCupTieFixtures(db, state.currentSeason, state.currentGw);
      res.json(ties);
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/cup/tie-break-mode', (req, res) => {
    const { mode } = req.body as { mode?: string };
    if (mode !== 'random' && mode !== 'lower_team_id') {
      res.status(400).json({ error: 'Invalid tie-break mode' });
      return;
    }
    const db = openDatabase();
    try {
      setCupTieBreakMode(db, mode);
      const state = getState(db);
      const debug = getCupDebug(db, state.currentSeason, state.currentGw);
      res.json({ ok: true, mode: debug.tieBreakMode });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/cup/set-winner', (req, res) => {
    const { fixtureId, winnerTeamId } = req.body as { fixtureId?: number; winnerTeamId?: number | null };
    if (!Number.isFinite(fixtureId)) {
      res.status(400).json({ error: 'Invalid fixtureId' });
      return;
    }
    if (winnerTeamId !== null && winnerTeamId !== undefined && !Number.isFinite(winnerTeamId)) {
      res.status(400).json({ error: 'Invalid winnerTeamId' });
      return;
    }
    const db = openDatabase();
    try {
      const state = getState(db);
      setCupFixtureWinner(db, state.currentSeason, Number(fixtureId), winnerTeamId ?? null, 'admin_api');
      ensureCupProgress(db, state.currentSeason, state.currentGw);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to set winner' });
    } finally {
      db.close();
    }
  });

  app.post('/api/admin/cup/reset-round', (req, res) => {
    const { gw } = req.body as { gw?: string };
    if (!gw) {
      res.status(400).json({ error: 'gw is required' });
      return;
    }
    const db = openDatabase();
    try {
      const state = getState(db);
      resetCupFromRound(db, state.currentSeason, gw, 'admin_api');
      ensureCupProgress(db, state.currentSeason, state.currentGw);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to reset round' });
    } finally {
      db.close();
    }
  });

  return app;
}
