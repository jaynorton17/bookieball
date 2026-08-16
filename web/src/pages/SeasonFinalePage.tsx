import { useEffect, useMemo, useState, useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';
import type { PanelTone, TeamPalette } from '../lib/broadcastTheme';
import { PANEL_THEMES, slideTransition, DEFAULT_TEAM_PALETTE } from '../lib/broadcastTheme';
import {
  formatSigned,
  formatPercent,
  uppercaseName,
  createPalette,
  uniqueTeamEntries,
  groupByDivision,
} from '../lib/finaleHelpers';
import type {
  TitleRaceRow,
  SeasonFinalePayload,
  StandingsSummaryRow,
  DivisionTableMap,
  DivisionStory,
} from '../lib/finaleData';
import {
  computeDivisionStories,
  computeDivisionSlides,
  computePromotionSpotlights,
} from '../lib/finaleData';
import { TeamOrb } from '../components/broadcast/TeamOrb';
import { SlideCanvas } from '../components/broadcast/SlideCanvas';
import { HeaderBar } from '../components/broadcast/HeaderBar';
import { BroadcastPanel } from '../components/broadcast/BroadcastPanel';
import { StatTile } from '../components/broadcast/StatTile';
import { ShowcaseHeroPanel } from '../components/broadcast/ShowcaseHeroPanel';
import { DivisionJourneyPanel } from '../components/broadcast/DivisionJourneyPanel';
import { TickerBar } from '../components/broadcast/TickerBar';
import { LeagueTable } from '../components/broadcast/LeagueTable';
import { CompactStandingsBoard } from '../components/broadcast/CompactStandingsBoard';
import { TrophyMark } from '../components/broadcast/TrophyMark';
import { ErrorBoundary } from '../components/ErrorBoundary';

type TeamMeta = Awaited<ReturnType<typeof api.teams>>[number];
type AppState = Awaited<ReturnType<typeof api.state>>;
type LeagueTableMap = Record<string, Array<StandingsSummaryRow>>;
type LeagueFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];

type SeasonFinaleResponse =
  | { pending: false }
  | { season: string; payload: SeasonFinalePayload };

type SeasonFinaleData = {
  season: string;
  payload: SeasonFinalePayload;
};

type SlideDefinition = {
  id: string;
  label: string;
  node: ReactNode;
};

const FALLBACK_FINALE_PAYLOAD: SeasonFinalePayload = {
  season: 'S4',
  leagueWinners: [
    { division: 'Champions Bookies', teamId: 20, teamName: '888 Casino' },
    { division: 'Premier Bookies', teamId: 11, teamName: 'Paddy Power' },
    { division: 'Average Bookies', teamId: 5, teamName: 'Coral' },
    { division: 'Struggling Bookies', teamId: 17, teamName: 'Bally Casino' },
    { division: 'Awful Bookies', teamId: 4, teamName: 'Foxy Bingo' },
  ],
  bestProfits: {
    overall: { teamId: 20, teamName: '888 Casino', profit: 28.4 },
    byDivision: [
      { division: 'Champions Bookies', teamId: 20, teamName: '888 Casino', profit: 28.4 },
      { division: 'Premier Bookies', teamId: 11, teamName: 'Paddy Power', profit: 21.1 },
      { division: 'Average Bookies', teamId: 5, teamName: 'Coral', profit: 16.2 },
      { division: 'Struggling Bookies', teamId: 17, teamName: 'Bally Casino', profit: 11.6 },
      { division: 'Awful Bookies', teamId: 4, teamName: 'Foxy Bingo', profit: 7.3 },
    ],
  },
  promotions: [
    { teamId: 11, teamName: 'Paddy Power', from: 'Premier Bookies', to: 'Champions Bookies' },
    { teamId: 5, teamName: 'Coral', from: 'Average Bookies', to: 'Premier Bookies' },
    { teamId: 17, teamName: 'Bally Casino', from: 'Struggling Bookies', to: 'Average Bookies' },
  ],
  relegations: [
    { teamId: 9, teamName: 'Sky Bet', from: 'Champions Bookies', to: 'Premier Bookies' },
    { teamId: 12, teamName: 'Virgin Games', from: 'Premier Bookies', to: 'Average Bookies' },
    { teamId: 18, teamName: 'Tombola', from: 'Average Bookies', to: 'Struggling Bookies' },
  ],
  playoffResults: [
    { upperTeamId: 6, upperTeamName: 'Ladbrokes', lowerTeamId: 5, lowerTeamName: 'Coral', upperDivision: 'Premier Bookies', lowerDivision: 'Average Bookies', winnerTeamId: 5, winnerTeamName: 'Coral', swapped: true },
    { upperTeamId: 1, upperTeamName: 'Midnite', lowerTeamId: 17, lowerTeamName: 'Bally Casino', upperDivision: 'Average Bookies', lowerDivision: 'Struggling Bookies', winnerTeamId: 1, winnerTeamName: 'Midnite', swapped: false },
  ],
  cupWinner: { teamId: 8, teamName: 'Bwin' },
  superCup: {
    sourceSeason: 'S3',
    pairingReason: 'winners_vs_winners',
    pairingExplanation: 'Bwin earned the BookieBall Cup slot and 888 Casino earned the Master Cup slot.',
    winner: { teamId: 20, teamName: '888 Casino' },
    runnerUp: { teamId: 8, teamName: 'Bwin' },
  },
  standout: [
    { label: 'Cup Winner', value: 'Bwin' },
    { label: 'Super Cup Winner', value: '888 Casino' },
    { label: 'Best Total Profit', value: '888 Casino (+28.40)' },
    { label: 'Best Single Profit', value: '888 Casino (+12.80)' },
  ],
  goalsOfSeason: [
    { division: 'Champions Bookies', teamId: 20, teamName: '888 Casino', profit: 12.8 },
    { division: 'Premier Bookies', teamId: 11, teamName: 'Paddy Power', profit: 9.1 },
    { division: 'Average Bookies', teamId: 5, teamName: 'Coral', profit: 6.6 },
  ],
  bookieDor: {
    weights: { league: 0.4, cup: 0.28, master: 0.32, consistency: 0 },
    winner: {
      teamId: 20, teamName: '888 Casino', division: 'Champions Bookies', score: 69.4,
      leagueScore: 36, cupScore: 3, masterScore: 30.4, consistencyScore: 0,
      weightedLeagueScore: 36, weightedCupScore: 3, weightedMasterScore: 30.4, weightedConsistencyScore: 0,
      leagueRank: 1, cupFinish: 'BookieBall Cup finalist',
    },
    leaderboard: [
      { teamId: 20, teamName: '888 Casino', division: 'Champions Bookies', score: 69.4, leagueScore: 36, cupScore: 3, masterScore: 30.4, consistencyScore: 0, weightedLeagueScore: 36, weightedCupScore: 3, weightedMasterScore: 30.4, weightedConsistencyScore: 0 },
      { teamId: 8, teamName: 'Bwin', division: 'Champions Bookies', score: 61.2, leagueScore: 30, cupScore: 6, masterScore: 25.2, consistencyScore: 0, weightedLeagueScore: 30, weightedCupScore: 6, weightedMasterScore: 25.2, weightedConsistencyScore: 0 },
      { teamId: 11, teamName: 'Paddy Power', division: 'Premier Bookies', score: 56.8, leagueScore: 24, cupScore: 3, masterScore: 29.8, consistencyScore: 0, weightedLeagueScore: 24, weightedCupScore: 3, weightedMasterScore: 29.8, weightedConsistencyScore: 0 },
      { teamId: 5, teamName: 'Coral', division: 'Average Bookies', score: 44.7, leagueScore: 18, cupScore: 1, masterScore: 25.7, consistencyScore: 0, weightedLeagueScore: 18, weightedCupScore: 1, weightedMasterScore: 25.7, weightedConsistencyScore: 0 },
    ],
  },
};

