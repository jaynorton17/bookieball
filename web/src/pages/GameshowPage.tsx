import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';
import { pickPregamePreviewLines } from '../lib/pregamePreviewBank';
import { pickRecapReviewLines } from '../lib/recapReviewBank';
import { buildSeasonFinaleSlides } from '../lib/seasonFinaleSlides';
import type { FixtureSlideStatusCode, WeeklyFixtureStatusCode } from '../lib/statusCodes';
import { PredictionTrendChart } from '../components/PredictionTrendChart';
import {
  SkyStudioPanel,
  type SkyStudioBroadcastPackage,
  type SkyStudioTableDivision,
} from '../components/SkyStudioPanel';

const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const RECAP_FIXTURES_PAGE_SIZE = 8;
const RECAP_DIVISION_ORDER = ['Champions Bookies', 'Premier Bookies', 'Average Bookies', 'Struggling Bookies', 'Awful Bookies'];

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
};

type Team = {
  id: number;
  name: string;
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

type PredictionRow = {
  id: number;
  gw: string;
  competition: 'league' | 'cup';
  fixtureId: number;
  picker: string;
  pickOutcome: 'team' | 'draw';
  pickTeamId: number | null;
  pickTeamName: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  createdAt: string;
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

function hasLogRowInput(row: LogRow): boolean {
  const profit = Number(row.profit);
  const spins = Number(row.spins);
  return (
    (row.profit.trim() !== '' && Number.isFinite(profit) && profit !== 0)
    || (row.entryType === 'free_spins' && row.spins.trim() !== '' && Number.isFinite(spins) && spins !== 0)
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

type GameshowPageProps = {
  studioOnly?: boolean;
};

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

export function GameshowPage({ studioOnly = false }: GameshowPageProps) {
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
  const [allLeagueFixtures, setAllLeagueFixtures] = useState<
    Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>
  >([]);
  const [leagueMovement, setLeagueMovement] = useState<Record<string, Record<number, number>>>({});
  const [masterLeagueTable, setMasterLeagueTable] = useState<MasterLeagueTableRow[]>([]);
  const [allMasterLeagueFixtures, setAllMasterLeagueFixtures] = useState<MasterLeagueFixture[]>([]);
  const [masterLeagueMovement, setMasterLeagueMovement] = useState<Record<number, number>>({});
  const [masterLeagueBaselineGw, setMasterLeagueBaselineGw] = useState<string | null>(null);
  const [allTimeLeagues, setAllTimeLeagues] = useState<AllTimeLeaguesPayload | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamSeasonHistoryByTeamId, setTeamSeasonHistoryByTeamId] = useState<Record<number, TeamSeasonHistoryRow[]>>({});
  const [cupFixtures, setCupFixtures] = useState<CupFixture[]>([]);
  const [drawError, setDrawError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictionsLocked, setPredictionsLocked] = useState(false);
  const [currentGwLocked, setCurrentGwLocked] = useState(false);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [seasonPredictions, setSeasonPredictions] = useState<PredictionRow[]>([]);
  const [prevPredictions, setPrevPredictions] = useState<PredictionRow[]>([]);
  const [spotlightPulse, setSpotlightPulse] = useState<SpotlightPulse | null>(null);
  const [scoreUpdateAlert, setScoreUpdateAlert] = useState<ScoreUpdateAlert | null>(null);
  const [lastCompletedGameweek, setLastCompletedGameweek] = useState<LastCompletedContext | null>(null);
  const [prevLeagueFixtures, setPrevLeagueFixtures] = useState<
    Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>
  >([]);
  const [prevCupFixtures, setPrevCupFixtures] = useState<CupFixture[]>([]);
  const [recapPredictionScores, setRecapPredictionScores] = useState<PredictionScoreboard | null>(null);
  const [bookieDorBoard, setBookieDorBoard] = useState<BookieDorBoard | null>(null);
  const [currentGwEntries, setCurrentGwEntries] = useState<EntryRow[]>([]);
  const [predictionScores, setPredictionScores] = useState<PredictionScoreboard | null>(null);
  const [seasonOneScores, setSeasonOneScores] = useState<PredictionScoreboard | null>(null);
  const [predictionSelections, setPredictionSelections] = useState<Record<string, 'home' | 'away' | 'draw'>>({});
  const [predictionMessage, setPredictionMessage] = useState('');
  const [predictionSaving, setPredictionSaving] = useState(false);
  const [fixtureSetupBusy, setFixtureSetupBusy] = useState<'league' | 'master' | null>(null);
  const [fixtureSetupNotice, setFixtureSetupNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [seasonFinale, setSeasonFinale] = useState<SeasonFinale | null>(null);
  const [storylinePayload, setStorylinePayload] = useState<StorylinePayload | null>(null);
  const [finaleSlide, setFinaleSlide] = useState(0);
  const location = useLocation();
  const [kickoffFlowStep, setKickoffFlowStep] = useState<KickoffFlowStep>(studioOnly ? 'show' : 'results');
  const [recapFixturePageIndex, setRecapFixturePageIndex] = useState(0);

  const [logRows, setLogRows] = useState<LogRow[]>([createLogRow()]);
  const [opponentPreviewProfit, setOpponentPreviewProfit] = useState(0);

  const predictionsInitialized = useRef(false);
  const drawWindowRef = useRef<Window | null>(null);

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
    setKickoffFlowStep(studioOnly ? 'show' : 'results');
  }, [currentGw, studioOnly]);

  useEffect(() => {
    setRecapFixturePageIndex(0);
  }, [currentGw]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const state = await api.state();
      if (!mounted) {
        return;
      }
      const [
        table,
        fixtures,
        movementPayload,
        masterLeaguePayload,
        masterLeagueFixtures,
        teamList,
        cup,
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
        api.teams().catch(() => []),
        api.cup().catch(() => []),
        api.entries({ gw: state.currentGw, limit: 1000 }).catch(() => [] as EntryRow[]),
        api.predictions(state.currentGw).catch(() => ({ season: state.currentSeason, gw: state.currentGw, locked: false, predictions: [] })),
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
      setMasterLeagueMovement(masterLeaguePayload.movement ?? {});
      setMasterLeagueBaselineGw(masterLeaguePayload.baselineGw ?? null);
      setTeams(teamList);
      setTeamSeasonHistoryByTeamId(
        Object.fromEntries(
          teamList.map((team) => [team.id, historyResponse.histories[team.id] ?? [] as TeamSeasonHistoryRow[]]),
        ),
      );
      setCupFixtures(cup as CupFixture[]);
      setCurrentGwEntries(entriesForCurrentGw);
      setPredictions(predictionResponse.predictions);
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

  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCountdown((v) => (v === null ? null : v - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) {
      setLoading(true);
      api
        .drawTeam()
        .then((picked) => {
          setDraw(picked);
          setDrawError('');
          setShowLog(true);
        })
        .catch((error) => {
          setDraw(null);
          setDrawError(error instanceof Error ? error.message : 'Unable to draw team');
        })
        .finally(() => {
          setLoading(false);
          setCountdown(null);
        });
    }
  }, [countdown]);

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
  const currentCupFixtures = useMemo(
    () => cupFixtures.filter((fixture) => fixture.gw === currentGw),
    [cupFixtures, currentGw],
  );
  const currentMasterLeagueFixtures = useMemo(
    () => allMasterLeagueFixtures.filter((fixture) => fixture.gw === currentGw),
    [allMasterLeagueFixtures, currentGw],
  );
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
      setPrevPredictions([]);
      setPrevLeagueFixtures([]);
      setPrevCupFixtures([]);
      setRecapPredictionScores(null);
      return undefined;
    }

    Promise.all([
      api.predictions(recapTarget.gw, recapTarget.season).catch(() => ({ season: recapTarget.season, gw: recapTarget.gw, locked: false, predictions: [] as PredictionRow[] })),
      api.leagueFixtures(recapTarget.gw, false, recapTarget.season).catch(() => [] as Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; result: 'home' | 'away' | 'draw' | 'pending' }>),
      api.cup(recapTarget.gw, recapTarget.season).catch(() => [] as CupFixture[]),
      api.predictionScoreboard(recapTarget.season).catch(() => null),
    ]).then(([predictionResponse, leagueRows, cupRows, recapScoreboard]) => {
      if (!active) {
        return;
      }
      setPrevPredictions(predictionResponse.predictions);
      setPrevLeagueFixtures(leagueRows);
      setPrevCupFixtures(cupRows);
      setRecapPredictionScores(recapScoreboard);
    }).catch(() => {
      if (!active) {
        return;
      }
      setPrevPredictions([]);
      setPrevLeagueFixtures([]);
      setPrevCupFixtures([]);
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
      const key = `${row.competition}-${row.fixtureId}`;
      const entry = map.get(key) ?? {};
      entry[row.picker] = row;
      map.set(key, entry);
    });
    return map;
  }, [predictions]);

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

  useEffect(() => {
    if (predictionsInitialized.current) {
      return;
    }
    if (currentLeagueFixtures.length === 0 && currentCupFixtures.length === 0) {
      return;
    }
    const initialSelections: Record<string, 'home' | 'away' | 'draw'> = {};
    const leagueById = new Map(currentLeagueFixtures.map((fixture) => [fixture.id, fixture]));
    const cupById = new Map(currentCupFixtures.map((fixture) => [fixture.id, fixture]));

    jayPredictions.forEach((row) => {
      const key = `${row.competition}-${row.fixtureId}`;
      const fixture = row.competition === 'league' ? leagueById.get(row.fixtureId) : cupById.get(row.fixtureId);
      if (!fixture) {
        return;
      }
      if (row.pickOutcome === 'draw') {
        initialSelections[key] = 'draw';
      } else {
        const homeId = fixture.homeTeam ? teamIdByName.get(fixture.homeTeam) : null;
        const awayId = fixture.awayTeam ? teamIdByName.get(fixture.awayTeam) : null;
        if (row.pickTeamId && awayId && row.pickTeamId === awayId) {
          initialSelections[key] = 'away';
        } else if (row.pickTeamId && homeId && row.pickTeamId === homeId) {
          initialSelections[key] = 'home';
        }
      }
    });

    currentCupFixtures.forEach((fixture) => {
      const key = `cup-${fixture.id}`;
      if (initialSelections[key]) {
        return;
      }
      if (fixture.homeTeam && !fixture.awayTeam) {
        initialSelections[key] = 'home';
      }
      if (fixture.awayTeam && !fixture.homeTeam) {
        initialSelections[key] = 'away';
      }
    });

    setPredictionSelections(initialSelections);
    predictionsInitialized.current = true;
  }, [currentCupFixtures, currentLeagueFixtures, jayPredictions, teamIdByName]);

  const buildLeaguePicks = () =>
    currentLeagueFixtures
      .map((fixture) => {
        const key = `league-${fixture.id}`;
        const outcome = predictionSelections[key];
        const homeId = teamIdByName.get(fixture.homeTeam);
        const awayId = teamIdByName.get(fixture.awayTeam);
        if (!outcome || (!homeId && !awayId)) {
          return null;
        }
        if (outcome === 'draw') {
          return {
            fixtureId: fixture.id,
            pickTeamId: null,
            pickOutcome: 'draw' as const,
            predictedHomeScore: null,
            predictedAwayScore: null,
          };
        }
        const pickTeamId = outcome === 'home' ? homeId : awayId;
        if (!pickTeamId) {
          return null;
        }
        return {
          fixtureId: fixture.id,
          pickTeamId,
          pickOutcome: 'team' as const,
          predictedHomeScore: null,
          predictedAwayScore: null,
        };
      })
      .filter(
        (row): row is {
          fixtureId: number;
          pickTeamId: number | null;
          pickOutcome: 'team' | 'draw';
          predictedHomeScore: number | null;
          predictedAwayScore: number | null;
        } => row !== null,
      );

  const buildCupPicks = () =>
    currentCupFixtures
      .map((fixture) => {
        const key = `cup-${fixture.id}`;
        const outcome = predictionSelections[key];
        const homeId = fixture.homeTeam ? teamIdByName.get(fixture.homeTeam) : null;
        const awayId = fixture.awayTeam ? teamIdByName.get(fixture.awayTeam) : null;
        if (!outcome || outcome === 'draw') {
          return null;
        }
        const pickTeamId = outcome === 'home' ? homeId : awayId;
        if (!pickTeamId) {
          return null;
        }
        return {
          fixtureId: fixture.id,
          pickTeamId,
          pickOutcome: 'team' as const,
          predictedHomeScore: null,
          predictedAwayScore: null,
        };
      })
      .filter(
        (row): row is {
          fixtureId: number;
          pickTeamId: number;
          pickOutcome: 'team';
          predictedHomeScore: number | null;
          predictedAwayScore: number | null;
        } => row !== null,
      );

  const reloadFixtureSetupData = useCallback(async () => {
    const [state, table, fixtures, movementPayload, masterPayload, masterFixtures, lastCompletedResponse, bookieDorResponse] = await Promise.all([
      api.state().catch(() => ({ currentSeason, currentGw, cupDrawStarted, gwLocked: false })),
      api.leagueTable(),
      api.leagueFixtures(undefined, true),
      api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} as Record<string, Record<number, number>> })),
      api.masterLeagueTable(currentGw).catch(() => ({ gw: currentGw, baselineGw: null, movement: {} as Record<number, number>, table: [] as MasterLeagueTableRow[] })),
      api.masterLeagueFixtures(undefined, true).catch(() => [] as MasterLeagueFixture[]),
      api.lastCompletedGameweek().catch(() => ({
        currentSeason: currentSeason,
        currentGw: currentGw,
        lastCompleted: null as { season: string; gw: string } | null,
      })),
      api.bookieDor(currentSeason, currentGw).catch(() => null),
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
    setLastCompletedGameweek(lastCompletedResponse.lastCompleted);
    setBookieDorBoard(bookieDorResponse);
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
        text: `Master fixtures ready from ${result.fromGw} to ${result.toGw} (${result.created} fixtures).`,
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

  const submitPredictions = async () => {
    if (predictionsLocked) {
      return;
    }
    setPredictionSaving(true);
    setPredictionMessage('');
    try {
      const missingLeague = currentLeagueFixtures.some((fixture) => !predictionSelections[`league-${fixture.id}`]);
      const missingCup = currentCupFixtures.some((fixture) => {
        const key = `cup-${fixture.id}`;
        if (fixture.homeTeam && !fixture.awayTeam) {
          return false;
        }
        if (fixture.awayTeam && !fixture.homeTeam) {
          return false;
        }
        return !predictionSelections[key];
      });
      if (missingLeague || missingCup) {
        setPredictionMessage('Pick every fixture before submitting.');
        return;
      }
      const leaguePicks = buildLeaguePicks();
      const cupPicks = buildCupPicks();
      if (leaguePicks.length > 0) {
        await api.savePredictions({ gw: currentGw, competition: 'league', picks: leaguePicks, picker: 'Jay' });
      }
      if (cupPicks.length > 0) {
        await api.savePredictions({ gw: currentGw, competition: 'cup', picks: cupPicks, picker: 'Jay' });
      }
      await api.lockPredictions(currentGw);
      const updated = await api.predictions(currentGw);
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
    setDraw(null);
    setDrawError('');
    setShowLog(false);
    setOpponentPreviewProfit(0);
    setPredictionMessage('');
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
      setCountdown(5);
    } finally {
      setLoading(false);
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
      setCountdown(3);
    };

    let rowsToSave = logRows.filter(hasLogRowInput);
    if (rowsToSave.length === 0) {
      rowsToSave = [logRows[0] ?? createLogRow()];
    }

    try {
      const entries = rowsToSave.map((row) => ({
        teamId: draw.teamId,
        entryType: row.entryType,
        profit: Number(row.profit || 0),
        spins: row.entryType === 'free_spins' ? Number(row.spins || 0) : null,
        stake: row.entryType === 'free_spins' ? Number(row.stake || 0) : null,
        notes: null,
        noWin: false,
      }));

      await api.saveEntries(entries);
      const totalProfitDelta = rowsToSave.reduce((sum, row) => sum + Number(row.profit || 0), 0);
      const freeSpinRows = rowsToSave.filter((row) => row.entryType === 'free_spins');
      const bonusRows = rowsToSave.filter((row) => row.entryType === 'bonus');
      const freeSpinProfit = freeSpinRows.reduce((sum, row) => sum + Number(row.profit || 0), 0);
      const freeSpinSpins = freeSpinRows.reduce((sum, row) => sum + Number(row.spins || 0), 0);
      const bonusProfit = bonusRows.reduce((sum, row) => sum + Number(row.profit || 0), 0);
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
    () => (draw ? logRows.filter((row) => hasLogRowInput(row)) : []),
    [draw?.teamId, logRows],
  );

  const pendingEntryCount = pendingLogRows.length;

  const pendingProfitDelta = useMemo(
    () => pendingLogRows.reduce((sum, row) => sum + Number(row.profit || 0), 0),
    [pendingLogRows],
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
      const opponentLine = opponentBase && opponentBase.toUpperCase() !== 'BYE'
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

  const leagueFormByTeamName = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    const sortedFixtures = allLeagueFixturesForStudio
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
  }, [allLeagueFixturesForStudio]);

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

  const currentLeagueFixturesForStudio = useMemo(
    () => allLeagueFixturesForStudio.filter((fixture) => fixture.gw === currentGw),
    [allLeagueFixturesForStudio, currentGw],
  );
  const currentMasterLeagueFixturesForStudio = useMemo(
    () => allMasterLeagueFixturesForStudio.filter((fixture) => fixture.gw === currentGw),
    [allMasterLeagueFixturesForStudio, currentGw],
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
    return map;
  }, [currentLeagueFixturesForStudio, currentMasterLeagueFixturesForStudio]);

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
  }, [allLeagueFixturesForStudio, cupFixtures, seasonPredictionByKey]);

  const studioFixtureCount = currentLeagueFixturesForStudio.length + currentMasterLeagueFixturesForStudio.length + currentCupFixtures.length;
  const studioResolvedCount =
    currentLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length
    + currentMasterLeagueFixturesForStudio.filter((fixture) => fixture.result !== 'pending').length
    + currentCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length;

  const studioTableDivisions = useMemo(() => {
    const lastDivision = RECAP_DIVISION_ORDER[RECAP_DIVISION_ORDER.length - 1];
    return RECAP_DIVISION_ORDER
      .map((division, divisionIndex) => {
        const rows =
          draw && showLog && division === draw.division
            ? projectedDivisionRows
            : (leagueTable[division] ?? []).slice().sort((a, b) => a.rank - b.rank);
        const pendingMatchesByTeam = new Map<number, number>();
        allLeagueFixturesForStudio
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
    allLeagueFixturesForStudio,
    currentGw,
    draw,
    leagueFormByTeamName,
    leagueMovement,
    leagueTable,
    projectedDivisionRows,
    showLog,
    teamIdByName,
    teamMetaByName,
  ]);

  const studioMasterLeagueRows = useMemo(() => {
    const rows = masterLeagueTable.slice().sort((a, b) => a.rank - b.rank);
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
    const lastDivision = RECAP_DIVISION_ORDER[RECAP_DIVISION_ORDER.length - 1];

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
      const seasonArchive = (teamSeasonHistoryByTeamId[row.teamId] ?? [])
        .slice()
        .sort((a, b) => seasonSortValue(b.season) - seasonSortValue(a.season));
      const previousSeasons = seasonArchive
        .filter((season) => season.season !== currentSeason)
        .slice(0, 12)
        .map((season) => ({
          season: season.season,
          division: displayDivisionName(season.division),
          rank: season.rank,
          points: season.points,
          profit: season.profit,
          spins: season.spins,
          cupFinish: season.cupFinish,
        }));
      const previousCupRuns = previousSeasons.map((season) => ({
        season: season.season,
        cupFinish: season.cupFinish,
      }));
      const teamLeagueFixtures = allLeagueFixturesForStudio
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
      const recentResults = [...recentLeagueResults, ...recentCupResults].slice(-4);

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
      const currentCupJourney = teamCupFixtures.map((fixture) => {
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
      });

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
      const seasonStory = GAMEWEEKS.map((gw) => {
        const gwProfit = teamLeagueFixtures
          .filter((fixture) => fixture.gw === gw && fixture.result !== 'pending')
          .reduce((sum, fixture) => (
            sum + (fixture.homeTeam === teamName ? fixture.homeProfit : fixture.awayProfit)
          ), 0);
        cumulativeProfit += gwProfit;
        return { gw, cumulativeProfit: Number(cumulativeProfit.toFixed(2)) };
      });

      const zoneLabel =
        division === RECAP_DIVISION_ORDER[0] && row.rank === 1
          ? 'Champions pace'
          : division !== RECAP_DIVISION_ORDER[0] && row.rank === 1
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
      const nextLeagueLabel = nextLeagueFixture
        ? `${nextLeagueFixture.gw}: ${nextLeagueFixture.homeTeam} vs ${nextLeagueFixture.awayTeam}`
        : 'No pending league fixture';
      const nextCupLabel = nextCupFixture
        ? `${nextCupFixture.gw}: ${(nextCupFixture.homeTeam ?? 'TBD')} vs ${(nextCupFixture.awayTeam ?? 'TBD')}`
        : 'No pending cup fixture';
      const predictedPointsValue = row.played > 0
        ? Math.round((row.points / row.played) * GAMEWEEKS.length)
        : row.points;
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
            fixture.result === 'pending'
              ? myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending'
              : fixture.result === 'draw'
                ? 'As it stands, draw'
                : `As it stands, ${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} lead`;
          return {
            id: `weekly-league-${fixture.id}`,
            competition: `League • ${displayDivisionName(fixture.division)}`,
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            statusCode,
            status,
            winnerName,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
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
            statusCode,
            status,
            winnerName,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(myProfit) : 'Pending',
            opponentScore: opponentEntryCount > 0 ? formatSigned(opponentProfit) : 'Pending',
            picks: 'Jay: — • Computer: —',
          };
        });
      const weeklyCupFixtures = currentCupFixtures
        .filter((fixture) => fixture.homeTeam === teamName || fixture.awayTeam === teamName)
        .map((fixture) => {
          const opponent = fixture.homeTeam === teamName ? (fixture.awayTeam ?? 'BYE') : (fixture.homeTeam ?? 'BYE');
          const opponentProfit = opponent === 'BYE' ? null : currentGwProfitByTeamNameForStudio.get(opponent);
          const opponentEntryCount = opponent === 'BYE' ? 0 : (currentGwEntryCountByTeamNameWithPending.get(opponent) ?? 0);
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
            fixture: `${fixture.homeTeam ?? 'BYE'} vs ${fixture.awayTeam ?? 'BYE'}`,
            statusCode,
            status: fixture.winnerTeam
              ? `As it stands, ${fixture.winnerTeam} are through`
              : myEntryCount > 0 || opponentEntryCount > 0
                ? 'In play'
                : 'Pending',
            winnerName: fixture.winnerTeam,
            opponentName: opponent,
            teamScore: myEntryCount > 0 ? formatSigned(currentGwProfitByTeamNameForStudio.get(teamName) ?? 0) : 'Pending',
            opponentScore: opponent === 'BYE'
              ? 'BYE'
              : opponentEntryCount > 0
                ? formatSigned(opponentProfit ?? 0)
                : 'Pending',
            picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
          };
        });
      const weeklyFixtures = [...weeklyLeagueFixtures, ...weeklyMasterFixtures, ...weeklyCupFixtures];

      return {
        id: row.teamId,
        name: teamName,
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
        nextLeagueFixture: nextLeagueLabel,
        nextCupFixture: nextCupLabel,
        nextLeagueIsRivalry: false,
        rivalry: null,
        predictedFinish: `${ordinal(row.rank)} in ${divisionLabel}`,
        predictedPoints: `${predictedPointsValue} pts`,
        predictedRank: row.rank,
        zoneLabel,
        divisionMovement,
        seasonStory,
      };
    });
  }, [
    allLeagueFixturesForStudio,
    cupFixtures,
    currentGwLocked,
    currentCupFixtures,
    currentGw,
    currentGwEntryCountByTeamNameWithPending,
    currentGwProfitByTeamNameForStudio,
    currentLeagueFixturesForStudio,
    currentMasterLeagueFixturesForStudio,
    currentPredictionMap,
    currentSeason,
    kickoffDayPhase.line,
    kickoffDayPhase.phase,
    leagueMovement,
    leagueTable,
    studioTableDivisions,
    teamMetaByName,
    teamPredictionCredits,
    teamSeasonHistoryByTeamId,
  ]);

  const studioFixtureGroups = useMemo(() => {
    const leagueDivisionOrder = [...RECAP_DIVISION_ORDER, 'Playoff', 'Friendly'];
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

    if (currentCupFixtures.length > 0) {
      groups.push({
        id: `cup-${currentGw}`,
        title: `Cup • ${currentGw}`,
        subtitle: `${kickoffDayPhase.label} • ${studioTruthLabel}`,
        fixtures: currentCupFixtures
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((fixture) => {
            const home = fixture.homeTeam ?? (fixture.awayTeam ? 'BYE' : 'TBD');
            const away = fixture.awayTeam ?? (fixture.homeTeam ? 'BYE' : 'TBD');
            const picks = currentPredictionMap.get(`cup-${fixture.id}`);
            const homeEntries = fixture.homeTeam ? (currentGwEntryCountByTeamNameWithPending.get(fixture.homeTeam) ?? 0) : 0;
            const awayEntries = fixture.awayTeam ? (currentGwEntryCountByTeamNameWithPending.get(fixture.awayTeam) ?? 0) : 0;
            const hasEntrySignal = homeEntries > 0 || awayEntries > 0;
            const homeScore = fixture.homeTeam ? currentGwProfitByTeamNameForStudio.get(fixture.homeTeam) : null;
            const awayScore = fixture.awayTeam ? currentGwProfitByTeamNameForStudio.get(fixture.awayTeam) : null;
            const byeWinner = fixture.homeTeam && !fixture.awayTeam
              ? fixture.homeTeam
              : !fixture.homeTeam && fixture.awayTeam
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
              score: resolvedWinner ? `Winner: ${resolvedWinner}` : hasEntrySignal ? liveScore : 'Pending',
              outcome,
              profitImpact: statusCode === 'provisional' ? 'Provisional' : statusCode === 'final_confirmed' ? 'Confirmed' : '—',
              picks: `Jay: ${pickLabel(picks?.Jay)} • Computer: ${pickLabel(picks?.Computer)}`,
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
    currentPredictionMap,
    kickoffDayPhase.label,
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
    RECAP_DIVISION_ORDER.forEach((division) => {
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
  }, [leagueMovement, leagueTable, studioTableDivisions]);

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
    if (currentCupFixtures.length > 0) {
      items.push(`${currentGw} • ${studioTruthLabel} • Cup ${currentCupFixtures.filter((fixture) => fixture.winnerTeam !== null).length}/${currentCupFixtures.length} updated`);
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
    kickoffDayPhase.label,
    kickoffDayPhase.line,
    storylinePayload,
    studioTruthLabel,
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
      const weightLine = `Model weights • League ${Math.round(weights.league * 100)}% • Cup ${Math.round(weights.cup * 100)}% • Master ${Math.round(weights.master * 100)}% • Consistency ${Math.round(weights.consistency * 100)}%`;
      const runnerUp = bookieDorBoard.leaderboard[1];
      packages.push({
        id: `bookie-dor-${bookieDorBoard.season}-${bookieDorBoard.gw}`,
        label: "Bookie d'Or Watch",
        headline: `${bookieDorBoard.holder.teamName} currently leads the Bookie d'Or race`,
        lines: [
          `${bookieDorBoard.holder.teamName} on ${bookieDorBoard.holder.score.toFixed(2)} with balanced scoring across league, cup, master league, and consistency.`,
          runnerUp
            ? `${runnerUp.teamName} are the nearest challenger on ${runnerUp.score.toFixed(2)}.`
            : 'No close challenger has formed yet.',
          weightLine,
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
        disagreements.push(`${fixture.homeTeam ?? 'BYE'} vs ${fixture.awayTeam ?? 'BYE'}: Jay on ${jayPick}, Computer on ${computerPick}.`);
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
      RECAP_DIVISION_ORDER.forEach((division) => {
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
      if (allTimeLeagues?.pointsTable?.[0]) {
        launchLines.push(`All-time leader right now is ${allTimeLeagues.pointsTable[0].teamName}.`);
      }
      packages.push({
        id: `matchday-launch-${currentGw}`,
        label: 'Matchday Launch Show',
        headline: `Matchday 1 hype across divisions, master league, and all-time boards`,
        lines: launchLines.slice(0, 6),
        tone: 'fixtures',
        alert: 'LAUNCH NIGHT',
      });
    }

    if (currentGw === 'GW1') {
      const cupDrawLines = currentCupFixtures
        .slice(0, 6)
        .map((fixture) => `${fixture.homeTeam ?? 'BYE'} vs ${fixture.awayTeam ?? 'BYE'}.`);
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
        const lastSeasonLine = spotlightTeam.lastSeasonSummary
          ? `${spotlightTeam.name} ended last season ${ordinal(spotlightTeam.lastSeasonSummary.rank)} in ${spotlightTeam.lastSeasonSummary.division}.`
          : `${spotlightTeam.name} have limited archived league finish data.`;
        const currentSeasonLine = spotlightTeam.rank
          ? `Current season, as it stands: ${ordinal(spotlightTeam.rank)} in ${spotlightTeam.league} with ${spotlightTeam.points} points.`
          : `Current season position is still forming for ${spotlightTeam.name}.`;
        const latestCupRound = spotlightTeam.currentCupJourney?.length
          ? spotlightTeam.currentCupJourney[spotlightTeam.currentCupJourney.length - 1] ?? null
          : null;
        const cupLine = latestCupRound
          ? `Cup path: ${latestCupRound.result} in ${latestCupRound.round}.`
          : 'Cup storyline is still developing.';
        const liveTruthLine = currentGwLocked
          ? 'This tie is provisionally called and will only be confirmed after rollover.'
          : 'Still in play: entries can land through the day, so calls remain provisional.';
        packages.push({
          id: `kickoff-team-brief-${spotlightTeam.id}-${currentGw}`,
          label: 'Kick-Off Team Brief',
          headline: `${spotlightTeam.name} spotlight deep-dive`,
          lines: [
            kickoffDayPhase.line,
            lastSeasonLine,
            currentSeasonLine,
            spotlightTeam.playoffContext?.trendLine ?? `${spotlightTeam.divisionMovement} with form ${spotlightTeam.leagueForm.join('-') || 'N/A'}.`,
            cupLine,
            spotlightTeam.playoffContext?.actionLine ?? `Next up: ${spotlightTeam.nextLeagueFixture}.`,
            liveTruthLine,
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

    return packages.slice(0, 12);
  }, [
    allTimeLeagues,
    bookieDorBoard,
    currentSeason,
    currentGwLocked,
    currentCupFixtures,
    currentGw,
    currentLeagueFixtures,
    currentLeagueFixturesForStudio,
    currentMasterLeagueFixturesForStudio,
    currentPredictionMap,
    draw,
    predictionsLocked,
    prevCupFixtures,
    prevLeagueFixtures,
    prevPredictionMap,
    prevWeekScores,
    recapTarget,
    scoreboardTotals,
    studioMovements,
    studioTeams,
    kickoffDayPhase.label,
    kickoffDayPhase.line,
    studioTruthLabel,
  ]);

  const recapFixtureRows = useMemo(() => {
    const divisionIndex = new Map(RECAP_DIVISION_ORDER.map((division, idx) => [division, idx]));

    const leagueRows = currentLeagueFixtures
      .slice()
      .sort((a, b) => {
        const aIdx = divisionIndex.get(a.division) ?? RECAP_DIVISION_ORDER.length;
        const bIdx = divisionIndex.get(b.division) ?? RECAP_DIVISION_ORDER.length;
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

    return [...leagueRows, ...masterRows, ...cupRows];
  }, [currentCupFixtures, currentLeagueFixtures, currentMasterLeagueFixtures]);

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
  const gw1FixtureSetupNeeded = currentGw === 'GW1' && (!leagueFixturesReady || !masterFixturesReady);
  const activeKickoffFlowStep: KickoffFlowStep = studioOnly ? 'show' : kickoffFlowStep;
  const showOnlyKickoffStudio = activeKickoffFlowStep === 'show' || activeKickoffFlowStep === 'recap';

  if (studioOnly) {
    return (
      <section className="page news-page">
        <h1>Sky Sports News Live</h1>
        <p className="muted">Watch the studio any time with live table highlights, fixture stories, and ticker updates.</p>
        {currentGw === 'GW1' && (
          <div className={`kickoff-locked-summary${gw1FixtureSetupNeeded ? ' warning' : ''}`}>
            <span className="muted">
              GW1 fixtures: League {leagueFixturesReady ? 'loaded' : 'missing'} • Master {masterFixturesReady ? 'loaded' : 'missing'}
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
            </div>
            {fixtureSetupNotice && (
              <span className="muted" style={fixtureSetupNotice.type === 'error' ? { color: 'var(--danger)' } : undefined}>
                {fixtureSetupNotice.text}
              </span>
            )}
          </div>
        )}
        <div className="studio-news-shell">
            <SkyStudioPanel
              currentSeason={currentSeason}
              currentGw={currentGw}
              gwLocked={currentGwLocked}
              fixtureCount={studioFixtureCount}
              resolvedCount={studioResolvedCount}
              teams={studioTeams}
              tableDivisions={studioTableDivisions}
              masterLeagueRows={studioMasterLeagueRows}
              fixtureGroups={studioFixtureGroups}
              cupFixtures={cupFixtures}
              allTimeLeagues={allTimeLeagues}
              rivalries={studioRivalries}
              movements={studioMovements}
              tickerItems={studioTickerItems}
              broadcastPackages={studioBroadcastPackages}
              spotlightPulse={spotlightPulse}
              scoreUpdateAlert={scoreUpdateAlert}
              skySportsNews={true}
              dayPhaseLabel={kickoffDayPhase.label}
            dayPhaseLine={kickoffDayPhase.line}
            truthLabel={studioTruthLabel}
            presentationMode="lean"
          />
        </div>
      </section>
    );
  }

  return (
    <section className={`page gameshow-page${showOnlyKickoffStudio ? ' kickoff-show-page' : ''}`}>
      <h1>{studioOnly ? 'Sky Sports News Live' : 'The Kick-Off Show'}</h1>
      <p className="muted">
        {studioOnly
          ? 'Always-on studio feed for tables, fixtures, trends, and ticker updates.'
          : 'Prediction results first, then weekly guesses, then the one-screen kick-off studio.'}
      </p>
      {!studioOnly && (
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
      )}

      {activeKickoffFlowStep === 'results' && (
        <div className="panel kickoff-panel kickoff-flow-shell kickoff-flow-shell-results">
          <div className="kickoff-header">
            <div>
              <h3>Step 1 • Prediction Results</h3>
              <p className="muted">Review last gameweek outcomes and prediction scores, then press Done.</p>
              <p className="muted">Last completed gameweek: {recapTargetLabel ?? 'None yet'} • Current gameweek: {currentSeason} {currentGw}</p>
            </div>
            <div className="kickoff-header-actions">
              <span className={`lock-chip ${predictionsLocked ? 'locked' : 'open'}`}>{predictionsLocked ? 'Locked' : 'Open'}</span>
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
            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header">
                <h4>Previous Results</h4>
                <span className="muted">{recapTargetLabel ?? 'N/A'}</span>
              </div>
              <div className="recap-list">
                {recapTarget ? (
                  <>
                    <div className="recap-group">
                      <span className="muted">League</span>
                      {prevLeagueFixtures.length > 0 ? (
                        prevLeagueFixtures.map((fixture) => (
                          <div key={`prev-league-${fixture.id}`} className="recap-item">
                            {fixture.result === 'pending' ? (
                              `${fixture.homeTeam} vs ${fixture.awayTeam} (TBD)`
                            ) : fixture.result === 'draw' ? (
                              `${fixture.homeTeam} drew ${fixture.awayTeam}`
                            ) : (
                              `${fixture.result === 'home' ? fixture.homeTeam : fixture.awayTeam} beat ${fixture.result === 'home' ? fixture.awayTeam : fixture.homeTeam}`
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="muted">No league fixtures recorded.</p>
                      )}
                    </div>
                    <div className="recap-group">
                      <span className="muted">Cup</span>
                      {prevCupFixtures.length > 0 ? (
                        prevCupFixtures.map((fixture) => (
                          <div key={`prev-cup-${fixture.id}`} className="recap-item">
                            {fixture.homeTeam ?? 'BYE'} vs {fixture.awayTeam ?? 'BYE'} • Winner: {fixture.winnerTeam ?? 'TBD'}
                          </div>
                        ))
                      ) : (
                        <p className="muted">No cup fixtures recorded.</p>
                      )}
                    </div>
                    <div className="recap-group">
                      <span className="muted">Last Week Picks</span>
                      {prevLeagueFixtures.map((fixture) => {
                        const key = `league-${fixture.id}`;
                        const picks = prevPredictionMap.get(key);
                        const result =
                          fixture.result === 'pending'
                            ? 'TBD'
                            : fixture.result === 'draw'
                              ? 'Draw'
                              : fixture.result === 'home'
                                ? fixture.homeTeam
                                : fixture.awayTeam;
                        return (
                          <div key={`prev-pick-league-${fixture.id}`} className="recap-item">
                            {fixture.homeTeam} vs {fixture.awayTeam} • Result: {result} • Jay: {pickLabel(picks?.Jay)} • Computer: {pickLabel(picks?.Computer)}
                          </div>
                        );
                      })}
                      {prevCupFixtures.map((fixture) => {
                        const key = `cup-${fixture.id}`;
                        const picks = prevPredictionMap.get(key);
                        const result = fixture.winnerTeam ?? 'TBD';
                        return (
                          <div key={`prev-pick-cup-${fixture.id}`} className="recap-item">
                            {fixture.homeTeam ?? 'BYE'} vs {fixture.awayTeam ?? 'BYE'} • Result: {result} • Jay: {pickLabel(picks?.Jay)} • Computer: {pickLabel(picks?.Computer)}
                          </div>
                        );
                      })}
                      {prevLeagueFixtures.length === 0 && prevCupFixtures.length === 0 && (
                        <p className="muted">No picks recorded for {recapTargetLabel ?? 'that period'}.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="muted">No previous gameweek yet.</p>
                )}
              </div>
            </div>

            <div className="kickoff-card kickoff-card-scroll kickoff-results-scorecard">
              <div className="panel-header">
                <h4>Prediction Mini-League</h4>
                <span className="news-chip">Jay vs Computer</span>
              </div>
              <table className="scoreboard-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pts</th>
                    <th>Correct</th>
                    <th>Perfect</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboardTotals.map((row) => (
                    <tr key={`score-${row.picker}`}>
                      <td>{row.picker}</td>
                      <td>{row.points}</td>
                      <td>{row.correct}/{row.total}</td>
                      <td>{row.perfectWeeks > 0 ? <span className="perfect-badge">{row.perfectWeeks}x</span> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="scoreboard-week">
                <span className="muted">Last week ({recapTargetLabel ?? 'N/A'})</span>
                {recapTarget && prevWeekScores.length > 0 ? (
                  prevWeekScores.map((row) => (
                    <div key={`week-${row.picker}`} className="scoreboard-week-row">
                      <strong>{row.picker}</strong> {row.points} pts {row.perfect && <span className="perfect-badge">Perfect</span>}
                    </div>
                  ))
                ) : (
                  <span className="muted">No scores yet.</span>
                )}
              </div>
              <div className="scoreboard-week">
                <span className="muted">Trend Snapshot</span>
                <PredictionTrendChart
                  title="Season to Date"
                  weeks={predictionScores?.weeks ?? seasonOneScores?.weeks ?? null}
                />
              </div>
            </div>

            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header">
                <h4>Bookie d&apos;Or Board</h4>
                <span className="news-chip">{bookieDorBoard ? `${bookieDorBoard.season} ${bookieDorBoard.gw}` : `${currentSeason} ${currentGw}`}</span>
              </div>
              {bookieDorBoard?.holder ? (
                <>
                  <div className="recap-group">
                    <span className="muted">Current Holder</span>
                    <div className="recap-item">
                      {bookieDorBoard.holder.teamName} • {bookieDorBoard.holder.score.toFixed(2)} pts
                    </div>
                    <div className="recap-item">
                      Weighted: League {bookieDorBoard.holder.weightedLeagueScore.toFixed(2)} • Cup {bookieDorBoard.holder.weightedCupScore.toFixed(2)} • Master {bookieDorBoard.holder.weightedMasterScore.toFixed(2)} • Consistency {bookieDorBoard.holder.weightedConsistencyScore.toFixed(2)}
                    </div>
                    <div className="recap-item">
                      Raw: League {bookieDorBoard.holder.leagueScore.toFixed(1)} • Cup {bookieDorBoard.holder.cupScore.toFixed(1)} • Master {bookieDorBoard.holder.masterScore.toFixed(1)} • Consistency {bookieDorBoard.holder.consistencyScore.toFixed(1)}
                    </div>
                  </div>
                  <div className="recap-group">
                    <span className="muted">Top Leaderboard</span>
                    {bookieDorBoard.leaderboard.slice(0, 5).map((row, idx) => (
                      <div key={`bookie-dor-row-${row.teamId}`} className="recap-item">
                        {idx + 1}. {row.teamName} ({row.division}) • {row.score.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    Weights: League {Math.round(bookieDorBoard.weights.league * 100)}% • Cup {Math.round(bookieDorBoard.weights.cup * 100)}% • Master {Math.round(bookieDorBoard.weights.master * 100)}% • Consistency {Math.round(bookieDorBoard.weights.consistency * 100)}%.
                  </p>
                </>
              ) : (
                <p className="muted">Bookie d&apos;Or standings are not available yet.</p>
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
              <p className="muted">Pick every fixture for {currentGw}, lock predictions, then press Done.</p>
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
                Fixture setup: League {leagueFixturesReady ? `${currentLeagueFixtures.length} loaded` : 'not loaded'} • Master {masterFixturesReady ? `${currentMasterLeagueFixtures.length} loaded` : 'not loaded'}
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
                <h4>{currentGw} Cup Picks</h4>
                <span className="muted">{currentCupFixtures.length} fixtures</span>
              </div>
              <div className="prediction-list">
                {currentCupFixtures.length > 0 ? (
                  currentCupFixtures.map((fixture) => {
                    const key = `cup-${fixture.id}`;
                    const homeLabel = fixture.homeTeam ?? 'BYE';
                    const awayLabel = fixture.awayTeam ?? 'BYE';
                    const homeId = fixture.homeTeam ? teamIdByName.get(fixture.homeTeam) : null;
                    const awayId = fixture.awayTeam ? teamIdByName.get(fixture.awayTeam) : null;
                    const selected = predictionSelections[key];
                    const currentPredictions = currentPredictionMap.get(key);
                    return (
                      <div key={key} className="prediction-fixture">
                        <div className="prediction-team-row">
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'home' ? 'active' : ''}`}
                            onClick={() => homeId && !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [key]: 'home' }))}
                            disabled={!homeId || predictionsLocked}
                          >
                            {homeLabel}
                          </button>
                          <span className="prediction-vs">VS</span>
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'away' ? 'active' : ''}`}
                            onClick={() => awayId && !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [key]: 'away' }))}
                            disabled={!awayId || predictionsLocked}
                          >
                            {awayLabel}
                          </button>
                        </div>
                        {predictionsLocked && (
                          <div className="prediction-meta-row">
                            <span>Jay: {pickLabel(currentPredictions?.Jay)}</span>
                            <span>Computer: {pickLabel(currentPredictions?.Computer)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">No cup fixtures for {currentGw}.</p>
                )}
              </div>
            </div>

            <div className="kickoff-card kickoff-card-scroll">
              <div className="panel-header">
                <h4>{currentGw} League Picks</h4>
                <span className="muted">{currentLeagueFixtures.length} fixtures</span>
              </div>
              <div className="prediction-list">
                {currentLeagueFixtures.length > 0 ? (
                  currentLeagueFixtures.map((fixture) => {
                    const key = `league-${fixture.id}`;
                    const homeId = teamIdByName.get(fixture.homeTeam);
                    const awayId = teamIdByName.get(fixture.awayTeam);
                    const selected = predictionSelections[key];
                    const currentPredictions = currentPredictionMap.get(key);
                    return (
                      <div key={key} className="prediction-fixture">
                        <div className="prediction-team-row prediction-team-row-3">
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'home' ? 'active' : ''}`}
                            onClick={() => homeId && !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [key]: 'home' }))}
                            disabled={!homeId || predictionsLocked}
                          >
                            {fixture.homeTeam}
                          </button>
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'draw' ? 'active' : ''}`}
                            onClick={() => !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [key]: 'draw' }))}
                            disabled={predictionsLocked}
                          >
                            Draw
                          </button>
                          <button
                            type="button"
                            className={`prediction-team ${selected === 'away' ? 'active' : ''}`}
                            onClick={() => awayId && !predictionsLocked && setPredictionSelections((prev) => ({ ...prev, [key]: 'away' }))}
                            disabled={!awayId || predictionsLocked}
                          >
                            {fixture.awayTeam}
                          </button>
                        </div>
                        {predictionsLocked && (
                          <div className="prediction-meta-row">
                            <span>Jay: {pickLabel(currentPredictions?.Jay)}</span>
                            <span>Computer: {pickLabel(currentPredictions?.Computer)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">No league fixtures for {currentGw}.</p>
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
                                    stake: nextType === 'bonus' ? '' : (r.stake || '0.10'),
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
                          value={row.entryType === 'bonus' ? '' : row.stake}
                          disabled={row.entryType === 'bonus'}
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

          <div className="studio-news-shell">
            <SkyStudioPanel
              currentSeason={currentSeason}
              currentGw={currentGw}
              gwLocked={currentGwLocked}
              fixtureCount={studioFixtureCount}
              resolvedCount={studioResolvedCount}
              teams={studioTeams}
              tableDivisions={studioTableDivisions}
              masterLeagueRows={studioMasterLeagueRows}
              fixtureGroups={studioFixtureGroups}
              cupFixtures={cupFixtures}
              allTimeLeagues={allTimeLeagues}
              rivalries={studioRivalries}
              movements={studioMovements}
              tickerItems={studioTickerItems}
              broadcastPackages={studioBroadcastPackages}
              spotlightPulse={spotlightPulse}
              scoreUpdateAlert={scoreUpdateAlert}
              skySportsNews={false}
              focusTeamId={draw?.teamId ?? null}
              dayPhaseLabel={kickoffDayPhase.label}
              dayPhaseLine={kickoffDayPhase.line}
              truthLabel={studioTruthLabel}
            />
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
                {RECAP_DIVISION_ORDER.map((division) => {
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
                              <th>Pts</th>
                              <th>Prof</th>
                              <th>Spins</th>
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
                                  <td>{row.points}</td>
                                  <td>{row.profit}</td>
                                  <td>{row.spins}</td>
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
                      <th>P</th>
                      <th>Pts</th>
                      <th>Prof</th>
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
                          <td>{row.points}</td>
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

      {countdown !== null && (
        <div className="overlay">
          <div className="countdown">{countdown}</div>
        </div>
      )}
    </section>
  );
}
