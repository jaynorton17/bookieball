import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamBadge } from '../components/TeamBadge';
import { HeadToHeadModal, type H2HTeam } from '../components/HeadToHeadModal';
import { StatTile } from '../components/broadcast/StatTile';
import { SeasonProfitChart } from '../components/SeasonProfitChart';
import { api } from '../lib/api';
import { displayDivisionName, sortDivisionNames } from '../lib/divisionLabels';
import { gwOrderValue, isOfficialDivisionFixture, recentForm, type FormBadgeResult } from '../lib/formUtils';

type TeamMeta = { id: number; name: string; division: string; ballColor: string | null; ringColor: string | null; textColor: string | null };
type StandingRow = { teamId: number; teamName: string; division: string; played: number; wins: number; draws: number; losses: number; points: number; profit: number; spins: number; rank: number };
type Fixture = { id: number; gw: string; division: string; homeTeam: string; awayTeam: string; homeProfit: number; awayProfit: number; homeSpins: number; awaySpins: number; played: boolean; result: 'home' | 'away' | 'draw' | 'pending' };
type PenaltyTie = { competition: 'cup' | 'super_cup' | 'master_cup' | 'gw8_playoff' | 'trio_playoff'; fixtureId: number; gw: string; roundName: string; homeTeamName: string; awayTeamName: string };
type RatingRow = { teamId: number; teamName: string; entries: number; wins: number; profit: number; avgProfit: number; winRate: number; rating: number };
type Storyline = { id: string; headline: string; detail: string; tone: 'positive' | 'warning' | 'neutral'; metric?: string };
type Achiev = { key: string; label: string; teamName: string; value: string };
type RivalryData = { id: string; matchup: string; record: string; edge: string; avgMargin: string; nextMeeting: string; narrative: string };
type PredTotal = { picker: string; points: number; correct: number; total: number; perfectWeeks: number };
type BdorHolder = { teamId: number; teamName: string; division: string; score: number; leagueScore: number; cupScore: number; masterScore: number; consistencyScore: number; weightedLeagueScore: number; weightedCupScore: number; weightedMasterScore: number; weightedConsistencyScore: number };
type TrendRow = { teamId: number; rankDelta: number; pointsDelta: number; profitDelta: number; pointsDeltaVsPreviousWindow: number | null; profitDeltaVsPreviousWindow: number | null };
type CupStatusRow = { gw: string; roundName: string; totalFixtures: number; playableFixtures: number; resolvedFixtures: number; complete: boolean; locked: boolean };

type FeedCategory = 'storyline' | 'momentum' | 'shock' | 'honours' | 'prediction' | 'rivalry';
type FeedItem = {
  id: string;
  category: FeedCategory;
  icon: string;
  label: string;
  headline: string;
  detail: string;
  tone: 'positive' | 'warning' | 'neutral';
  metric?: string;
};

const FEED_CATEGORY_LABELS: Record<FeedCategory, string> = {
  storyline: 'Storylines',
  momentum: 'Momentum',
  shock: 'Shocks',
  honours: 'Honours',
  prediction: 'Predictions',
  rivalry: 'Rivalries',
};

const TONE_STYLES: Record<'positive' | 'warning' | 'neutral', { border: string; bg: string; text: string; badge: string }> = {
  positive: { border: 'rgba(100,220,100,0.25)', bg: 'rgba(20,50,20,0.25)', text: '#8fda8f', badge: 'rgba(100,220,100,0.2)' },
  warning: { border: 'rgba(255,200,50,0.25)', bg: 'rgba(50,40,10,0.25)', text: '#f0d060', badge: 'rgba(255,200,50,0.2)' },
  neutral: { border: 'rgba(150,180,220,0.15)', bg: 'rgba(10,20,35,0.35)', text: '#a0b8d0', badge: 'rgba(150,180,220,0.15)' },
};

