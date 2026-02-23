import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './lib/api';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CupDrawPage = lazy(() => import('./pages/CupDrawPage').then((module) => ({ default: module.CupDrawPage })));
const GameshowPage = lazy(() => import('./pages/GameshowPage').then((module) => ({ default: module.GameshowPage })));
const SeasonFinalePage = lazy(() => import('./pages/SeasonFinalePage').then((module) => ({ default: module.SeasonFinalePage })));
const LeaguePage = lazy(() => import('./pages/LeaguePage').then((module) => ({ default: module.LeaguePage })));
const EntryManagerPage = lazy(() => import('./pages/EntryManagerPage').then((module) => ({ default: module.EntryManagerPage })));
const TrophyRoomPage = lazy(() => import('./pages/TrophyRoomPage').then((module) => ({ default: module.TrophyRoomPage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })));
const LeaguesHubPage = lazy(() => import('./pages/LeaguesHubPage').then((module) => ({ default: module.LeaguesHubPage })));
const MasterLeaguePage = lazy(() => import('./pages/MasterLeaguePage').then((module) => ({ default: module.MasterLeaguePage })));
const AllTimeLeaguesPage = lazy(() => import('./pages/AllTimeLeaguesPage').then((module) => ({ default: module.AllTimeLeaguesPage })));
const MatchdayPage = lazy(() => import('./pages/MatchdayPage').then((module) => ({ default: module.MatchdayPage })));
const ReportingPage = lazy(() => import('./pages/ReportingPage').then((module) => ({ default: module.ReportingPage })));
const PenaltyShootoutPage = lazy(() => import('./pages/PenaltyShootoutPage').then((module) => ({ default: module.PenaltyShootoutPage })));

export function App() {
  const location = useLocation();
  const isPresentation = location.pathname === '/season-finale';
  const [state, setState] = useState<{ currentSeason: string; currentGw: string } | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await api.state();
        if (active) {
          setState({ currentSeason: next.currentSeason, currentGw: next.currentGw });
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

  return (
    <div className={`app-shell${isPresentation ? ' presentation-shell' : ''}`}>
      {!isPresentation && (
        <header className="topbar">
          <Link to="/" className="brand">bookieball</Link>
          <div className="season-gw-chip">{state ? `${state.currentSeason}, ${state.currentGw}` : 'Loading season...'}</div>
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
            <Route path="/cup-draw" element={<CupDrawPage />} />
            <Route path="/gameshow" element={<GameshowPage />} />
            <Route path="/sky-sports-news" element={<GameshowPage studioOnly />} />
            <Route path="/season-finale" element={<SeasonFinalePage />} />
            <Route path="/leagues" element={<LeaguesHubPage />} />
            <Route path="/league" element={<LeaguePage />} />
            <Route path="/master-league" element={<MasterLeaguePage />} />
            <Route path="/all-time-league" element={<AllTimeLeaguesPage mode="points" />} />
            <Route path="/all-time-spins-league" element={<AllTimeLeaguesPage mode="spins" />} />
            <Route path="/all-time-profit-league" element={<AllTimeLeaguesPage mode="profit" />} />
            <Route path="/entries" element={<EntryManagerPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/matchday" element={<MatchdayPage />} />
            <Route path="/reporting" element={<ReportingPage />} />
            <Route path="/penalty-shootout" element={<PenaltyShootoutPage />} />
            <Route path="/trophy-room" element={<TrophyRoomPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