function SeasonFinalePage() {
  const [finale, setFinale] = useState<SeasonFinaleData | null>(null);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [liveState, setLiveState] = useState<AppState | null>(null);
  const [liveLeagueTable, setLiveLeagueTable] = useState<LeagueTableMap | null>(null);
  const [seasonLeagueFixtures, setSeasonLeagueFixtures] = useState<LeagueFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [autoplaySpeed, setAutoplaySpeed] = useState(9000);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      slideContainerRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.seasonFinale().catch(() => ({ pending: false } as SeasonFinaleResponse)),
      api.teams().catch(() => [] as TeamMeta[]),
      api.state().catch(() => null as AppState | null),
      api.leagueTable().catch(() => null as LeagueTableMap | null),
    ]).then(([seasonFinaleResponse, nextTeams, nextState, nextLeagueTable]) => {
      if (!active) return;
      if ('pending' in seasonFinaleResponse && seasonFinaleResponse.pending === false) {
        setFinale(null);
      } else {
        setFinale(seasonFinaleResponse as SeasonFinaleData);
      }
      setTeams(nextTeams);
      setLiveState(nextState);
      setLiveLeagueTable(nextLeagueTable);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const payload = finale?.payload ?? FALLBACK_FINALE_PAYLOAD;
  const previewMode = !finale;

  useEffect(() => {
    let active = true;
    api.leagueFixtures(undefined, true, payload.season)
      .then((fixtures) => { if (active) setSeasonLeagueFixtures(fixtures); })
      .catch(() => { if (active) setSeasonLeagueFixtures([]); });
    return () => { active = false; };
  }, [payload.season]);

  const paletteByTeamId = useMemo(() => new Map(teams.map((team) => [team.id, createPalette(team)])), [teams]);
  const paletteByName = useMemo(() => new Map(teams.map((team) => [team.name.toLowerCase(), createPalette(team)])), [teams]);

  const topDivisionChampion = useMemo(
    () => payload.leagueWinners.find((row) => /champions/i.test(row.division)) ?? payload.leagueWinners[0] ?? null,
    [payload],
  );

  const resolvePalette = (teamId: number | null | undefined, teamName: string): TeamPalette => {
    return (teamId ? paletteByTeamId.get(teamId) : null)
      ?? paletteByName.get(teamName.toLowerCase())
      ?? DEFAULT_TEAM_PALETTE;
  };

  const divisionTableMap: DivisionTableMap = useMemo(
    () => payload.divisionTables ?? ((liveState?.currentSeason === payload.season && liveLeagueTable) ? liveLeagueTable : {}),
    [liveLeagueTable, liveState?.currentSeason, payload.divisionTables, payload.season],
  );

  const divisionStoryByDivision: Map<string, DivisionStory> = useMemo(
    () => computeDivisionStories(divisionTableMap, seasonLeagueFixtures, resolvePalette),
    [divisionTableMap, seasonLeagueFixtures, resolvePalette],
  );

  const divisionSlides = useMemo(
    () => computeDivisionSlides(payload, divisionTableMap, divisionStoryByDivision, resolvePalette),
    [divisionStoryByDivision, divisionTableMap, payload, resolvePalette],
  );

  const promotionSpotlights = useMemo(
    () => computePromotionSpotlights(payload, divisionTableMap, divisionStoryByDivision),
    [divisionStoryByDivision, divisionTableMap, payload],
  );

  const mapStandingsRows = (rows: StandingsSummaryRow[]): TitleRaceRow[] => {
    return rows.slice().sort((left, right) => left.rank - right.rank).map((row, index, ordered) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      points: row.points,
      profit: row.profit,
      status: index === 0 ? 'champion' : (ordered.length >= 4 && index === 2 ? 'playoff' : index === ordered.length - 1 ? 'danger' : 'steady'),
      palette: resolvePalette(row.teamId, row.teamName),
    }));
  };

  const masterLeagueSummaryRows = useMemo(
    () => mapStandingsRows((payload.masterLeague?.table ?? []) as StandingsSummaryRow[]).slice(0, 8),
    [payload.masterLeague?.table],
  );

  const trioGroups = useMemo(
    () => groupByDivision(payload.trioLeague?.table ?? []).map((group) => ({
      division: group.division,
      rows: mapStandingsRows(group.rows as StandingsSummaryRow[]).slice(0, 4),
    })),
    [payload.trioLeague?.table],
  );

  const tierGroups = useMemo(
    () => groupByDivision(payload.tierLeague?.table ?? []).map((group) => ({
      division: group.division,
      rows: mapStandingsRows(group.rows as StandingsSummaryRow[]),
    })),
    [payload.tierLeague?.table],
  );
  const tierTopGroups = tierGroups.slice(0, 4);
  const tierLowerGroups = tierGroups.slice(4);

  const masterLeagueLeader = masterLeagueSummaryRows[0] ?? null;
  const masterLeagueChaser = masterLeagueSummaryRows[1] ?? null;
  const masterLeagueMargin = masterLeagueLeader && masterLeagueChaser ? masterLeagueLeader.points - masterLeagueChaser.points : null;

  const trioWinners = trioGroups.map((group) => ({ division: group.division, leader: group.rows[0] ?? null })).filter((g) => g.leader);
  const tierTopWinners = tierTopGroups.map((group) => ({ division: group.division, leader: group.rows[0] ?? null })).filter((g) => g.leader);
  const tierLowerWinners = tierLowerGroups.map((group) => ({ division: group.division, leader: group.rows[0] ?? null })).filter((g) => g.leader);

  const titleRaceRows = useMemo(() => {
    const liveRows = liveState?.currentSeason === payload.season && topDivisionChampion ? liveLeagueTable?.[topDivisionChampion.division] ?? null : null;
    if (liveRows && liveRows.length > 0) {
      return [...liveRows].sort((left, right) => left.rank - right.rank).map((row, index, rows) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        played: row.played, wins: row.wins, draws: row.draws, losses: row.losses,
        profit: row.profit, points: row.points,
        status: index === 0 ? 'champion' as const : (rows.length >= 4 && index === 2 ? 'playoff' as const : index === rows.length - 1 ? 'danger' as const : 'steady' as const),
        palette: resolvePalette(row.teamId, row.teamName),
      }));
    }
    const candidateEntries = uniqueTeamEntries([
      topDivisionChampion ? { teamId: topDivisionChampion.teamId, teamName: topDivisionChampion.teamName } : { teamId: 20, teamName: '888 Casino' },
      ...(payload.bookieDor?.leaderboard.map((row) => ({ teamId: row.teamId, teamName: row.teamName })) ?? []),
      ...(payload.bestProfits.overall ? [{ teamId: payload.bestProfits.overall.teamId, teamName: payload.bestProfits.overall.teamName }] : []),
      ...(payload.cupWinner ? [{ teamId: payload.cupWinner.teamId, teamName: payload.cupWinner.teamName }] : []),
      ...payload.promotions.map((row) => ({ teamId: row.teamId, teamName: row.teamName })),
      { teamId: 8, teamName: 'Bwin' },
      { teamId: 11, teamName: 'Paddy Power' },
    ]).slice(0, 6);
    const profitByName = new Map<string, number>();
    payload.bestProfits.byDivision.forEach((row) => profitByName.set(row.teamName.toLowerCase(), row.profit));
    if (payload.bestProfits.overall) profitByName.set(payload.bestProfits.overall.teamName.toLowerCase(), payload.bestProfits.overall.profit);
    payload.goalsOfSeason.forEach((row) => {
      const key = row.teamName.toLowerCase();
      if (!profitByName.has(key) || row.profit > (profitByName.get(key) ?? 0)) profitByName.set(key, row.profit);
    });
    const template = [
      { wins: 6, draws: 1, losses: 0, points: 19 },
      { wins: 5, draws: 1, losses: 1, points: 16 },
      { wins: 4, draws: 1, losses: 2, points: 13 },
      { wins: 3, draws: 2, losses: 2, points: 11 },
      { wins: 2, draws: 1, losses: 4, points: 7 },
      { wins: 1, draws: 1, losses: 5, points: 4 },
    ];
    return candidateEntries.map((entry, index, rows) => {
      const slot = template[index] ?? template[template.length - 1];
      const profit = profitByName.get(entry.teamName.toLowerCase()) ?? Number((14.5 - index * 2.45).toFixed(2));
      return {
        teamId: entry.teamId, teamName: entry.teamName, played: 7,
        wins: slot.wins, draws: slot.draws, losses: slot.losses,
        profit: Number(profit.toFixed(2)), points: slot.points,
        status: index === 0 ? 'champion' as const : (rows.length >= 4 && index === 2 ? 'playoff' as const : index === rows.length - 1 ? 'danger' as const : 'steady' as const),
        palette: resolvePalette(entry.teamId, entry.teamName),
      };
    });
  }, [liveLeagueTable, liveState?.currentSeason, payload, topDivisionChampion, paletteByName, paletteByTeamId]);

  const championRow = titleRaceRows[0] ?? null;
  const runnerUpRow = titleRaceRows[1] ?? null;
  const championName = championRow?.teamName ?? topDivisionChampion?.teamName ?? '888 Casino';
  const championPalette = championRow?.palette ?? resolvePalette(topDivisionChampion?.teamId ?? null, championName);
  const cupWinnerName = payload.cupWinner?.teamName ?? 'TBD';
  const superCupWinnerName = payload.superCup?.winner?.teamName ?? 'TBD';
  const biggestSwingTeam = payload.bestProfits.overall?.teamName ?? championName;
  const biggestSwingProfit = payload.bestProfits.overall?.profit ?? championRow?.profit ?? 0;
  const singleProfitLine = payload.standout.find((row) => /single/i.test(row.label))?.value ?? `${championName} (${formatSigned(biggestSwingProfit)})`;
  const swappedPlayoff = payload.playoffResults.find((row) => row.swapped) ?? null;
  const titleMargin = championRow && runnerUpRow ? championRow.points - runnerUpRow.points : 0;
  const profitEdge = championRow && runnerUpRow ? championRow.profit - runnerUpRow.profit : biggestSwingProfit;
  const championWinPct = championRow && championRow.played > 0 ? (championRow.wins / championRow.played) * 100 : 0;
  const bookieDorWinner = payload.bookieDor?.winner?.teamName ?? null;

  const seasonStory = `${championName} landed the headline act in ${displayDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} while ${cupWinnerName} owned the cup story, ${superCupWinnerName} opened the season in style, and ${biggestSwingTeam} delivered the biggest season swing.`;

  const coldOpenHeadlines = [
    `${uppercaseName(championName)} CROWNED CHAMPION`,
    `${uppercaseName(superCupWinnerName)} TOOK THE SUPER CUP`,
    `${uppercaseName(cupWinnerName)} LIFTED THE CUP`,
    swappedPlayoff
      ? `${uppercaseName(swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName)} FLIPPED THE PLAYOFF`
      : `${payload.promotions.length} PROMOTIONS SEALED ON FINAL DAY`,
  ];

  const tickerItems = [
    `${championName} closed ${displayDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} in style`,
    `${superCupWinnerName} landed the curtain-raiser`,
    `${cupWinnerName} finished with silverware`,
    `${payload.promotions.length} promotions • ${payload.relegations.length} relegations`,
    `${payload.bookieDor?.winner.teamName ?? championName} topped the Bookie d'Or chart`,
    singleProfitLine,
  ];

  const deskBlocks = [
    { title: 'Biggest Swing', value: `${biggestSwingTeam}`, note: `${formatSigned(biggestSwingProfit)} overall profit`, accent: 'gold' as const },
    { title: 'Shock Result', value: swappedPlayoff ? `${swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName}` : superCupWinnerName, note: swappedPlayoff ? `${swappedPlayoff.lowerTeamName} stole promotion` : `${superCupWinnerName} set the opening tone in the Super Cup`, accent: 'red' as const },
    { title: 'Final Day Stakes', value: `${payload.promotions.length + payload.relegations.length}`, note: `${payload.promotions.length} up • ${payload.relegations.length} down`, accent: 'blue' as const },
  ];

  const decisiveHeadline = swappedPlayoff ? `${swappedPlayoff.winnerTeamName ?? swappedPlayoff.lowerTeamName} changed the ladder` : `${biggestSwingTeam} delivered the defining blow`;
  const decisiveSubline = swappedPlayoff
    ? `${swappedPlayoff.upperTeamName} vs ${swappedPlayoff.lowerTeamName} turned promotion pressure into pure chaos.`
    : `${singleProfitLine} shifted the whole season narrative.`;

  const cupSummaryNames = uniqueTeamEntries([
    payload.cupWinner ? { teamId: payload.cupWinner.teamId, teamName: payload.cupWinner.teamName } : { teamId: null, teamName: championName },
    payload.superCup?.winner ? { teamId: payload.superCup.winner.teamId, teamName: payload.superCup.winner.teamName } : { teamId: null, teamName: superCupWinnerName },
    { teamId: championRow?.teamId ?? null, teamName: championName },
    { teamId: runnerUpRow?.teamId ?? null, teamName: runnerUpRow?.teamName ?? 'Paddy Power' },
    payload.bestProfits.overall ? { teamId: payload.bestProfits.overall.teamId, teamName: payload.bestProfits.overall.teamName } : { teamId: 11, teamName: 'Paddy Power' },
  ]);

  const cupPath = [
    { round: 'Super Cup', opponent: payload.superCup?.runnerUp?.teamName ?? cupSummaryNames[1]?.teamName ?? 'Bwin', score: payload.superCup?.winner ? 'Season opener won' : 'Curtain-raiser pending' },
    { round: 'Quarter-Final', opponent: cupSummaryNames[2]?.teamName ?? 'Paddy Power', score: '3.20 - 1.90' },
    { round: 'Semi-Final', opponent: cupSummaryNames[3]?.teamName ?? 'Bwin', score: '2.60 - 1.40' },
    { round: 'Winner', opponent: payload.cupWinner?.teamName ?? championName, score: 'Booked the trophy' },
  ];

  const rivalryLeft = championRow ?? {
    teamId: topDivisionChampion?.teamId ?? null, teamName: championName, played: 7, wins: 6, draws: 1, losses: 0,
    profit: biggestSwingProfit, points: 19, status: 'champion' as const, palette: championPalette,
  };
  const rivalryRight = runnerUpRow ?? {
    teamId: payload.cupWinner?.teamId ?? null, teamName: payload.cupWinner?.teamName ?? 'Bwin', played: 7, wins: 5, draws: 1, losses: 1,
    profit: Number((biggestSwingProfit - 4.2).toFixed(2)), points: 16, status: 'steady' as const,
    palette: resolvePalette(payload.cupWinner?.teamId ?? null, payload.cupWinner?.teamName ?? 'Bwin'),
  };

  const rivalryRecord = titleMargin >= 3 ? '2-1' : '1-1-1';
  const rivalryMargin = Math.max(0.75, Math.abs(profitEdge) / Math.max(titleRaceRows.length, 1));
  const bookieBallCupFinal = payload.bookieBallCup?.final ?? null;
  const masterCupFinal = payload.masterCup?.final ?? null;
  const upcomingSuperCup = payload.upcomingSuperCup ?? null;

  const legacyLine = [
    `${displayDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} title`,
    payload.superCup?.winner?.teamName === championName ? 'Super Cup winner' : null,
    payload.cupWinner?.teamName === championName ? 'League & Cup double' : null,
    bookieDorWinner === championName ? "Bookie d'Or winner" : null,
  ].filter(Boolean).join(' • ');

  function summarizeCupResult(decidedBy: string | null | undefined, played: boolean, winnerTeam: string | null | undefined): string {
    if (!played) return 'Awaiting final';
    if (!winnerTeam) return 'Final unresolved';
    switch (decidedBy) {
      case 'penalties': case 'aggregate_penalties': return 'Won on penalties';
      case 'spins': case 'aggregate_spins': return 'Won on spins';
      case 'aggregate_profit': return 'Won on aggregate';
      case 'profit': default: return 'Won in regulation';
    }
  }

  const slides = useMemo<SlideDefinition[]>(() => [
    {
      id: 'cold-open',
      label: 'Cold Open',
      node: (
        <SlideCanvas accent="blue">
          <div style={{ display: 'grid', gap: '22px', height: '100%', justifyItems: 'center', alignContent: 'space-between' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ display: 'inline-flex', padding: '0.4rem 0.75rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.14)', color: '#f8fbff', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 900, fontSize: '0.68rem', background: 'linear-gradient(180deg, rgba(24,38,62,0.82), rgba(7,12,20,0.82))', backdropFilter: 'blur(8px)' }}>BookieBall Finale</span>
              <span style={{ color: 'rgba(240,247,255,0.68)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, fontSize: '0.76rem' }}>{previewMode ? 'Prototype Preview' : `Live Season ${payload.season}`}</span>
            </div>
            <div style={{ display: 'grid', gap: '18px', justifyItems: 'center', textAlign: 'center', paddingTop: '8px' }}>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...slideTransition, delay: 0.1 }} style={{ display: 'grid', gap: '16px' }}>
                <span style={{ color: '#f5dc92', textTransform: 'uppercase', letterSpacing: '0.24em', fontWeight: 900, fontSize: '0.82rem' }}>End of Season Presentation</span>
                <h1 style={{ margin: 0, color: '#f8fbff', fontSize: 'clamp(3.2rem, 7vw, 6.6rem)', lineHeight: 0.88, letterSpacing: '-0.06em', fontWeight: 950, textTransform: 'uppercase', textShadow: '0 18px 38px rgba(0,0,0,0.42)' }}>BookieBall Season Finale</h1>
                <p style={{ margin: 0, color: 'rgba(234,242,255,0.74)', fontSize: '1.05rem', letterSpacing: '0.04em' }}>Eight gameweeks. One champion. One story.</p>
              </motion.div>
              <motion.div
                aria-hidden
                style={{ width: '240px', height: '1.5px', borderRadius: '999px', background: 'linear-gradient(90deg, transparent, rgba(255,223,140,0.7), transparent)' }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <TickerBar items={coldOpenHeadlines} accent="gold" />
          </div>
        </SlideCanvas>
      ),
    },
    ...divisionSlides.flatMap((divisionSlide) => {
      const accent: PanelTone = /champions/i.test(divisionSlide.winner.division) ? 'gold' : 'blue';
      return [
        {
          id: `division-story-${divisionSlide.winner.division}`,
          label: `${displayDivisionName(divisionSlide.winner.division)} Story`,
          node: (
            <SlideCanvas accent={accent}>
              <HeaderBar kicker="Division Story" title={`${displayDivisionName(divisionSlide.winner.division)} Showcase`} subtitle="Opening pace-setter, title turn, and the form runs that shaped the campaign." accent={accent} tag={payload.season} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.04fr 0.96fr', gap: '18px', flex: 1 }}>
                <ShowcaseHeroPanel accent={accent} eyebrow={`${payload.season} division winners`} headline={divisionSlide.winner.teamName} copy={`${divisionSlide.earlyLeaderStory} ${divisionSlide.chaseStory}`} teamName={divisionSlide.winner.teamName} palette={divisionSlide.championPalette} chips={[{ label: 'Opening Leader', value: divisionSlide.earlyLeader?.teamName ?? 'TBD' }, { label: 'Champion', value: divisionSlide.winner.teamName }, { label: 'Final Margin', value: divisionSlide.runnerUp ? (divisionSlide.titleMargin === 0 ? 'Level' : `${divisionSlide.titleMargin} pts`) : 'Clear' }]} />
                <div style={{ display: 'grid', gap: '14px' }}>
                  <BroadcastPanel title="Form Story" subtitle="Peak and slump of the season" accent={accent}>
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      <div style={{ padding: '0.7rem 0.8rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(249,221,145,0.12), rgba(121,78,18,0.1))' }}>
                        <span style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 900, fontSize: '0.65rem' }}>Best Run</span>
                        <strong style={{ display: 'block', color: '#f8fbff', marginTop: '0.25rem' }}>{divisionSlide.hotRun ? `${divisionSlide.hotRun.teamName} (${divisionSlide.hotRun.form}) ${divisionSlide.hotRun.range}` : 'No hot run recorded'}</strong>
                      </div>
                      <div style={{ padding: '0.7rem 0.8rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(233,100,92,0.12), rgba(97,18,24,0.1))' }}>
                        <span style={{ color: '#ff9d96', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 900, fontSize: '0.65rem' }}>Toughest Spell</span>
                        <strong style={{ display: 'block', color: '#f8fbff', marginTop: '0.25rem' }}>{divisionSlide.coldRun ? `${divisionSlide.coldRun.teamName} (${divisionSlide.coldRun.form}) ${divisionSlide.coldRun.range}` : 'No cold run recorded'}</strong>
                      </div>
                    </div>
                  </BroadcastPanel>
                  <BroadcastPanel title="Season Notes" subtitle="Division context" accent={accent}>
                    <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5, display: 'grid', gap: '0.5rem' }}>
                      <div>{divisionSlide.profitStory}</div>
                      <div>{divisionSlide.peakStory}</div>
                      {divisionSlide.movementStory.map((line, i) => <div key={`movement-${i}`}>{line}</div>)}
                    </div>
                  </BroadcastPanel>
                </div>
              </div>
            </SlideCanvas>
          ),
        },
        {
          id: `division-journey-${divisionSlide.winner.division}`,
          label: `${displayDivisionName(divisionSlide.winner.division)} Journey`,
          node: (
            <SlideCanvas accent={accent}>
              <HeaderBar kicker="Division Journey" title={`${displayDivisionName(divisionSlide.winner.division)} Week by Week`} subtitle="Tracking the rank movements across the entire season." accent={accent} tag={payload.season} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: '18px', flex: 1 }}>
                <DivisionJourneyPanel division={divisionSlide.winner.division} teams={divisionSlide.journeyTeams} gwLabels={divisionSlide.gwLabels} />
                <div style={{ display: 'grid', gap: '14px' }}>
                  <BroadcastPanel title="Opening Pace" subtitle="GW1 snapshot" accent={accent}>
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      <StatTile label="GW1 Leader" value={divisionSlide.earlyLeader?.teamName ?? 'TBD'} note="Set the early pace" accent={accent} />
                      <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{divisionSlide.earlyLeaderStory}</div>
                    </div>
                  </BroadcastPanel>
                  <BroadcastPanel title="Closing Verdict" subtitle="Champion crowned" accent={accent}>
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      <StatTile label="Champion" value={divisionSlide.winner.teamName} note={`Won the ${displayDivisionName(divisionSlide.winner.division)} title`} accent={accent} />
                      <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{divisionSlide.chaseStory}</div>
                    </div>
                  </BroadcastPanel>
                </div>
              </div>
            </SlideCanvas>
          ),
        },
        {
          id: `division-table-${divisionSlide.winner.division}`,
          label: `${displayDivisionName(divisionSlide.winner.division)} Table`,
          node: (
            <SlideCanvas accent={accent}>
              <HeaderBar kicker="Division Table" title={`${displayDivisionName(divisionSlide.winner.division)} Final Standings`} subtitle="The final league table for this division." accent={accent} tag={payload.season} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.14fr 0.86fr', gap: '18px', flex: 1 }}>
                <LeagueTable title="Standings" rows={divisionSlide.rows} />
                <div style={{ display: 'grid', gap: '14px' }}>
                  <StatTile label="Champion" value={divisionSlide.winner.teamName} note="Division winner" accent={accent} />
                  <StatTile label="Opening Leader" value={divisionSlide.earlyLeader?.teamName ?? 'TBD'} note="GW1 pace-setter" accent={accent} />
                  <StatTile label="Best Return" value={divisionSlide.bestProfit ? `${divisionSlide.bestProfit.teamName} (${formatSigned(divisionSlide.bestProfit.profit)})` : 'TBD'} note="Top profit in division" accent={accent} />
                  <BroadcastPanel title="Final Verdict" subtitle="Division notes" accent={accent}>
                    <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{divisionSlide.storyHeadline}. {divisionSlide.chaseStory}</div>
                  </BroadcastPanel>
                </div>
              </div>
            </SlideCanvas>
          ),
        },
      ];
    }),
    {
      id: 'studio-desk',
      label: 'Studio Desk',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar kicker="Studio Desk" title="Season Story" subtitle="The narrative arc that defined the campaign." accent="steel" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '18px', flex: 1 }}>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                {deskBlocks.map((block) => <StatTile key={block.title} label={block.title} value={block.value} note={block.note} accent={block.accent} />)}
              </div>
              <TickerBar items={tickerItems} accent="steel" />
            </div>
            <BroadcastPanel title="Season Story" subtitle="Narrative summary" accent="steel">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <p style={{ margin: 0, color: 'rgba(228,238,255,0.82)', lineHeight: 1.6 }}>{seasonStory}</p>
                <div style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                  <span style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 900, fontSize: '0.68rem' }}>Editorial Focus</span>
                  <p style={{ margin: '0.35rem 0 0', color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{decisiveHeadline}. {decisiveSubline}</p>
                </div>
              </div>
            </BroadcastPanel>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'title-race',
      label: 'Title Race',
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar kicker="Title Race" title={`${displayDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} Final Table`} subtitle="The top-flight race from start to finish." accent="gold" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.22fr 0.78fr', gap: '18px', flex: 1 }}>
            <LeagueTable title="Standings" rows={titleRaceRows} />
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Won Title By" value={titleMargin === 0 ? 'Level' : `${titleMargin} pts`} note={runnerUpRow ? `Over ${runnerUpRow.teamName}` : 'Uncontested'} accent="gold" />
              <StatTile label="Profit Edge" value={formatSigned(profitEdge)} note="Profit gap over runner-up" accent="steel" />
              <StatTile label="Decisive GW" value={swappedPlayoff ? 'Playoff' : 'Consistent'} note={swappedPlayoff ? 'Final day flips' : 'Steady throughout'} accent="blue" />
              <BroadcastPanel title="Champion Insight" subtitle="The winner's story" accent="gold">
                <div style={{ display: 'grid', gap: '0.65rem', alignItems: 'center', gridTemplateColumns: 'auto 1fr' }}>
                  <TeamOrb name={championName} palette={championPalette} size={48} champion />
                  <div>
                    <strong style={{ color: '#f8fbff', display: 'block' }}>{championName}</strong>
                    <span style={{ color: 'rgba(228,238,255,0.78)', fontSize: '0.85rem' }}>{championRow?.wins ?? 0} wins • {formatSigned(championRow?.profit ?? 0)} profit • {championRow?.points ?? 0} pts</span>
                  </div>
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'master-league',
      label: 'Master League',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar kicker="Master League" title="Final Master League Story" subtitle="The cross-division table that measured the whole field." accent="steel" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '18px', flex: 1 }}>
            {masterLeagueSummaryRows.length > 0 ? <LeagueTable title="Top 8" rows={masterLeagueSummaryRows} /> : <BroadcastPanel title="Master League" subtitle="No data" accent="steel"><div style={{ color: 'rgba(228,238,255,0.78)' }}>Master League table is not available for this finale.</div></BroadcastPanel>}
            <div style={{ display: 'grid', gap: '14px' }}>
              {masterLeagueLeader ? (
                <ShowcaseHeroPanel accent="steel" eyebrow="Master League winner" headline={masterLeagueLeader.teamName} copy={`${masterLeagueLeader.teamName} topped the Master League with ${masterLeagueLeader.points} points, leading across all divisions.${masterLeagueChaser ? ` ${masterLeagueChaser.teamName} finished ${masterLeagueMargin !== null && masterLeagueMargin > 0 ? `${masterLeagueMargin} points back` : 'close behind in second'}.` : ''}`} teamName={masterLeagueLeader.teamName} palette={masterLeagueLeader.palette} chips={[{ label: 'Final Points', value: `${masterLeagueLeader.points}` }, { label: 'Profit', value: formatSigned(masterLeagueLeader.profit) }, { label: 'Margin', value: masterLeagueMargin !== null ? `${masterLeagueMargin} pts` : 'N/A' }]} />
              ) : <BroadcastPanel title="Master League" subtitle="Winner pending" accent="steel"><div style={{ color: 'rgba(228,238,255,0.78)' }}>Master League winner has not been determined yet.</div></BroadcastPanel>}
              <BroadcastPanel title="Whole-League Story" subtitle="Cross-division verdict" accent="steel">
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>
                  {masterLeagueLeader ? `${masterLeagueLeader.teamName} led the Master League race across all ${payload.leagueWinners.length > 0 ? `${payload.leagueWinners.length} divisions` : 'the divisions'}.${masterLeagueChaser ? ` ${masterLeagueChaser.teamName} gave chase but ultimately finished behind.` : ''}` : 'The Master League story is still being written.'}
                </div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'trio-league',
      label: 'Trio League',
      node: (
        <SlideCanvas accent="red">
          <HeaderBar kicker="Trio League" title="Trio League Final Snapshot" subtitle="Three divisions, one final trio picture." accent="red" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', flex: 1 }}>
            {trioWinners.length > 0 ? (
              <BroadcastPanel title="Trio Winners" subtitle="Who topped each band" accent="red">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  {trioWinners.map((group) => (
                    <div key={`trio-winner-${group.division}`} style={{ display: 'grid', gap: '0.42rem', padding: '0.86rem 0.9rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                      <div style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.66rem' }}>{group.division}</div>
                      <strong style={{ color: '#f8fbff', fontSize: '1.12rem' }}>{group.leader?.teamName ?? 'TBD'}</strong>
                      <span style={{ color: 'rgba(255,236,233,0.78)' }}>{group.leader ? `${group.leader.points} pts • ${formatSigned(group.leader.profit)}` : 'No winner recorded'}</span>
                    </div>
                  ))}
                </div>
              </BroadcastPanel>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              {trioGroups.length > 0 ? trioGroups.map((group) => (
                <CompactStandingsBoard key={`trio-${group.division}`} title={group.division} rows={group.rows} accent="red" subtitle="Final trio order" />
              )) : (
                <BroadcastPanel title="Trio League" subtitle="Competition status" accent="red" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(255,236,233,0.82)' }}>Trio League data is not available for this finale.</div>
                </BroadcastPanel>
              )}
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'tier-league-top',
      label: 'Tier League Top',
      node: (
        <SlideCanvas accent="onyx">
          <HeaderBar kicker="Tier League" title="Tier League — Top Half" subtitle="Legendary down to Superior." accent="onyx" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', flex: 1 }}>
            {tierTopWinners.length > 0 ? (
              <BroadcastPanel title="Top-Half Tier Winners" subtitle="Division leaders" accent="onyx">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
                  {tierTopWinners.map((group) => (
                    <div key={`tier-top-winner-${group.division}`} style={{ display: 'grid', gap: '0.35rem', padding: '0.82rem 0.86rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                      <div style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.64rem' }}>{group.division}</div>
                      <strong style={{ color: '#f8fbff' }}>{group.leader?.teamName ?? 'TBD'}</strong>
                      <span style={{ color: 'rgba(235,242,255,0.74)' }}>{group.leader ? `${group.leader.points} pts` : 'No winner'}</span>
                    </div>
                  ))}
                </div>
              </BroadcastPanel>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {tierTopGroups.length > 0 ? tierTopGroups.map((group) => (
                <CompactStandingsBoard key={`tier-top-${group.division}`} title={group.division} rows={group.rows} accent="onyx" subtitle="Final tier order" />
              )) : (
                <BroadcastPanel title="Tier League" subtitle="Competition status" accent="onyx" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(235,242,255,0.78)' }}>Tier League data is not available for this finale.</div>
                </BroadcastPanel>
              )}
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'tier-league-bottom',
      label: 'Tier League Lower',
      node: (
        <SlideCanvas accent="onyx">
          <HeaderBar kicker="Tier League" title="Tier League — Lower Half" subtitle="Standard down to Awful." accent="onyx" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '16px', flex: 1 }}>
            {tierLowerWinners.length > 0 ? (
              <BroadcastPanel title="Lower-Half Tier Winners" subtitle="Division leaders" accent="onyx">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
                  {tierLowerWinners.map((group) => (
                    <div key={`tier-lower-winner-${group.division}`} style={{ display: 'grid', gap: '0.35rem', padding: '0.82rem 0.86rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}>
                      <div style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 900, fontSize: '0.64rem' }}>{group.division}</div>
                      <strong style={{ color: '#f8fbff' }}>{group.leader?.teamName ?? 'TBD'}</strong>
                      <span style={{ color: 'rgba(235,242,255,0.74)' }}>{group.leader ? `${group.leader.points} pts` : 'No winner'}</span>
                    </div>
                  ))}
                </div>
              </BroadcastPanel>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {tierLowerGroups.length > 0 ? tierLowerGroups.map((group) => (
                <CompactStandingsBoard key={`tier-lower-${group.division}`} title={group.division} rows={group.rows} accent="onyx" subtitle="Final tier order" />
              )) : (
                <BroadcastPanel title="Tier League" subtitle="Competition status" accent="onyx" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'rgba(235,242,255,0.78)' }}>Tier League data is not available for this finale.</div>
                </BroadcastPanel>
              )}
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    ...promotionSpotlights.map((promotion) => ({
      id: `promotion-${promotion.teamName}`,
      label: `${promotion.teamName} Promoted`,
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar kicker="Promotion Story" title={`${promotion.teamName} Go Up`} subtitle={`${promotion.teamName} secured promotion from ${displayDivisionName(promotion.from)} to ${displayDivisionName(promotion.to)}.`} accent="gold" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.04fr 0.96fr', gap: '18px', flex: 1 }}>
            <ShowcaseHeroPanel accent="gold" eyebrow={`${payload.season} promotion`} headline={promotion.teamName} copy={promotion.playoffTie ? `${promotion.teamName} flipped the playoff bracket to secure promotion.` : `${promotion.teamName} earned automatic promotion through the final standings.`} teamName={promotion.teamName} palette={resolvePalette(promotion.teamId, promotion.teamName)} chips={[{ label: 'Started', value: promotion.startRank ? `${promotion.startRank}${promotion.startRank === 1 ? 'st' : promotion.startRank === 2 ? 'nd' : promotion.startRank === 3 ? 'rd' : 'th'}` : 'TBD' }, { label: 'Finished', value: promotion.finalRank ? `${promotion.finalRank}${promotion.finalRank === 1 ? 'st' : promotion.finalRank === 2 ? 'nd' : promotion.finalRank === 3 ? 'rd' : 'th'}` : 'TBD' }, { label: 'Destination', value: displayDivisionName(promotion.to) }]} />
            <div style={{ display: 'grid', gap: '14px' }}>
              <BroadcastPanel title="Promotion Route" subtitle="How they got there" accent="gold">
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{promotion.playoffTie ? `Won the playoff against ${promotion.playoffTie.upperTeamName} to swap divisions.` : `Finished ${promotion.finalRank ? `${promotion.finalRank}th` : 'high enough'} in ${displayDivisionName(promotion.from)} to move up automatically.`}</div>
              </BroadcastPanel>
              <BroadcastPanel title="Form Burst" subtitle="Peak window" accent="gold">
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {promotion.hotRun ? (
                    <>
                      <strong style={{ color: '#f8fbff' }}>{promotion.hotRun.form}</strong>
                      <span style={{ color: 'rgba(228,238,255,0.78)' }}>{promotion.hotRun.range} • {promotion.hotRun.points} points from 3</span>
                    </>
                  ) : <span style={{ color: 'rgba(228,238,255,0.78)' }}>Hot run data not isolated for this team.</span>}
                </div>
              </BroadcastPanel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <StatTile label="Final Points" value={promotion.points !== null ? `${promotion.points}` : 'TBD'} note="Season total" accent="gold" />
                <StatTile label="Final Profit" value={promotion.profit !== null ? formatSigned(promotion.profit) : 'TBD'} note="Season return" accent="steel" />
              </div>
            </div>
          </div>
        </SlideCanvas>
      ),
    })),
    {
      id: 'turning-point',
      label: 'Turning Point',
      node: (
        <SlideCanvas accent="red">
          <HeaderBar kicker="Decisive Moment" title="The Turning Point" subtitle="One moment changed the tone of the whole finale." accent="red" tag="Peak Slide" />
          <div style={{ display: 'grid', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Turning Point" subtitle="Signature Storyline" accent="red" style={{ minHeight: '280px' }}>
              <div style={{ display: 'grid', gap: '1rem', alignContent: 'center', minHeight: '220px' }}>
                <span style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 900, fontSize: '0.74rem' }}>The headline moment</span>
                <h2 style={{ margin: 0, color: '#fff6ed', fontSize: 'clamp(2.3rem, 4.1vw, 4.6rem)', lineHeight: 0.92, fontWeight: 950, letterSpacing: '-0.06em', textTransform: 'uppercase' }}>{decisiveHeadline}</h2>
                <p style={{ margin: 0, color: 'rgba(255,236,233,0.82)', fontSize: '1rem', lineHeight: 1.55, maxWidth: '720px' }}>{decisiveSubline}</p>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              <StatTile label="Promotions" value={`${payload.promotions.length}`} note="Teams moving up" accent="gold" />
              <StatTile label="Relegations" value={`${payload.relegations.length}`} note="Teams dropping down" accent="steel" />
              <StatTile label="Playoff Swaps" value={`${payload.playoffResults.filter((row) => row.swapped).length}`} note="Promotion places flipped" accent="blue" />
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'bookieball-cup',
      label: 'BookieBall Cup',
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar kicker="BookieBall Cup" title="BookieBall Cup Final" subtitle="The main knockout story from the season." accent="gold" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Final" subtitle={bookieBallCupFinal?.decidedBy ?? 'Pending'} accent="gold">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fbff', textAlign: 'right' }}>{bookieBallCupFinal?.homeTeam ?? 'TBD'}</strong>
                  <span style={{ color: '#f5d38f', fontWeight: 900 }}>{bookieBallCupFinal ? `${formatSigned(bookieBallCupFinal.homeProfit)} - ${formatSigned(bookieBallCupFinal.awayProfit)}` : 'TBD'}</span>
                  <strong style={{ color: '#f8fbff' }}>{bookieBallCupFinal?.awayTeam ?? 'TBD'}</strong>
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.45 }}>{summarizeCupResult(bookieBallCupFinal?.decidedBy, bookieBallCupFinal?.played ?? false, bookieBallCupFinal?.winnerTeam)}</div>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Winner" value={payload.bookieBallCup?.winner?.teamName ?? payload.cupWinner?.teamName ?? 'TBD'} note="Lifted the cup" accent="gold" />
              <StatTile label="Runner-up" value={payload.bookieBallCup?.runnerUp?.teamName ?? 'TBD'} note="Finished second" accent="steel" />
              <BroadcastPanel title="Cup Story" subtitle="Final note" accent="onyx">
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{payload.bookieBallCup?.winner?.teamName ?? payload.cupWinner?.teamName ?? 'The winner'} closed the main knockout bracket and secured the season's headline cup silverware.</div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'master-cup',
      label: 'Master Cup',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar kicker="Master Cup" title="Master Cup Final" subtitle="The seeded prestige knockout settled at the top end." accent="steel" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Final" subtitle={masterCupFinal?.decidedBy ?? 'Pending'} accent="steel">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fbff', textAlign: 'right' }}>{masterCupFinal?.homeTeam ?? 'TBD'}</strong>
                  <span style={{ color: '#f8fbff', fontWeight: 900 }}>{masterCupFinal ? `${formatSigned(masterCupFinal.homeProfit)} - ${formatSigned(masterCupFinal.awayProfit)}` : 'TBD'}</span>
                  <strong style={{ color: '#f8fbff' }}>{masterCupFinal?.awayTeam ?? 'TBD'}</strong>
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.45 }}>{summarizeCupResult(masterCupFinal?.decidedBy, masterCupFinal?.played ?? false, masterCupFinal?.winnerTeam)}</div>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Winner" value={payload.masterCup?.winner?.teamName ?? 'TBD'} note="Prestige cup winners" accent="steel" />
              <StatTile label="Runner-up" value={payload.masterCup?.runnerUp?.teamName ?? 'TBD'} note="Finalists" accent="blue" />
              <BroadcastPanel title="Cup Story" subtitle="Seeded showdown" accent="onyx">
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{payload.masterCup?.winner?.teamName ?? 'The winner'} came through the seeded bracket and finished the prestige cup run on top.</div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'super-cup-preview',
      label: 'Super Cup',
      node: (
        <SlideCanvas accent="onyx">
          <HeaderBar kicker="Super Cup" title="Next Season Curtain Raiser" subtitle="The opening prestige fixture is now confirmed." accent="onyx" tag={upcomingSuperCup?.season ?? 'Next season'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Confirmed Pairing" subtitle="Season opener" accent="onyx">
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fbff', textAlign: 'right' }}>{upcomingSuperCup?.homeTeam ?? 'TBD'}</strong>
                  <span style={{ color: '#f5d38f', fontWeight: 900 }}>VS</span>
                  <strong style={{ color: '#f8fbff' }}>{upcomingSuperCup?.awayTeam ?? 'TBD'}</strong>
                </div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.45 }}>{upcomingSuperCup?.pairingExplanation ?? 'The Super Cup pairing will be confirmed once both cup winners are locked.'}</div>
              </div>
            </BroadcastPanel>
            <div style={{ display: 'grid', gap: '14px' }}>
              <StatTile label="Source Season" value={upcomingSuperCup?.sourceSeason ?? payload.season} note="Where qualification came from" accent="gold" />
              <StatTile label="Pairing Rule" value={upcomingSuperCup?.pairingReason?.replace(/_/g, ' ') ?? 'Pending'} note="Qualification logic" accent="steel" />
              <BroadcastPanel title="Editorial Note" subtitle="Curtain raiser" accent="blue" style={{ flex: 1 }}>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>The Super Cup stays separate from both main cup structures and launches the next season as the standalone champions clash.</div>
              </BroadcastPanel>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'bookie-dor',
      label: "Bookie d'Or",
      node: (
        <SlideCanvas accent="gold">
          <HeaderBar kicker="Bookie d'Or" title="Season Awards Table" subtitle="Weighted overall honours across divisions, cups, and Master League." accent="gold" tag={payload.season} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="Winner" subtitle="Overall honours leader" accent="gold">
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <strong style={{ color: '#f8fbff', fontSize: '1.8rem', lineHeight: 0.95 }}>{payload.bookieDor?.winner.teamName ?? 'TBD'}</strong>
                <div style={{ color: '#f5d38f', fontWeight: 900 }}>{payload.bookieDor?.winner ? `${payload.bookieDor.winner.score.toFixed(1)} points` : 'No winner'}</div>
                <div style={{ color: 'rgba(228,238,255,0.78)', lineHeight: 1.5 }}>{payload.bookieDor?.winner ? `${payload.bookieDor.winner.teamName} led the weighted honours model through divisions, cups, and Master League.` : "Bookie d'Or standings are unavailable."}</div>
              </div>
            </BroadcastPanel>
            <BroadcastPanel title="Top Five" subtitle="Final leaderboard" accent="steel">
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {(payload.bookieDor?.leaderboard ?? []).map((row, index) => (
                  <div key={`bookie-dor-${row.teamId}`} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.7rem', borderRadius: '14px', background: index === 0 ? 'linear-gradient(180deg, rgba(249,221,145,0.2), rgba(121,78,18,0.16))' : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: index === 0 ? '#f5d38f' : '#f8fbff', fontWeight: 900 }}>{index + 1}</span>
                    <strong style={{ color: '#f8fbff' }}>{row.teamName}</strong>
                    <span style={{ color: '#f5d38f', fontWeight: 900 }}>{row.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </BroadcastPanel>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'cup-rivalry',
      label: 'Cup & Rivalry',
      node: (
        <SlideCanvas accent="steel">
          <HeaderBar kicker="Cup & Rivalry" title="Silverware and Season Duel" subtitle="Compact summary boards built like a final broadcast split screen." accent="steel" tag="Dual View" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1 }}>
            <BroadcastPanel title="BookieBall Cup" subtitle="Route to glory" accent="gold" style={{ minHeight: '100%' }}>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {cupPath.map((step, index) => (
                  <div key={step.round} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '0.8rem', alignItems: 'center', padding: '0.75rem 0.8rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: index === cupPath.length - 1 ? 'linear-gradient(180deg, rgba(247,219,142,0.22), rgba(120,78,17,0.16))' : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
                    <span style={{ color: '#f2dc9b', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.7rem' }}>{step.round}</span>
                    <span style={{ color: '#f8fbff', fontWeight: 800 }}>{step.opponent}</span>
                    <span style={{ color: 'rgba(233,241,255,0.78)', fontWeight: 800 }}>{step.score}</span>
                  </div>
                ))}
              </div>
            </BroadcastPanel>
            <BroadcastPanel title="Rivalry Desk" subtitle="Season duel graphic" accent="red" style={{ minHeight: '100%' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: '0.55rem' }}>
                    <TeamOrb name={rivalryLeft.teamName} palette={rivalryLeft.palette} size={72} champion={rivalryLeft.status === 'champion'} />
                    <strong style={{ color: '#f8fbff', textAlign: 'center' }}>{uppercaseName(rivalryLeft.teamName)}</strong>
                  </div>
                  <div style={{ color: '#f5d38f', fontWeight: 950, fontSize: '2rem', letterSpacing: '-0.06em' }}>VS</div>
                  <div style={{ display: 'grid', justifyItems: 'center', gap: '0.55rem' }}>
                    <TeamOrb name={rivalryRight.teamName} palette={rivalryRight.palette} size={72} />
                    <strong style={{ color: '#f8fbff', textAlign: 'center' }}>{uppercaseName(rivalryRight.teamName)}</strong>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  <StatTile label="Record" value={rivalryRecord} note="Season head-to-head" accent="red" />
                  <StatTile label="Avg Margin" value={formatSigned(rivalryMargin)} note="Average profit gap" accent="steel" />
                  <StatTile label="Storyline" value="Title Pace" note="Race that framed the season" accent="blue" />
                </div>
              </div>
            </BroadcastPanel>
          </div>
        </SlideCanvas>
      ),
    },
    {
      id: 'champion-finale',
      label: 'Champion Finale',
      node: (
        <SlideCanvas accent="gold">
          <div style={{ display: 'grid', gap: '18px', height: '100%', alignContent: 'space-between' }}>
            <HeaderBar kicker="Champion Finale" title={uppercaseName(championName)} subtitle="The last frame of the season package." accent="gold" tag={`Season ${payload.season.replace('S', '')} Champions`} />
            <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.1fr 0.95fr', gap: '18px', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <StatTile label="Final Position" value="#1" note={displayDivisionName(topDivisionChampion?.division ?? 'Champions Bookies')} accent="gold" />
                <StatTile label="Total Profit" value={formatSigned(championRow?.profit ?? biggestSwingProfit)} note="Final top-flight number" accent="steel" />
              </div>
              <BroadcastPanel accent="gold" style={{ minHeight: '360px' }}>
                <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center', textAlign: 'center', minHeight: '320px', alignContent: 'center' }}>
                  <TeamOrb name={championName} palette={championPalette} size={96} champion />
                  <TrophyMark accent={championPalette.ringColor} />
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <strong style={{ color: '#f8fbff', fontSize: 'clamp(2.3rem, 4.5vw, 4.8rem)', lineHeight: 0.9, letterSpacing: '-0.06em', textTransform: 'uppercase', fontWeight: 950 }}>{uppercaseName(championName)}</strong>
                    <span style={{ color: '#f4d887', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 900, fontSize: '0.8rem' }}>Season {payload.season.replace('S', '')} Champions</span>
                  </div>
                </div>
              </BroadcastPanel>
              <div style={{ display: 'grid', gap: '14px' }}>
                <StatTile label="Win Percentage" value={formatPercent(championWinPct)} note="Top-flight strike rate" accent="blue" />
                <StatTile label="Legacy" value={legacyLine || 'Title Winners'} note="Season summary line" accent="onyx" />
              </div>
            </div>
          </div>
        </SlideCanvas>
      ),
    },
  ], [
    biggestSwingProfit, biggestSwingTeam, bookieBallCupFinal, championName, championPalette,
    championRow?.profit, championWinPct, coldOpenHeadlines, cupPath, cupWinnerName, deskBlocks,
    decisiveHeadline, decisiveSubline, divisionSlides, legacyLine, masterCupFinal,
    masterLeagueChaser?.teamName, masterLeagueMargin, masterLeagueSummaryRows, payload,
    promotionSpotlights, payload.promotions.length, payload.relegations.length, payload.season,
    previewMode, profitEdge, rivalryLeft.palette, rivalryLeft.status, rivalryLeft.teamName,
    rivalryMargin, rivalryRecord, rivalryRight.palette, rivalryRight.teamName,
    runnerUpRow?.teamName, seasonStory, singleProfitLine, swappedPlayoff,
    tierLowerGroups, tierLowerWinners, tierTopGroups, tierTopWinners,
    tickerItems, titleMargin, titleRaceRows, topDivisionChampion?.division,
    trioGroups, trioWinners, upcomingSuperCup,
  ]);

  const activeSlide = slides[slideIndex] ?? slides[0] ?? null;

  useEffect(() => {
    if (slides.length === 0 || !isPlaying || loading || isHovering) return;
    setProgress(0);
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, autoplaySpeed);
    return () => window.clearInterval(timer);
  }, [isPlaying, loading, slides.length, autoplaySpeed, isHovering]);

  useEffect(() => {
    if (slides.length === 0 || !isPlaying || loading || isHovering) {
      setProgress(0);
      return;
    }
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      setProgress(Math.min(elapsed / autoplaySpeed, 1));
      if (elapsed < autoplaySpeed) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, loading, slides.length, autoplaySpeed, isHovering, slideIndex]);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length > 0) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  useEffect(() => {
    if (loading) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); setSlideIndex((prev) => (prev + 1) % slides.length); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length); }
      else if (event.key === ' ') { event.preventDefault(); setIsPlaying((prev) => !prev); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [loading, slides.length]);

  return (
    <section style={{ minHeight: '100vh', padding: '24px', background: 'radial-gradient(circle at top, rgba(20, 38, 65, 0.7), rgba(4, 6, 12, 1) 55%)', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(1440px, 95vw)', display: 'grid', gap: '16px' }}>
        <div
          ref={slideContainerRef}
          style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              zIndex: 20,
              borderRadius: '999px',
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, rgba(245,211,143,0.7), rgba(203,212,231,0.7))',
                width: `${progress * 100}%`,
                transition: 'width 80ms linear',
              }}
            />
          </div>
          {loading ? (
            <SlideCanvas accent="steel">
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', textAlign: 'center', padding: '2rem' }}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={slideTransition} style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ color: '#f5d38f', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 900, fontSize: '0.8rem' }}>Preparing Presentation</div>
                  <h1 style={{ margin: 0, color: '#f8fbff', fontSize: 'clamp(2rem, 4.6vw, 4.8rem)', letterSpacing: '-0.06em', textTransform: 'uppercase' }}>Loading Season Finale</h1>
                </motion.div>
                <div style={{ display: 'grid', gap: '0.75rem', width: 'min(480px, 80%)', marginTop: '1.5rem' }}>
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={`skeleton-${i}`}
                      style={{ height: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', width: `${60 + i * 12}%`, justifySelf: i === 1 ? 'start' : i === 2 ? 'center' : 'end' }}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </SlideCanvas>
          ) : activeSlide ? (
            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeSlide.id}
                  initial={{ opacity: 0, y: 18, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 1.01 }}
                  transition={slideTransition}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  {activeSlide.node}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '10px 14px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(16,24,40,0.88), rgba(6,10,16,0.92))', backdropFilter: 'blur(14px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 22px rgba(0,0,0,0.22)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)} aria-label="Previous slide" style={{ borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(28,42,64,0.7)', color: '#f8fbff', padding: '0.5rem 0.8rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>Prev</button>
            <button type="button" onClick={() => setIsPlaying((prev) => !prev)} aria-label={isPlaying ? 'Pause autoplay' : 'Start autoplay'} style={{ borderRadius: '999px', border: '1px solid rgba(240,210,132,0.2)', background: 'linear-gradient(180deg, rgba(247,220,143,0.92), rgba(200,154,49,0.92))', color: '#151a21', padding: '0.5rem 0.9rem', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer' }}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => setSlideIndex((prev) => (prev + 1) % slides.length)} aria-label="Next slide" style={{ borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(28,42,64,0.7)', color: '#f8fbff', padding: '0.5rem 0.8rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>Next</button>
            <span style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <span style={{ color: 'rgba(234,242,255,0.5)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em' }}>← → ␣</span>
            <span style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <a href="/settings" style={{ borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(28,42,64,0.5)', color: 'rgba(234,242,255,0.7)', padding: '0.35rem 0.55rem', fontWeight: 800, fontSize: '0.65rem', cursor: 'pointer', lineHeight: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} title="Back to admin settings">Settings →</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" onClick={() => setSlideIndex(index)} aria-label={`Go to ${slide.label}`} style={{ width: '10px', height: '10px', borderRadius: '999px', border: 'none', background: index === slideIndex ? 'linear-gradient(180deg, #f5d38f, #c89b32)' : 'rgba(255,255,255,0.14)', cursor: 'pointer', transition: 'all 200ms ease', transform: index === slideIndex ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
            <span style={{ color: 'rgba(234,242,255,0.62)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginLeft: '4px' }}>{slides.length > 0 ? `${slideIndex + 1} / ${slides.length}` : '0 / 0'}</span>
            <span style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            {[5000, 7000, 9000, 12000, 15000].map((speed) => (
              <button key={speed} type="button" onClick={() => setAutoplaySpeed(speed)} aria-label={`${speed / 1000} second autoplay interval`} style={{ borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)', background: autoplaySpeed === speed ? 'linear-gradient(180deg, rgba(247,220,143,0.8), rgba(200,154,49,0.8))' : 'rgba(28,42,64,0.5)', color: autoplaySpeed === speed ? '#151a21' : 'rgba(234,242,255,0.7)', padding: '0.35rem 0.55rem', fontWeight: 800, fontSize: '0.65rem', cursor: 'pointer', lineHeight: 1 }}>{speed / 1000}s</button>
            ))}
            <span style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} style={{ borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(28,42,64,0.5)', color: 'rgba(234,242,255,0.7)', padding: '0.35rem 0.55rem', fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1 }} title="Fullscreen">⛶</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SeasonFinalePage;
export { SeasonFinalePage };