function resultForTeam(result: Fixture['result'], isHome: boolean): FormBadgeResult | null {
  if (result === 'pending') return null;
  if (result === 'draw') return 'D';
  return (result === 'home') === isHome ? 'W' : 'L';
}

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function HomePage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string; gwLocked: boolean; cupDrawStarted: boolean } | null>(null);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [table, setTable] = useState<Record<string, StandingRow[]>>({});
  const [movement, setMovement] = useState<Record<string, Record<number, number>>>({});
  const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
  const [penaltyQueue, setPenaltyQueue] = useState<PenaltyTie[]>([]);
  const [cupStatusRows, setCupStatusRows] = useState<CupStatusRow[]>([]);
  const [gwEntryCount, setGwEntryCount] = useState<number | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [profit, setProfit] = useState<Awaited<ReturnType<typeof api.seasonProfitComparison>> | null>(null);
  const [bookieDor, setBookieDor] = useState<BdorHolder | null>(null);
  const [storylines, setStorylines] = useState<Storyline[]>([]);
  const [tickerItems, setTickerItems] = useState<string[]>([]);
  const [rivalries, setRivalries] = useState<RivalryData[]>([]);
  const [predScores, setPredScores] = useState<PredTotal[]>([]);
  const [achievements, setAchievements] = useState<Achiev[]>([]);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [activeDivision, setActiveDivision] = useState<string>('all');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [feedFilter, setFeedFilter] = useState<'all' | FeedCategory>('all');
  const [focusedTeamId, setFocusedTeamId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const nextState = await api.state();
      const [
        nextTeams, nextTable, nextMovement, nextFixtures, nextPenalties, nextCupStatus,
        nextRatings, nextProfit, nextBookieDor, nextReport, nextAchievements, nextTrends,
      ] = await Promise.all([
        api.teams(),
        api.leagueTable(),
        api.leagueMovement().catch(() => ({ baselineGw: null, baselineLabel: null, movement: {} })),
        api.leagueFixtures(undefined, true).catch(() => []),
        api.penaltyQueue().catch(() => []),
        api.cupStatus().catch(() => []),
        api.teamRatings().catch(() => []),
        api.seasonProfitComparison().catch(() => null),
        api.bookieDor().catch(() => null),
        api.reportPack().catch(() => null),
        api.achievements().catch(() => []),
        api.teamTrends().catch(() => ({ season: '', gw: '', trends: [] })),
      ]);
      const nextEntries = await api.entries({ gw: nextState.currentGw }).catch(() => []);
      setState({ currentSeason: nextState.currentSeason, currentGw: nextState.currentGw, gwLocked: nextState.gwLocked, cupDrawStarted: nextState.cupDrawStarted });
      setTeams(nextTeams.map((team) => ({ id: team.id, name: team.name, division: team.division, ballColor: team.ballColor, ringColor: team.ringColor, textColor: team.textColor })));
      setTable(nextTable);
      setMovement(nextMovement.movement);
      setAllFixtures(nextFixtures);
      setPenaltyQueue(nextPenalties);
      setCupStatusRows(nextCupStatus);
      setGwEntryCount(nextEntries.length);
      setRatings(nextRatings);
      setProfit(nextProfit);
      setBookieDor(nextBookieDor?.holder ?? null);
      setAchievements(nextAchievements);
      setTrends(nextTrends.trends ?? []);
      if (nextReport) {
        setStorylines(nextReport.story?.storylines ?? []);
        setTickerItems(nextReport.story?.tickerItems ?? []);
        setRivalries(nextReport.rivalryDesk ?? []);
        setPredScores(nextReport.predictionScoreboard?.totals ?? []);
        if (nextReport.seasonProfitComparison) {
          setProfit((prev) => prev ?? { ...nextReport.seasonProfitComparison, currentSeason: nextReport.season });
        }
      }
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const currentGw = state?.currentGw ?? 'GW1';
  const currentSeason = state?.currentSeason ?? 'S1';

  const currentFixtures = useMemo(() => (
    allFixtures.filter((fixture) => fixture.gw === currentGw).sort((left, right) => {
      const divisionDelta = gwOrderValue(left.division) - gwOrderValue(right.division);
      if (divisionDelta !== 0) return divisionDelta;
      return left.id - right.id;
    })
  ), [allFixtures, currentGw]);

  const resolvedCount = currentFixtures.filter((fixture) => fixture.result !== 'pending').length;
  const pendingCount = currentFixtures.length - resolvedCount;

  const divisionNames = useMemo(() => sortDivisionNames(Object.keys(table), currentSeason), [table, currentSeason]);

  const formByTeamName = useMemo(() => {
    const map = new Map<string, FormBadgeResult[]>();
    teams.forEach((team) => {
      const form = recentForm({
        fixtures: allFixtures,
        include: (f) => f.result !== 'pending' && isOfficialDivisionFixture(f.division, f.gw) && (f.homeTeam === team.name || f.awayTeam === team.name),
        resultOf: (f) => resultForTeam(f.result, f.homeTeam === team.name),
        getGw: (f) => f.gw,
        getSecondarySort: (f) => f.id,
      });
      if (form.length > 0) map.set(team.name, form);
    });
    return map;
  }, [allFixtures, teams]);

  const movementByTeamId = useMemo(() => {
    const map = new Map<number, number>();
    Object.entries(movement).forEach(([, byTeam]) => {
      Object.entries(byTeam).forEach(([teamId, delta]) => map.set(Number(teamId), delta));
    });
    return map;
  }, [movement]);

  const summary = useMemo(() => {
    if (!ratings.length) return null;
    const bestRated = [...ratings].sort((a, b) => b.rating - a.rating)[0];
    const mostProfit = [...ratings].sort((a, b) => b.profit - a.profit)[0];
    const bestWinRate = [...ratings].filter((r) => r.wins > 0).sort((a, b) => b.winRate - a.winRate)[0];
    const mostSpins = [...ratings].sort((a, b) => b.entries - a.entries)[0];
    return { bestRated, mostProfit, bestWinRate, mostSpins };
  }, [ratings]);

  const featuredRivalry = useMemo(() => rivalries[0] ?? null, [rivalries]);

  const nextAction = useMemo<{ label: string; detail: string; to: string; tone: 'alert' | 'ready' | 'idle' } | null>(() => {
    if (penaltyQueue.length > 0) {
      const first = penaltyQueue[0];
      return { label: `${penaltyQueue.length} penalty tie${penaltyQueue.length === 1 ? '' : 's'} to settle`, detail: `${first.homeTeamName} vs ${first.awayTeamName} (${first.roundName})`, to: '/insights', tone: 'alert' };
    }
    if (currentGw === 'GW1' && state && !state.cupDrawStarted) {
      return { label: 'Cup draw not started', detail: 'Run the GW1 draw ceremony before the show', to: '/cup-draw', tone: 'alert' };
    }
    if (pendingCount > 0) {
      return { label: `${pendingCount} fixture${pendingCount === 1 ? '' : 's'} still to play`, detail: 'Log results from the gameshow or manual entry', to: '/entries', tone: 'alert' };
    }
    if (state && !state.gwLocked && currentFixtures.length > 0) {
      return { label: 'Gameweek complete', detail: 'Lock the gameweek and advance to the next one', to: '/insights', tone: 'ready' };
    }
    return { label: 'Ready for the show', detail: 'Everything is settled — time to present', to: '/gameshow', tone: 'idle' };
  }, [currentFixtures.length, currentGw, pendingCount, penaltyQueue, state]);

  const cupStatusForCurrentGw = useMemo(() => {
    const row = cupStatusRows.find((status) => status.gw === currentGw) ?? null;
    if (!row) return null;
    return row.resolvedFixtures >= row.totalFixtures && row.totalFixtures > 0;
  }, [cupStatusRows, currentGw]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    let id = 0;
    const nextId = () => `feed-${++id}`;
    const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

    storylines.forEach((story) => {
      items.push({ id: nextId(), category: 'storyline', icon: '!', label: 'Storyline', headline: story.headline, detail: story.detail, tone: story.tone, metric: story.metric });
    });

    const risers = trends.filter((t) => t.rankDelta < 0).sort((a, b) => a.rankDelta - b.rankDelta).slice(0, 2);
    const hotStreaks = trends.filter((t) => (t.pointsDeltaVsPreviousWindow ?? 0) > 0).sort((a, b) => (b.pointsDeltaVsPreviousWindow ?? 0) - (a.pointsDeltaVsPreviousWindow ?? 0)).slice(0, 2);
    const coldStreaks = trends.filter((t) => (t.pointsDeltaVsPreviousWindow ?? 0) < 0).sort((a, b) => (a.pointsDeltaVsPreviousWindow ?? 0) - (b.pointsDeltaVsPreviousWindow ?? 0)).slice(0, 1);
    risers.forEach((t) => {
      const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
      const delta = Math.abs(t.rankDelta);
      items.push({ id: nextId(), category: 'momentum', icon: '↑', label: 'On The Rise', headline: `${name} climbed ${delta} place${delta === 1 ? '' : 's'}`, detail: `Surged up the standings — momentum is building`, tone: 'positive', metric: `+${delta} places` });
    });
    hotStreaks.forEach((t) => {
      const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
      const delta = t.pointsDeltaVsPreviousWindow ?? 0;
      items.push({ id: nextId(), category: 'momentum', icon: '🔥', label: 'On Fire', headline: `${name} is heating up`, detail: `Earned ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} more points than before — red-hot form`, tone: 'positive', metric: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts` });
    });
    coldStreaks.forEach((t) => {
      const name = teamNameById.get(t.teamId) ?? `Team #${t.teamId}`;
      const delta = t.pointsDeltaVsPreviousWindow ?? 0;
      items.push({ id: nextId(), category: 'momentum', icon: '🥶', label: 'Cold Spell', headline: `${name} has gone cold`, detail: `${delta.toFixed(1)} points fewer in recent games — a worrying slide`, tone: 'warning', metric: `${delta.toFixed(1)} pts` });
    });

    const shocks = currentFixtures
      .filter((f) => f.result !== 'pending')
      .map((f) => {
        const margin = Math.abs(f.homeProfit - f.awayProfit);
        const winner = f.result === 'home' ? f.homeTeam : f.awayTeam;
        const loser = f.result === 'home' ? f.awayTeam : f.homeTeam;
        const loserProfit = f.result === 'home' ? f.awayProfit : f.homeProfit;
        const winnerProfit = f.result === 'home' ? f.homeProfit : f.awayProfit;
        return { fixture: f, margin, winner, loser, loserProfit, winnerProfit };
      })
      .filter((s) => s.loserProfit >= 2 && s.winnerProfit < s.loserProfit)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 3);
    shocks.forEach((s) => {
      items.push({ id: nextId(), category: 'shock', icon: '⚡', label: 'Shock Result', headline: `${s.winner} beat ${s.loser}`, detail: `${s.loser} had +£${s.loserProfit.toFixed(2)} profit but lost — massive upset in ${displayDivisionName(s.fixture.division)}`, tone: 'warning', metric: displayDivisionName(s.fixture.division) });
    });

    achievements.slice(0, 6).forEach((a) => {
      items.push({ id: nextId(), category: 'honours', icon: '★', label: 'Milestone', headline: a.teamName, detail: `${a.label}: ${a.value}`, tone: 'positive', metric: a.value });
    });

    if (predScores.length >= 2) {
      const sorted = [...predScores].sort((a, b) => b.points - a.points);
      const leader = sorted[0];
      const chaser = sorted[1];
      items.push({ id: nextId(), category: 'prediction', icon: '🎯', label: 'Prediction Race', headline: `${leader.picker} leads with ${leader.points} pts`, detail: `${leader.picker}: ${leader.correct}/${leader.total} correct — ${chaser.picker} trails by ${leader.points - chaser.points}`, tone: 'positive', metric: `${leader.points} pts` });
    }

    if (featuredRivalry) {
      items.push({ id: nextId(), category: 'rivalry', icon: '⚔', label: 'Rivalry', headline: featuredRivalry.matchup, detail: `${featuredRivalry.record} — ${featuredRivalry.narrative}`, tone: 'neutral', metric: featuredRivalry.edge });
    }

    return items;
  }, [achievements, currentFixtures, featuredRivalry, predScores, storylines, teams, trends]);

  const filteredFeed = useMemo(() => (
    feedFilter === 'all' ? feed : feed.filter((item) => item.category === feedFilter)
  ), [feed, feedFilter]);

  const visibleFixtures = useMemo(() => (
    currentFixtures.filter((fixture) => {
      if (fixtureFilter === 'pending' && fixture.result === 'pending') return true;
      if (fixtureFilter === 'resolved' && fixture.result !== 'pending') return true;
      return fixtureFilter === 'all';
    })
  ), [currentFixtures, fixtureFilter]);

  const [expandedFixtureId, setExpandedFixtureId] = useState<number | null>(null);
  const [h2h, setH2h] = useState<{ teamA: H2HTeam; teamB: H2HTeam; context: string } | null>(null);

  const openH2h = (homeName: string, awayName: string, division: string, gw: string) => {
    const home = teams.find((team) => team.name === homeName);
    const away = teams.find((team) => team.name === awayName);
    if (!home || !away) {
      return;
    }
    setH2h({ teamA: home, teamB: away, context: `${displayDivisionName(division)} • ${gw}` });
  };

  const standingsRows = useMemo(() => {
    const rows: Array<StandingRow & { form: FormBadgeResult[]; delta: number | null }> = [];
    divisionNames.forEach((division) => {
      (table[division] ?? []).slice().sort((a, b) => a.rank - b.rank).forEach((row) => {
        rows.push({ ...row, form: formByTeamName.get(row.teamName) ?? [], delta: movementByTeamId.get(row.teamId) ?? null });
      });
    });
    return rows;
  }, [divisionNames, formByTeamName, movementByTeamId, table]);

  const toggleFocusTeam = (teamId: number) => {
    setFocusedTeamId((prev) => (prev === teamId ? null : teamId));
  };

  if (loading && standingsRows.length === 0) {
    return (
      <section className="page page-wide home-cmd-page">
        <div className="home-cmd-empty"><p className="muted">Loading command centre...</p></div>
      </section>
    );
  }

  return (
    <section className="page page-wide home-cmd-page">
      <div className="home-cmd-header">
        <div>
          <span className="hub-showcase-kicker">BookieBall</span>
          <h1>Command Centre</h1>
          <p className="muted">Everything that matters in {currentSeason} {currentGw} — at a glance.</p>
        </div>
        <div className="home-cmd-meta">
          <span className="home-cmd-live-dot" aria-hidden="true" />
          <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Loading...'}</span>
          <button type="button" className="secondary" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {message && <p className="muted" style={{ color: 'var(--danger)' }}>{message}</p>}

      {/* ── Quick actions ─────────────────────────────── */}
      <div className="home-quick-actions">
        <Link to="/gameshow" className="home-quick-action primary">▶ Start the Show</Link>
        <Link to="/sky-sports-news" className="home-quick-action">Sky Sports News</Link>
        <Link to="/gameshow" className="home-quick-action">Kick-Off Show</Link>
        <Link to="/trophy-room" className="home-quick-action">Trophy Room</Link>
        <Link to="/matchday" className="home-quick-action">Matchday Wall</Link>
        <Link to="/head-to-head" className="home-quick-action">Head to Head</Link>
        <Link to="/entries" className="home-quick-action">Manual Entry</Link>
        <Link to="/cup-draw" className="home-quick-action">Cup Draw</Link>
        <Link to="/fixtures" className="home-quick-action">All Fixtures</Link>
        <Link to="/insights" className="home-quick-action">Admin & Tools</Link>
      </div>

      {/* ── Status strip ──────────────────────────────── */}
      <div className="home-now-strip">
        <Link to="/insights" className={`home-now-card ${state?.gwLocked ? 'is-idle' : 'is-warn'}`}>
          <span className="home-now-label">Gameweek</span>
          <strong className="home-now-value">{state?.gwLocked ? 'Locked' : 'Unlocked'}</strong>
          <span className="home-now-sub">{currentSeason} {currentGw}</span>
        </Link>
        <Link to="/insights" className={`home-now-card ${penaltyQueue.length > 0 ? 'is-alert' : 'is-idle'}`}>
          <span className="home-now-label">Penalties</span>
          <strong className="home-now-value">{penaltyQueue.length > 0 ? `${penaltyQueue.length} waiting` : 'Queue clear'}</strong>
          {penaltyQueue.length > 0 && <span className="home-now-sub">{penaltyQueue[0].homeTeamName} vs {penaltyQueue[0].awayTeamName}</span>}
          {penaltyQueue.length === 0 && <span className="home-now-sub">No ties level</span>}
        </Link>
        <Link to="/cup-draw" className={`home-now-card ${currentGw === 'GW1' && state && !state.cupDrawStarted ? 'is-alert' : 'is-idle'}`}>
          <span className="home-now-label">Cup Draw</span>
          <strong className="home-now-value">{state?.cupDrawStarted ? 'Draw complete' : 'Not started'}</strong>
          <span className="home-now-sub">{cupStatusForCurrentGw === null ? 'GW1 ceremony' : cupStatusForCurrentGw ? 'Round resolved' : 'Round live'}</span>
        </Link>
        <Link to="/matchday" className={`home-now-card ${pendingCount > 0 ? 'is-warn' : 'is-idle'}`}>
          <span className="home-now-label">Fixtures</span>
          <strong className="home-now-value">{resolvedCount} / {currentFixtures.length}</strong>
          <span className="home-now-sub">{pendingCount > 0 ? `${pendingCount} to play` : 'All resolved'}</span>
        </Link>
        <Link to="/entries" className="home-now-card is-idle">
          <span className="home-now-label">Entries</span>
          <strong className="home-now-value">{gwEntryCount ?? '—'}</strong>
          <span className="home-now-sub">logged in {currentGw}</span>
        </Link>
      </div>

      {/* ── Next action banner ────────────────────────── */}
      {nextAction && (
        <div className={`home-next-card tone-${nextAction.tone}`}>
          <div>
            <span className="home-next-kicker">Next up</span>
            <strong className="home-next-title">{nextAction.label}</strong>
            <span className="home-next-detail">{nextAction.detail}</span>
          </div>
          <Link to={nextAction.to} className="home-next-cta">Go</Link>
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────── */}
      <div className="home-cmd-grid">
        <div className="home-cmd-main">
          {/* This Gameweek fixtures */}
          <section className="home-panel">
            <div className="home-panel-head">
              <div>
                <span className="home-panel-kicker">This Gameweek</span>
                <h2>Fixtures — {currentGw}</h2>
              </div>
              <div className="home-chip-row">
                {(['all', 'pending', 'resolved'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`home-chip${fixtureFilter === filter ? ' active' : ''}`}
                    onClick={() => setFixtureFilter(filter)}
                  >
                    {filter === 'all' ? `All (${currentFixtures.length})` : filter === 'pending' ? `To play (${pendingCount})` : `Resolved (${resolvedCount})`}
                  </button>
                ))}
              </div>
            </div>

            {focusedTeamId !== null && (
              <div className="home-focus-hint">
                Focusing on <strong>{teamById.get(focusedTeamId)?.name ?? ''}</strong> — click a fixture or the row again to clear.
                <button type="button" className="home-focus-clear" onClick={() => setFocusedTeamId(null)}>Clear focus</button>
              </div>
            )}

            {visibleFixtures.length === 0 ? (
              <p className="muted">No fixtures in this view.</p>
            ) : (
              <div className="home-fixture-grid">
                {visibleFixtures.map((fixture) => {
                  const isExpanded = expandedFixtureId === fixture.id;
                  const isRelated = focusedTeamId !== null && (
                    (teamById.get(focusedTeamId)?.name ?? '') === fixture.homeTeam
                    || (teamById.get(focusedTeamId)?.name ?? '') === fixture.awayTeam
                  );
                  const winnerName = fixture.result === 'home' ? fixture.homeTeam : fixture.result === 'away' ? fixture.awayTeam : null;
                  return (
                    <button
                      key={fixture.id}
                      type="button"
                      className={`home-fixture${fixture.result !== 'pending' ? ' is-resolved' : ''}${isExpanded ? ' is-expanded' : ''}${isRelated ? ' is-related' : ''}`}
                      onClick={() => {
                        setExpandedFixtureId((prev) => (prev === fixture.id ? null : fixture.id));
                        if (isRelated) setFocusedTeamId(null);
                      }}
                    >
                      <div className="home-fixture-top">
                        <span className="home-fixture-division">{displayDivisionName(fixture.division)}</span>
                        <span className={`home-fixture-result result-${fixture.result}`}>
                          {fixture.result === 'pending' ? 'TBD' : fixture.result === 'draw' ? 'DRAW' : `${winnerName} wins`}
                        </span>
                      </div>
                      <div className="home-fixture-teams">
                        <span className="home-fixture-team">
                          <TeamBadge
                            name={fixture.homeTeam}
                            ballColor={teamById.get(teams.find((team) => team.name === fixture.homeTeam)?.id ?? -1)?.ballColor ?? null}
                            ringColor={teamById.get(teams.find((team) => team.name === fixture.homeTeam)?.id ?? -1)?.ringColor ?? null}
                            textColor={teamById.get(teams.find((team) => team.name === fixture.homeTeam)?.id ?? -1)?.textColor ?? null}
                            size={24}
                          />
                          <strong className={focusedTeamId !== null && teamById.get(focusedTeamId)?.name === fixture.homeTeam ? 'is-focused' : ''}>{fixture.homeTeam}</strong>
                        </span>
                        <span className="home-fixture-score">
                          {fixture.result === 'pending' ? 'vs' : `${signed(fixture.homeProfit)} : ${signed(fixture.awayProfit)}`}
                        </span>
                        <span className="home-fixture-team">
                          <strong className={focusedTeamId !== null && teamById.get(focusedTeamId)?.name === fixture.awayTeam ? 'is-focused' : ''}>{fixture.awayTeam}</strong>
                          <TeamBadge
                            name={fixture.awayTeam}
                            ballColor={teamById.get(teams.find((team) => team.name === fixture.awayTeam)?.id ?? -1)?.ballColor ?? null}
                            ringColor={teamById.get(teams.find((team) => team.name === fixture.awayTeam)?.id ?? -1)?.ringColor ?? null}
                            textColor={teamById.get(teams.find((team) => team.name === fixture.awayTeam)?.id ?? -1)?.textColor ?? null}
                            size={24}
                          />
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="home-fixture-expand">
                          <div className="home-fixture-metrics">
                            <span className="home-fixture-metric">
                              <span className="home-fixture-metric-label">Profit</span>
                              <strong>{signed(fixture.homeProfit)} : {signed(fixture.awayProfit)}</strong>
                            </span>
                            <span className="home-fixture-metric">
                              <span className="home-fixture-metric-label">Spins</span>
                              <strong>{fixture.homeSpins} : {fixture.awaySpins}</strong>
                            </span>
                            <span className="home-fixture-metric">
                              <span className="home-fixture-metric-label">Form</span>
                              <span className="home-fixture-forms">
                                {formByTeamName.get(fixture.homeTeam)?.slice(-5).map((result, index) => (
                                  <span key={`home-form-${index}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</span>
                                ))}
                                <span className="home-fixture-forms-vs">vs</span>
                                {formByTeamName.get(fixture.awayTeam)?.slice(-5).map((result, index) => (
                                  <span key={`away-form-${index}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</span>
                                ))}
                              </span>
                            </span>
                          </div>
                          <span
                            role="button"
                            tabIndex={0}
                            className="home-fixture-h2h-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              openH2h(fixture.homeTeam, fixture.awayTeam, fixture.division, fixture.gw);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                openH2h(fixture.homeTeam, fixture.awayTeam, fixture.division, fixture.gw);
                              }
                            }}
                          >
                            Head to Head
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Standings */}
          <section className="home-panel">
            <div className="home-panel-head">
              <div>
                <span className="home-panel-kicker">Division Standings</span>
                <h2>Table</h2>
              </div>
              <div className="home-chip-row">
                <button type="button" className={`home-chip${activeDivision === 'all' ? ' active' : ''}`} onClick={() => setActiveDivision('all')}>All</button>
                {divisionNames.map((division) => (
                  <button key={division} type="button" className={`home-chip${activeDivision === division ? ' active' : ''}`} onClick={() => setActiveDivision(division)}>
                    {displayDivisionName(division)}
                  </button>
                ))}
              </div>
            </div>

            <div className="home-standings-wrap">
              <div className="home-standings-head">
                <span className="home-standings-col team">Team</span>
                <span className="home-standings-col num">P</span>
                <span className="home-standings-col num">W</span>
                <span className="home-standings-col num">D</span>
                <span className="home-standings-col num">L</span>
                <span className="home-standings-col num">Pts</span>
                <span className="home-standings-col num">Profit</span>
                <span className="home-standings-col form">Form</span>
              </div>
              <div className="home-standings-body">
                {standingsRows
                  .filter((row) => activeDivision === 'all' || row.division === activeDivision)
                  .map((row) => {
                    const focused = focusedTeamId === row.teamId;
                    const delta = row.delta;
                    return (
                      <button
                        key={`${row.division}-${row.teamId}`}
                        type="button"
                        className={`home-standing-row${focused ? ' is-focused' : ''}`}
                        onClick={() => toggleFocusTeam(row.teamId)}
                      >
                        <span className="home-standings-col team">
                          <span className="home-standing-rank">{row.rank}</span>
                          <TeamBadge
                            name={row.teamName}
                            ballColor={teamById.get(row.teamId)?.ballColor ?? null}
                            ringColor={teamById.get(row.teamId)?.ringColor ?? null}
                            textColor={teamById.get(row.teamId)?.textColor ?? null}
                            size={22}
                          />
                          <span className="home-standing-name">{row.teamName}</span>
                          {delta !== null && delta !== 0 && (
                            <span className={`home-movement-badge ${delta < 0 ? 'up' : 'down'}`}>{delta < 0 ? '↑' : '↓'} {Math.abs(delta)}</span>
                          )}
                        </span>
                        <span className="home-standings-col num">{row.played}</span>
                        <span className="home-standings-col num">{row.wins}</span>
                        <span className="home-standings-col num">{row.draws}</span>
                        <span className="home-standings-col num">{row.losses}</span>
                        <span className="home-standings-col num">{row.points}</span>
                        <span className={`home-standings-col num ${row.profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>{signed(row.profit)}</span>
                        <span className="home-standings-col form">
                          {row.form.length > 0 ? row.form.slice(-5).map((result, index) => (
                            <span key={`${row.teamId}-form-${index}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</span>
                          )) : <span className="muted">—</span>}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
            <p className="home-panel-foot">
              <Link to="/leagues">All league views →</Link>
              <span className="home-focus-hint-inline">Click a team to spotlight their fixtures.</span>
            </p>
          </section>
        </div>

        <div className="home-cmd-side">
          {/* Story feed */}
          <section className="home-panel">
            <div className="home-panel-head">
              <div>
                <span className="home-panel-kicker">Season Feed</span>
                <h2>Stories</h2>
              </div>
            </div>
            <div className="home-chip-row">
              <button type="button" className={`home-chip${feedFilter === 'all' ? ' active' : ''}`} onClick={() => setFeedFilter('all')}>All ({feed.length})</button>
              {(Object.keys(FEED_CATEGORY_LABELS) as FeedCategory[]).map((category) => {
                const count = feed.filter((item) => item.category === category).length;
                if (count === 0) return null;
                return (
                  <button key={category} type="button" className={`home-chip${feedFilter === category ? ' active' : ''}`} onClick={() => setFeedFilter(category)}>
                    {FEED_CATEGORY_LABELS[category]} ({count})
                  </button>
                );
              })}
            </div>

            <div className="home-feed-list">
              {filteredFeed.length === 0 ? (
                <p className="muted">No stories yet this week.</p>
              ) : (
                filteredFeed.map((item) => {
                  const tone = TONE_STYLES[item.tone];
                  return (
                    <article key={item.id} className="home-feed-item" style={{ borderColor: tone.border, background: tone.bg }}>
                      <div className="home-feed-top">
                        <span className="home-feed-badge" style={{ background: tone.badge, color: tone.text }}>
                          {item.icon} {item.label}
                        </span>
                        <span className="home-feed-cat">{FEED_CATEGORY_LABELS[item.category]}</span>
                      </div>
                      <strong className="home-feed-headline">{item.headline}</strong>
                      <p className="home-feed-detail">{item.detail}</p>
                      {item.metric && <span className="home-feed-metric" style={{ color: tone.text }}>{item.metric}</span>}
                    </article>
                  );
                })
              )}
            </div>

            {tickerItems.length > 0 && (
              <div className="home-news-list">
                <span className="home-news-head">In the news</span>
                {tickerItems.slice(0, 6).map((item, index) => (
                  <span key={`news-${index}`} className="home-news-item">› {item}</span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Spotlights ────────────────────────────────── */}
      <div className="home-spotlights">
        {bookieDor && (
          <div className="home-spotlight-card">
            <div className="home-spotlight-head">
              <span className="home-spotlight-icon">🏆</span>
              <span className="home-spotlight-label">BookieDor MVP</span>
            </div>
            <strong className="home-spotlight-title">{bookieDor.teamName}</strong>
            <div className="home-spotlight-meta">
              <span>Score: {bookieDor.score.toFixed(1)}</span>
              <span>League: {bookieDor.weightedLeagueScore.toFixed(1)}</span>
              <span>Cup: {bookieDor.weightedCupScore.toFixed(1)}</span>
              <span>Master: {bookieDor.weightedMasterScore.toFixed(1)}</span>
            </div>
          </div>
        )}

        {featuredRivalry && (
          <div className="home-spotlight-card">
            <div className="home-spotlight-head">
              <span className="home-spotlight-icon">⚔</span>
              <span className="home-spotlight-label">Rivalry Spotlight</span>
            </div>
            <strong className="home-spotlight-title">{featuredRivalry.matchup}</strong>
            <div className="home-spotlight-meta">
              <span>Record: {featuredRivalry.record}</span>
              <span>Edge: {featuredRivalry.edge}</span>
              <span>Avg margin: {featuredRivalry.avgMargin}</span>
            </div>
            <p className="home-spotlight-desc">{featuredRivalry.narrative}</p>
          </div>
        )}

        {predScores.length >= 2 && (
          <div className="home-spotlight-card">
            <div className="home-spotlight-head">
              <span className="home-spotlight-icon">🎯</span>
              <span className="home-spotlight-label">Prediction Contest</span>
            </div>
            <div className="home-pred-bar">
              {[...predScores].sort((a, b) => b.points - a.points).map((p, i) => (
                <div key={p.picker} className="home-pred-row">
                  <span className="home-pred-rank">#{i + 1}</span>
                  <span className="home-pred-name">{p.picker}</span>
                  <span className="home-pred-pts">{p.points} pts</span>
                  <span className="home-pred-acc">{p.correct}/{p.total} ({p.total > 0 ? ((p.correct / p.total) * 100).toFixed(0) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Stat tiles + chart ────────────────────────── */}
      <div className="home-stat-tiles">
        {summary && (
          <>
            <StatTile label="Top Rated" value={summary.bestRated?.teamName ?? '-'} note={`Rating: ${summary.bestRated ? (summary.bestRated.rating >= 0 ? '+' : '') + summary.bestRated.rating.toFixed(3) : '-'}`} accent="gold" />
            <StatTile label="Best Profit" value={summary.mostProfit ? `+£${summary.mostProfit.profit.toFixed(2)}` : '-'} note={`by ${summary.mostProfit?.teamName ?? '-'}`} accent="blue" />
            <StatTile label="Best Win Rate" value={summary.bestWinRate ? `${(summary.bestWinRate.winRate * 100).toFixed(1)}%` : '-'} note={`by ${summary.bestWinRate?.teamName ?? '-'}`} accent="red" />
            <StatTile label="Most Spins Taken" value={summary.mostSpins ? `${summary.mostSpins.entries}` : '-'} note={`by ${summary.mostSpins?.teamName ?? '-'}`} accent="steel" />
          </>
        )}
      </div>

      <div className="home-analytics-chart">
        <SeasonProfitChart profitData={profit} />
      </div>

      {h2h && <HeadToHeadModal teamA={h2h.teamA} teamB={h2h.teamB} context={h2h.context} onClose={() => setH2h(null)} />}
    </section>
  );
}
