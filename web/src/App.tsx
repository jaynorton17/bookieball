import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './lib/api';
import { PenaltyShootoutBoard } from './components/PenaltyShootoutBoard';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CupDrawPage = lazy(() => import('./pages/CupDrawPage').then((module) => ({ default: module.CupDrawPage })));
const CupsHubPage = lazy(() => import('./pages/CupsHubPage').then((module) => ({ default: module.CupsHubPage })));
const GameshowPage = lazy(() => import('./pages/GameshowPage').then((module) => ({ default: module.GameshowPage })));
const SeasonFinalePage = lazy(() => import('./pages/SeasonFinalePage').then((module) => ({ default: module.SeasonFinalePage })));
const AllFixturesPage = lazy(() => import('./pages/AllFixturesPage').then((module) => ({ default: module.AllFixturesPage })));
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

function penaltyCompetitionLabel(competition: PenaltyCompetition): string {
  if (competition === 'cup') {
    return 'Cup Tie';
  }
  if (competition === 'super_cup') {
    return 'Super Cup';
  }
  if (competition === 'master_cup') {
    return 'Master Cup';
  }
  if (competition === 'trio_playoff') {
    return 'Trio Playoff';
  }
  return 'GW8 Playoff';
}

function penaltyTieSummary(tie: PenaltyTieFixture | null): string {
  if (!tie) {
    return '';
  }
  return `${tie.roundName} • ${tie.homeTeamName} vs ${tie.awayTeamName}`;
}

function penaltyQueueSignature(queue: PenaltyTieFixture[]): string {
  return queue.map((tie) => `${tie.competition}:${tie.fixtureId}`).join('|');
}

function gwNumericValue(gw: string): number {
  const parsed = Number(gw.replace('GW', ''));
  return Number.isFinite(parsed) ? parsed : 99;
}

