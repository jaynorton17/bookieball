import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { PenaltyShootoutBoard } from './components/PenaltyShootoutBoard';
import { api } from './lib/api';
import { onBookieBallEvent } from './lib/appEvents';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CupDrawPage = lazy(() => import('./pages/CupDrawPage').then((module) => ({ default: module.CupDrawPage })));
const CupsHubPage = lazy(() => import('./pages/CupsHubPage').then((module) => ({ default: module.CupsHubPage })));
const GameshowPage = lazy(() => import('./pages/GameshowPage').then((module) => ({ default: module.GameshowPage })));
const SeasonFinalePage = lazy(() => import('./pages/SeasonFinalePage').then((module) => ({ default: module.SeasonFinalePage })));
const AllFixturesPage = lazy(() => import('./pages/AllFixturesPage').then((module) => ({ default: module.AllFixturesPage })));
const LeaguesHubPage = lazy(() => import('./pages/LeaguesHubPage').then((module) => ({ default: module.LeaguesHubPage })));
const LeaguePage = lazy(() => import('./pages/LeaguePage').then((module) => ({ default: module.LeaguePage })));
const EntryManagerPage = lazy(() => import('./pages/EntryManagerPage').then((module) => ({ default: module.EntryManagerPage })));
const TrophyRoomPage = lazy(() => import('./pages/TrophyRoomPage').then((module) => ({ default: module.TrophyRoomPage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })));
const SettingsHubPage = lazy(() => import('./pages/SettingsHubPage').then((module) => ({ default: module.SettingsHubPage })));
const MasterLeaguePage = lazy(() => import('./pages/MasterLeaguePage').then((module) => ({ default: module.MasterLeaguePage })));
const MasterCupPage = lazy(() => import('./pages/MasterCupPage').then((module) => ({ default: module.MasterCupPage })));
const SuperCupPage = lazy(() => import('./pages/SuperCupPage').then((module) => ({ default: module.SuperCupPage })));
const TrioLeaguePage = lazy(() => import('./pages/TrioLeaguePage').then((module) => ({ default: module.TrioLeaguePage })));
const TierLeaguePage = lazy(() => import('./pages/TierLeaguePage').then((module) => ({ default: module.TierLeaguePage })));
const AllTimeLeaguesPage = lazy(() => import('./pages/AllTimeLeaguesPage').then((module) => ({ default: module.AllTimeLeaguesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const MatchdayPage = lazy(() => import('./pages/MatchdayPage').then((module) => ({ default: module.MatchdayPage })));
const HeadToHeadPage = lazy(() => import('./pages/HeadToHeadPage').then((module) => ({ default: module.HeadToHeadPage })));
const ReportingPage = lazy(() => import('./pages/ReportingPage').then((module) => ({ default: module.ReportingPage })));
const ReportsHubPage = lazy(() => import('./pages/ReportsHubPage').then((module) => ({ default: module.ReportsHubPage })));
const PenaltyShootoutPage = lazy(() => import('./pages/PenaltyShootoutPage').then((module) => ({ default: module.PenaltyShootoutPage })));
const SkySportsNewsHubPage = lazy(() => import('./pages/SkySportsNewsHubPage').then((module) => ({ default: module.SkySportsNewsHubPage })));
const DivisionTablesRoundupPage = lazy(() => import('./pages/DivisionTablesRoundupPage').then((module) => ({ default: module.DivisionTablesRoundupPage })));
const SnyNewsNewPage = lazy(() => import('./pages/SnyNewsNewPage').then((module) => ({ default: module.SnyNewsNewPage })));

type PenaltyCompetition = 'cup' | 'super_cup' | 'master_cup' | 'gw8_playoff' | 'trio_playoff';

type PenaltyTieFixture = {
  competition: PenaltyCompetition;
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
};

type PenaltyTeamMeta = {
  id: number;
  name: string;
  ballColor: string | null;
  ringColor: string | null;
};

type TopNavLink = {
  to: string;
  label: string;
};

const topNavLinks: TopNavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/gameshow', label: 'Show' },
  { to: '/leagues', label: 'Leagues' },
  { to: '/cups', label: 'Cups' },
  { to: '/fixtures', label: 'Fixtures' },
  { to: '/reports', label: 'Analytics' },
  { to: '/entries', label: 'Manual Entry' },
  { to: '/penalty-shootout', label: 'Penalties' },
  { to: '/settings-hub', label: 'Tools' },
];

function penaltyCompetitionLabel(competition: PenaltyCompetition): string {
  if (competition === 'cup') return 'Cup Tie';
  if (competition === 'super_cup') return 'Super Cup';
  if (competition === 'master_cup') return 'Master Cup';
  if (competition === 'trio_playoff') return 'Trio Playoff';
  return 'GW8 Playoff';
}

function penaltyTieSummary(tie: PenaltyTieFixture | null): string {
  if (!tie) return '';
  return `${tie.roundName} | ${tie.homeTeamName} vs ${tie.awayTeamName}`;
}

function penaltyQueueSignature(queue: PenaltyTieFixture[]): string {
  return queue.map((tie) => `${tie.competition}:${tie.fixtureId}`).join('|');
}

function gwNumericValue(gw: string): number {
  const parsed = Number(gw.replace('GW', ''));
  return Number.isFinite(parsed) ? parsed : 99;
}

function isOverduePenaltyTie(tie: PenaltyTieFixture | null, currentGw: string | null | undefined): boolean {
  if (!tie || !currentGw) return false;
  return gwNumericValue(tie.gw) < gwNumericValue(currentGw);
}

function sortPenaltyQueue(queue: PenaltyTieFixture[]): PenaltyTieFixture[] {
  const competitionOrder: Record<PenaltyCompetition, number> = {
    super_cup: 0,
    cup: 1,
    master_cup: 2,
    trio_playoff: 3,
    gw8_playoff: 4,
  };
  return queue.slice().sort((a, b) => (
    gwNumericValue(a.gw) - gwNumericValue(b.gw)
    || competitionOrder[a.competition] - competitionOrder[b.competition]
    || a.fixtureId - b.fixtureId
  ));
}

export function App() {
  const location = useLocation();
  const isPresentation = location.pathname === '/season-finale';
  const allowGlobalPenaltyPrompt = !isPresentation && location.pathname !== '/' && location.pathname !== '/settings' && location.pathname !== '/penalty-shootout';
  const [state, setState] = useState<{ currentSeason: string; currentGw: string; gwLocked: boolean } | null>(null);
  const [penaltyTeams, setPenaltyTeams] = useState<PenaltyTeamMeta[]>([]);
  const [penaltyTieQueue, setPenaltyTieQueue] = useState<PenaltyTieFixture[]>([]);
  const [penaltyTieIndex, setPenaltyTieIndex] = useState(0);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  const [penaltyComputerPlay, setPenaltyComputerPlay] = useState(false);
  const [penaltyComputerNonce, setPenaltyComputerNonce] = useState(0);
  const [penaltyNotice, setPenaltyNotice] = useState('');
  const [dismissedPenaltySignature, setDismissedPenaltySignature] = useState<string | null>(null);
  const penaltyQueueRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await api.state();
        if (active) setState({ currentSeason: next.currentSeason, currentGw: next.currentGw, gwLocked: next.gwLocked });
      } catch {
        // Header status is non-critical; keep the last known state on transient errors.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const offMutation = onBookieBallEvent('data-mutated', () => void refresh());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void refresh());
    return () => {
      active = false;
      window.clearInterval(timer);
      offMutation();
      offGameweek();
    };
  }, []);

  useEffect(() => {
    if (!allowGlobalPenaltyPrompt) setPenaltyModalOpen(false);
    let active = true;
    const loadPenaltyQueue = async () => {
      const requestId = ++penaltyQueueRequestRef.current;
      try {
        const queue = sortPenaltyQueue(await api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]));
        if (!active || requestId !== penaltyQueueRequestRef.current) return;
        setPenaltyTieQueue(queue);
        setPenaltyTieIndex((current) => (queue.length === 0 ? 0 : Math.min(current, queue.length - 1)));

        if (queue.length === 0) {
          setPenaltyModalOpen(false);
          setDismissedPenaltySignature(null);
          return;
        }

        const signature = penaltyQueueSignature(queue);
        if (allowGlobalPenaltyPrompt && dismissedPenaltySignature !== signature) setPenaltyModalOpen(true);
        if (!allowGlobalPenaltyPrompt) setPenaltyModalOpen(false);
        if (!allowGlobalPenaltyPrompt) return;

        const teams = await api.teams().catch(() => [] as Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null }>);
        if (!active || requestId !== penaltyQueueRequestRef.current) return;
        setPenaltyTeams(teams.map((team) => ({ id: team.id, name: team.name, ballColor: team.ballColor ?? null, ringColor: team.ringColor ?? null })));
      } catch {
        if (active && requestId === penaltyQueueRequestRef.current) setPenaltyTieQueue([]);
      }
    };

    void loadPenaltyQueue();
    const timer = window.setInterval(() => void loadPenaltyQueue(), 15_000);
    const offMutation = onBookieBallEvent('data-mutated', () => void loadPenaltyQueue());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void loadPenaltyQueue());
    return () => {
      active = false;
      window.clearInterval(timer);
      offMutation();
      offGameweek();
    };
  }, [allowGlobalPenaltyPrompt, dismissedPenaltySignature]);

  const activePenaltyTie = penaltyTieQueue[penaltyTieIndex] ?? null;
  const activePenaltySummary = useMemo(() => penaltyTieSummary(activePenaltyTie), [activePenaltyTie]);
  const activePenaltyIsOverdue = Boolean(activePenaltyTie && (!state || isOverduePenaltyTie(activePenaltyTie, state.currentGw)));
  const penaltyTeamById = useMemo(() => new Map(penaltyTeams.map((team) => [team.id, team])), [penaltyTeams]);

  useEffect(() => {
    setPenaltyComputerPlay(false);
    setPenaltyNotice('');
  }, [activePenaltyTie?.fixtureId]);

  const activeTopNav = useMemo(() => {
    if (location.pathname === '/insights' || location.pathname === '/settings' || location.pathname === '/settings-hub') return '/settings-hub';
    return topNavLinks.find((link) => (
      link.to === '/'
        ? location.pathname === '/'
        : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)
    ))?.to ?? null;
  }, [location.pathname]);

  const closeGlobalPenaltyPrompt = () => {
    setPenaltyModalOpen(false);
    setPenaltyNotice('');
    setPenaltyComputerPlay(false);
    setDismissedPenaltySignature(penaltyQueueSignature(penaltyTieQueue));
  };

  const startComputerPenaltyPlay = () => {
    if (penaltyBusy) return;
    setPenaltyNotice('');
    setPenaltyComputerNonce((nonce) => nonce + 1);
    setPenaltyComputerPlay(true);
  };

  const skipCurrentPenalty = async () => {
    if (!activePenaltyTie || penaltyBusy) return;
    setPenaltyBusy(true);
    setPenaltyNotice('');
    try {
      await api.autoResolvePenalty(activePenaltyTie.competition, activePenaltyTie.fixtureId);
      const nextQueue = sortPenaltyQueue(await api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]));
      if (nextQueue.length === 0) {
        setPenaltyTieQueue([]);
        setPenaltyTieIndex(0);
        setPenaltyModalOpen(false);
        setDismissedPenaltySignature(null);
      } else {
        const nextIndex = Math.min(penaltyTieIndex, nextQueue.length - 1);
        setPenaltyTieQueue(nextQueue);
        setPenaltyTieIndex(nextIndex);
        const nextTie = nextQueue[nextIndex];
        setPenaltyNotice(`Skipped. Next up: ${nextTie.homeTeamName} vs ${nextTie.awayTeamName}`);
      }
    } catch {
      setPenaltyNotice('Failed to skip this penalty tie.');
    } finally {
      setPenaltyBusy(false);
    }
  };

  const skipAllPenalties = async () => {
    if (penaltyBusy) return;
    setPenaltyBusy(true);
    setPenaltyNotice('');
    try {
      const result = await api.autoResolveAllPenalties();
      const nextQueue = sortPenaltyQueue(await api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]));
      if (result.errors?.length) setPenaltyNotice(`Skipped ${result.count}/${result.total}. ${result.errors.length} error(s) left in queue.`);
      if (nextQueue.length === 0) {
        setPenaltyTieQueue([]);
        setPenaltyTieIndex(0);
        setPenaltyModalOpen(false);
        setDismissedPenaltySignature(null);
      } else {
        setPenaltyTieQueue(nextQueue);
        setPenaltyTieIndex(0);
        if (!result.errors?.length) setPenaltyNotice(`Skipped ${result.count} tie(s). ${nextQueue.length} still waiting.`);
      }
    } catch {
      setPenaltyNotice('Failed to skip penalties.');
    } finally {
      setPenaltyBusy(false);
    }
  };

  const handleConfirmGlobalPenaltyWinner = async (winner: { id: number; name: string }) => {
    if (!activePenaltyTie || penaltyBusy) return;
    setPenaltyBusy(true);
    try {
      if (activePenaltyTie.competition === 'cup') await api.setCupWinner(activePenaltyTie.fixtureId, winner.id);
      else if (activePenaltyTie.competition === 'super_cup') await api.setSuperCupWinner(activePenaltyTie.fixtureId, winner.id);
      else if (activePenaltyTie.competition === 'master_cup') await api.setMasterCupWinner(activePenaltyTie.fixtureId, winner.id);
      else if (activePenaltyTie.competition === 'trio_playoff') await api.setTrioPlayoffWinner(activePenaltyTie.fixtureId, winner.id);
      else await api.setGw8PlayoffWinner(activePenaltyTie.fixtureId, winner.id);

      const requestId = ++penaltyQueueRequestRef.current;
      const nextQueue = sortPenaltyQueue(await api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]));
      if (requestId !== penaltyQueueRequestRef.current) return;
      setPenaltyTieQueue(nextQueue);
      setPenaltyTieIndex(0);
      setDismissedPenaltySignature(null);
      setPenaltyModalOpen(false);
      setPenaltyNotice('');
      setPenaltyComputerPlay(false);
    } finally {
      setPenaltyBusy(false);
    }
  };

  return (
    <div className={`app-shell${isPresentation ? ' presentation-shell' : ''}`}>
      {!isPresentation && (
        <header className="topbar">
          <div className="topbar-main">
            <Link to="/" className="brand brand-lockup"><span className="brand-kicker">BookieBall</span><strong>bookieball</strong></Link>
            <nav className="topbar-nav" aria-label="Primary">
              {topNavLinks.map((link) => (
                <Link key={link.to} to={link.to} className={`topbar-nav-link ${activeTopNav === link.to ? 'active' : ''}${link.to === '/penalty-shootout' && penaltyTieQueue.length > 0 ? ' penalties-live' : ''}`}>
                  <span>{link.label}{link.to === '/penalty-shootout' && penaltyTieQueue.length > 0 ? ` (${penaltyTieQueue.length})` : ''}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="topbar-status">
            <div className="season-gw-chip"><span className="status-kicker">Season Feed</span><strong>{state ? `${state.currentSeason}, ${state.currentGw}` : 'Loading season...'}</strong></div>
            <div className={`gw-lock-chip ${state?.gwLocked ? 'locked' : 'open'}`}><span className="status-kicker">Gameweek</span><strong>{state ? (state.gwLocked ? 'Locked' : 'Unlocked') : 'Lock status...'}</strong></div>
            <div className={`penalty-queue-chip ${penaltyTieQueue.length > 0 ? 'live' : ''}`}><span className="status-kicker">Penalties</span><strong>{penaltyTieQueue.length > 0 ? `${penaltyTieQueue.length} waiting` : 'Queue clear'}</strong></div>
          </div>
        </header>
      )}
      <main className={isPresentation ? 'presentation-main' : undefined}>
        <Suspense fallback={<section className="page"><p className="muted">Loading page...</p></section>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/fixtures" element={<AllFixturesPage />} />
            <Route path="/cup-draw" element={<CupDrawPage />} />
            <Route path="/gameshow" element={<GameshowPage />} />
            <Route path="/season-finale" element={<SeasonFinalePage />} />
            <Route path="/leagues" element={<LeaguesHubPage />} />
            <Route path="/cups" element={<CupsHubPage />} />
            <Route path="/league" element={<LeaguePage />} />
            <Route path="/super-cup" element={<SuperCupPage />} />
            <Route path="/master-league" element={<MasterLeaguePage />} />
            <Route path="/master-cup" element={<MasterCupPage />} />
            <Route path="/trio-league" element={<TrioLeaguePage />} />
            <Route path="/tier-league" element={<TierLeaguePage />} />
            <Route path="/all-time-league" element={<AllTimeLeaguesPage mode="points" />} />
            <Route path="/all-time-spins-league" element={<AllTimeLeaguesPage mode="spins" />} />
            <Route path="/all-time-profit-league" element={<AllTimeLeaguesPage mode="profit" />} />
            <Route path="/settings-hub" element={<SettingsHubPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/entries" element={<EntryManagerPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/matchday" element={<MatchdayPage />} />
            <Route path="/head-to-head" element={<HeadToHeadPage />} />
            <Route path="/reporting" element={<ReportingPage />} />
            <Route path="/reports" element={<ReportsHubPage />} />
            <Route path="/sky-sports-news" element={<SkySportsNewsHubPage />} />
            <Route path="/sky-sports-news/show" element={<DivisionTablesRoundupPage />} />
            <Route path="/studio/sky-sports-news-new" element={<SnyNewsNewPage />} />
            <Route path="/studio/sny-news-new" element={<SnyNewsNewPage />} />
            <Route path="/penalty-shootout" element={<PenaltyShootoutPage />} />
            <Route path="/trophy-room" element={<TrophyRoomPage />} />
          </Routes>
        </Suspense>
      </main>
      {allowGlobalPenaltyPrompt && penaltyModalOpen && activePenaltyTie && (
        <div className="penalty-modal-backdrop">
          <div className="penalty-modal-card">
            <div className="penalty-modal-header">
              <div><h3>{penaltyCompetitionLabel(activePenaltyTie.competition)} Alert</h3><p className="muted">{activePenaltySummary}</p></div>
              <span className="penalty-modal-count">{penaltyTieIndex + 1} of {penaltyTieQueue.length}</span>
            </div>
            <p className="muted">
              {activePenaltyTie.competition === 'super_cup'
                ? 'Level on profit. Penalties decide the Super Cup winner.'
                : activePenaltyTie.competition === 'master_cup'
                  ? /semi-final/i.test(activePenaltyTie.roundName)
                    ? 'Level on aggregate. Penalties decide the semi-final.'
                    : 'Level on profit. Penalties decide the winner.'
                  : activePenaltyTie.competition === 'trio_playoff'
                    ? 'Level on profit. Penalties decide the playoff.'
                    : activePenaltyTie.competition === 'gw8_playoff'
                      ? 'Level on profit. Penalties decide promotion.'
                      : 'Level on profit and spins. Penalties decide the winner.'}
            </p>
            <div className="penalty-shootout-card">
              <PenaltyShootoutBoard
                homeTeam={{ id: activePenaltyTie.homeTeamId, name: activePenaltyTie.homeTeamName, ballColor: penaltyTeamById.get(activePenaltyTie.homeTeamId)?.ballColor ?? null, ringColor: penaltyTeamById.get(activePenaltyTie.homeTeamId)?.ringColor ?? null }}
                awayTeam={{ id: activePenaltyTie.awayTeamId, name: activePenaltyTie.awayTeamName, ballColor: penaltyTeamById.get(activePenaltyTie.awayTeamId)?.ballColor ?? null, ringColor: penaltyTeamById.get(activePenaltyTie.awayTeamId)?.ringColor ?? null }}
                resetKey={`${activePenaltyTie.competition}-${activePenaltyTie.fixtureId}-${penaltyTieIndex}${penaltyComputerPlay ? `-computer-${penaltyComputerNonce}` : '-manual'}`}
                autoStart={activePenaltyIsOverdue || penaltyComputerPlay}
                initialAutoPlay={penaltyComputerPlay}
                autoConfirm={penaltyComputerPlay}
                startLabel={penaltyComputerPlay ? 'Computer is taking the penalties…' : 'I will take the penalties'}
                confirmLabel={penaltyBusy ? 'Saving...' : 'Confirm winner'}
                confirmDisabled={penaltyBusy}
                showAutoTake={false}
                showAutoComplete={false}
                onConfirmWinner={(winner) => { if (!penaltyBusy) void handleConfirmGlobalPenaltyWinner(winner); }}
              />
            </div>
            <div className="penalty-fixture-meta">
              <span>{activePenaltyTie.gw}</span><span>{activePenaltyTie.roundName}</span>
              <span>
                Profit {activePenaltyTie.homeProfit}{activePenaltyTie.competition === 'cup' || activePenaltyTie.competition === 'master_cup' ? ` | ${activePenaltyTie.homeSpins} spins` : ''}
                {' vs '}
                Profit {activePenaltyTie.awayProfit}{activePenaltyTie.competition === 'cup' || activePenaltyTie.competition === 'master_cup' ? ` | ${activePenaltyTie.awaySpins} spins` : ''}
              </span>
            </div>
            {penaltyNotice ? <p className="muted" style={{ margin: 0 }}>{penaltyNotice}</p> : null}
            {!penaltyComputerPlay ? (
              <div className="grid-row">
                <button type="button" className="secondary" onClick={startComputerPenaltyPlay} disabled={penaltyBusy}>Computer takes all</button>
                <button type="button" className="secondary" onClick={() => void skipCurrentPenalty()} disabled={penaltyBusy}>{penaltyBusy ? 'Skipping...' : 'Skip game'}</button>
                <button type="button" className="secondary" onClick={() => void skipAllPenalties()} disabled={penaltyBusy}>{penaltyBusy ? 'Skipping all...' : 'Skip all'}</button>
                {!activePenaltyIsOverdue && <button type="button" className="secondary" onClick={() => { closeGlobalPenaltyPrompt(); setPenaltyTieIndex(0); }}>Later</button>}
              </div>
            ) : <p className="muted">The computer is taking the penalties — sit back and watch.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