function isOverduePenaltyTie(tie: PenaltyTieFixture | null, currentGw: string | null | undefined): boolean {
  if (!tie || !currentGw) {
    return false;
  }
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
  const allowGlobalPenaltyPrompt = !isPresentation && location.pathname !== '/settings' && location.pathname !== '/insights' && location.pathname !== '/penalty-shootout';
  const [state, setState] = useState<{ currentSeason: string; currentGw: string; gwLocked: boolean } | null>(null);
  const [penaltyTeams, setPenaltyTeams] = useState<PenaltyTeamMeta[]>([]);
  const [penaltyTieQueue, setPenaltyTieQueue] = useState<PenaltyTieFixture[]>([]);
  const [penaltyTieIndex, setPenaltyTieIndex] = useState(0);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  const [dismissedPenaltySignature, setDismissedPenaltySignature] = useState<string | null>(null);
  const penaltyQueueRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await api.state();
        if (active) {
          setState({
            currentSeason: next.currentSeason,
            currentGw: next.currentGw,
            gwLocked: next.gwLocked,
          });
        }
      } catch {
        // ignore transient API errors in header status
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!allowGlobalPenaltyPrompt) {
      setPenaltyModalOpen(false);
      return undefined;
    }

    let active = true;
    const loadPenaltyQueue = async () => {
      const requestId = ++penaltyQueueRequestRef.current;
      try {
        const queue = sortPenaltyQueue(await api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]));
        if (!active || requestId !== penaltyQueueRequestRef.current) {
          return;
        }

        setPenaltyTieQueue(queue);
        setPenaltyTieIndex((current) => (queue.length === 0 ? 0 : Math.min(current, queue.length - 1)));

        if (queue.length === 0) {
          setPenaltyModalOpen(false);
          setDismissedPenaltySignature(null);
          return;
        }

        const signature = penaltyQueueSignature(queue);
        if (dismissedPenaltySignature !== signature) {
          setPenaltyModalOpen(true);
        }

        const teams = await api.teams().catch(() => [] as Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null }>);
        if (!active || requestId !== penaltyQueueRequestRef.current) {
          return;
        }
        setPenaltyTeams(teams.map((team) => ({
          id: team.id,
          name: team.name,
          ballColor: team.ballColor ?? null,
          ringColor: team.ringColor ?? null,
        })));
      } catch {
        if (active && requestId === penaltyQueueRequestRef.current) {
          setPenaltyTieQueue([]);
        }
      }
    };

    void loadPenaltyQueue();
    const timer = window.setInterval(() => {
      void loadPenaltyQueue();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [allowGlobalPenaltyPrompt, dismissedPenaltySignature, location.pathname]);

  const activePenaltyTie = penaltyTieQueue[penaltyTieIndex] ?? null;
  const activePenaltySummary = useMemo(() => penaltyTieSummary(activePenaltyTie), [activePenaltyTie]);
  const activePenaltyIsOverdue = Boolean(activePenaltyTie && (!state || isOverduePenaltyTie(activePenaltyTie, state.currentGw)));
  const penaltyTeamById = useMemo(
    () => new Map(penaltyTeams.map((team) => [team.id, team])),
    [penaltyTeams],
  );

  const closeGlobalPenaltyPrompt = () => {
    setPenaltyModalOpen(false);
    setDismissedPenaltySignature(penaltyQueueSignature(penaltyTieQueue));
  };

  const handleConfirmGlobalPenaltyWinner = async (winner: { id: number; name: string }) => {
    if (!activePenaltyTie || penaltyBusy) {
      return;
    }
    setPenaltyBusy(true);
    try {
      if (activePenaltyTie.competition === 'cup') {
        await api.setCupWinner(activePenaltyTie.fixtureId, winner.id);
      } else if (activePenaltyTie.competition === 'super_cup') {
        await api.setSuperCupWinner(activePenaltyTie.fixtureId, winner.id);
      } else if (activePenaltyTie.competition === 'master_cup') {
        await api.setMasterCupWinner(activePenaltyTie.fixtureId, winner.id);
      } else if (activePenaltyTie.competition === 'trio_playoff') {
        await api.setTrioPlayoffWinner(activePenaltyTie.fixtureId, winner.id);
      } else {
        await api.setGw8PlayoffWinner(activePenaltyTie.fixtureId, winner.id);
      }

      const requestId = ++penaltyQueueRequestRef.current;
      const nextQueue = sortPenaltyQueue(await api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]));
      if (requestId !== penaltyQueueRequestRef.current) {
        return;
      }
      setPenaltyTieQueue(nextQueue);
      setPenaltyTieIndex(0);
      setDismissedPenaltySignature(null);
      setPenaltyModalOpen(false);
    } finally {
      setPenaltyBusy(false);
    }
  };

  return (
    <div className={`app-shell${isPresentation ? ' presentation-shell' : ''}`}>
      {!isPresentation && (
        <header className="topbar">
          <Link to="/" className="brand">bookieball</Link>
          <div className="topbar-status">
            <div className="season-gw-chip">{state ? `${state.currentSeason}, ${state.currentGw}` : 'Loading season...'}</div>
            <div className={`gw-lock-chip ${state?.gwLocked ? 'locked' : 'open'}`}>
              {state ? (state.gwLocked ? '🔒 Locked' : '🔓 Unlocked') : 'Lock status...'}
            </div>
          </div>
        </header>
      )}
      <main className={isPresentation ? 'presentation-main' : undefined}>
        <Suspense
          fallback={(
            <section className="page">
              <p className="muted">Loading page...</p>
            </section>
          )}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/fixtures" element={<AllFixturesPage />} />
            <Route path="/cup-draw" element={<CupDrawPage />} />
            <Route path="/gameshow" element={<GameshowPage />} />
            <Route path="/season-finale" element={<SeasonFinalePage />} />
            <Route path="/leagues" element={<Navigate to="/league" replace />} />
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
              <div>
                <h3>{penaltyCompetitionLabel(activePenaltyTie.competition)} Alert</h3>
                <p className="muted">{activePenaltySummary}</p>
              </div>
              <span className="penalty-modal-count">
                {penaltyTieIndex + 1} of {penaltyTieQueue.length}
              </span>
            </div>
            <p className="muted">
              {activePenaltyTie.competition === 'super_cup'
                ? 'The season-opening Super Cup is level on profit. Penalties decide the winner before play can move on.'
                : activePenaltyTie.competition === 'master_cup'
                  ? /semi-final/i.test(activePenaltyTie.roundName)
                    ? 'This Master Cup semi-final is level on aggregate profit. Penalties decide the winner.'
                    : 'This Master Cup tie is level on profit. Penalties decide the winner.'
                  : activePenaltyTie.competition === 'trio_playoff'
                    ? 'This Trio playoff tie is level on profit. Penalties decide the winner.'
                    : activePenaltyTie.competition === 'gw8_playoff'
                      ? 'This GW8 playoff tie is level on profit. Spins are ignored and penalties decide promotion.'
                      : 'This cup tie is level on profit and spins. Penalties decide the winner.'}
            </p>
            <div className="penalty-shootout-card">
              <PenaltyShootoutBoard
                homeTeam={{
                  id: activePenaltyTie.homeTeamId,
                  name: activePenaltyTie.homeTeamName,
                  ballColor: penaltyTeamById.get(activePenaltyTie.homeTeamId)?.ballColor ?? null,
                  ringColor: penaltyTeamById.get(activePenaltyTie.homeTeamId)?.ringColor ?? null,
                }}
                awayTeam={{
                  id: activePenaltyTie.awayTeamId,
                  name: activePenaltyTie.awayTeamName,
                  ballColor: penaltyTeamById.get(activePenaltyTie.awayTeamId)?.ballColor ?? null,
                  ringColor: penaltyTeamById.get(activePenaltyTie.awayTeamId)?.ringColor ?? null,
                }}
                resetKey={`${activePenaltyTie.competition}-${activePenaltyTie.fixtureId}-${penaltyTieIndex}`}
                autoStart={activePenaltyIsOverdue}
                startLabel="Take penalties"
                confirmLabel={penaltyBusy ? 'Saving...' : 'Confirm winner'}
                confirmDisabled={penaltyBusy}
                onConfirmWinner={(winner) => {
                  if (!penaltyBusy) {
                    void handleConfirmGlobalPenaltyWinner(winner);
                  }
                }}
              />
            </div>
            <div className="penalty-fixture-meta">
              <span>{activePenaltyTie.gw}</span>
              <span>{activePenaltyTie.roundName}</span>
              <span>
                Profit {activePenaltyTie.homeProfit}
                {activePenaltyTie.competition === 'cup' || activePenaltyTie.competition === 'master_cup'
                  ? ` • ${activePenaltyTie.homeSpins} spins`
                  : ''}
                {' vs '}
                Profit {activePenaltyTie.awayProfit}
                {activePenaltyTie.competition === 'cup' || activePenaltyTie.competition === 'master_cup'
                  ? ` • ${activePenaltyTie.awaySpins} spins`
                  : ''}
              </span>
            </div>
            {!activePenaltyIsOverdue && (
              <div className="grid-row">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeGlobalPenaltyPrompt}
                  disabled={penaltyBusy}
                >
                  Later
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
