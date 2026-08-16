import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName, sortDivisionNames } from '../lib/divisionLabels';
import '../command-centre.css';

type State = Awaited<ReturnType<typeof api.state>>;
type Team = Awaited<ReturnType<typeof api.teams>>[number];
type LeagueTable = Awaited<ReturnType<typeof api.leagueTable>>;
type MasterTable = Awaited<ReturnType<typeof api.masterLeagueTable>>;
type TrioTable = Awaited<ReturnType<typeof api.trioLeagueTable>>;
type TierTable = Awaited<ReturnType<typeof api.tierLeagueTable>>;
type AllTime = Awaited<ReturnType<typeof api.allTimeLeagues>>;
type Rating = Awaited<ReturnType<typeof api.teamRatings>>[number];
type BookieDor = Awaited<ReturnType<typeof api.bookieDor>>;
type ReportPack = Awaited<ReturnType<typeof api.reportPack>>;
type H2H = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

type Row = {
  rank: number;
  name: string;
  value: string;
  detail?: string;
  teamId?: number;
};

type NormalizedFixture = {
  key: string;
  id: number;
  competition: 'league' | 'master' | 'trio' | 'tier';
  division?: string;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  result: 'home' | 'away' | 'draw' | 'pending';
  h2h: H2H | null;
};

type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  tone?: 'blue' | 'gold' | 'green' | 'red';
  metric?: string;
  metricLabel?: string;
  rows?: Row[];
  fixtures?: NormalizedFixture[];
  story?: string;
};

type Dashboard = {
  state: State;
  teams: Team[];
  leagueTable: LeagueTable;
  master: MasterTable | null;
  trio: TrioTable | null;
  tier: TierTable | null;
  allTime: AllTime | null;
  ratings: Rating[];
  bookieDor: BookieDor | null;
  report: ReportPack | null;
  fixtures: NormalizedFixture[];
};

const PAGE_BG = 'radial-gradient(circle at 15% 15%, rgba(22,96,170,.22), transparent 34%), radial-gradient(circle at 85% 5%, rgba(226,176,54,.15), transparent 28%), linear-gradient(145deg, #06111f 0%, #081a2d 54%, #050c16 100%)';
const PANEL_BG = 'linear-gradient(145deg, rgba(13,31,51,.96), rgba(7,19,33,.96))';
const TEXT = '#f7fbff';
const MUTED = '#91a8bd';
const BORDER = '1px solid rgba(168,198,225,.14)';
const NORMAL_MS = 11_000;
const LONG_MS = 17_000;

function signed(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(digits)}`;
}

function pairKey(home: string, away: string): string {
  return `${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
}

function accent(tone: Slide['tone']): string {
  if (tone === 'gold') return '#f2c14e';
  if (tone === 'green') return '#5cd68a';
  if (tone === 'red') return '#ff7a84';
  return '#5eb7ff';
}

function statusLabel(fixture: NormalizedFixture): string {
  if (fixture.result === 'pending') return 'TO PLAY';
  if (fixture.result === 'draw') return 'DRAW';
  return fixture.result === 'home' ? `${fixture.homeTeam} WIN` : `${fixture.awayTeam} WIN`;
}

function rowsFor<T extends { teamId: number; teamName: string }>(rows: T[], value: (row: T) => string, detail?: (row: T) => string): Row[] {
  return rows.map((row, index) => ({
    rank: Number('rank' in row ? (row as T & { rank?: number }).rank : index + 1) || index + 1,
    name: row.teamName,
    value: value(row),
    detail: detail?.(row),
    teamId: row.teamId,
  }));
}

function AutoPan({ children, className }: { children: React.ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTop = 0;
    let frame = 0;
    let timer = 0;
    const start = () => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      if (max <= 8) return;
      const leadIn = 1400;
      const travel = Math.max(7000, Math.min(12_500, 6000 + max * 8));
      const started = performance.now();
      const tick = (now: number) => {
        const elapsed = now - started;
        if (elapsed < leadIn) {
          frame = requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min(1, (elapsed - leadIn) / travel);
        const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        node.scrollTop = max * eased;
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    timer = window.setTimeout(start, 160);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [children]);

  return <div ref={ref} className={className}>{children}</div>;
}

function FixtureCard({ fixture, color }: { fixture: NormalizedFixture; color: string }) {
  const h2h = fixture.h2h;
  return (
    <article className={`command-fixture${fixture.result === 'pending' ? ' is-pending' : ''}`} style={{ borderLeftColor: color }}>
      <div className="command-fixture-topline">
        <span>{statusLabel(fixture)}</span>
      </div>
      <div className="command-fixture-matchup">
        <strong>{fixture.homeTeam}</strong>
        <span className="command-fixture-scoreline">{signed(fixture.homeProfit)} <b>VS</b> {signed(fixture.awayProfit)}</span>
        <strong>{fixture.awayTeam}</strong>
      </div>
      <div className="command-fixture-h2h">
        {h2h
          ? `ALL-TIME H2H · ${fixture.homeTeam} ${h2h.teamAWins}W ${h2h.teamBWins}L ${h2h.draws}D · ${fixture.awayTeam} ${h2h.teamBWins}W ${h2h.teamAWins}L ${h2h.draws}D`
          : 'ALL-TIME H2H · No previous league meetings recorded'}
      </div>
    </article>
  );
}

export function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');

  const reload = useCallback(async () => {
    try {
      const state = await api.state();
      const [teams, leagueTable, master, trio, tier, allTime, ratings, bookieDor, report, leagueFixtures, masterFixtures, trioFixtures, tierFixtures] = await Promise.all([
        api.teams(),
        api.leagueTable(),
        api.masterLeagueTable().catch(() => null),
        api.trioLeagueTable().catch(() => null),
        api.tierLeagueTable().catch(() => null),
        api.allTimeLeagues().catch(() => null),
        api.teamRatings().catch(() => []),
        api.bookieDor().catch(() => null),
        api.reportPack().catch(() => null),
        api.leagueFixtures(state.currentGw, false).catch(() => []),
        api.masterLeagueFixtures(state.currentGw, false).catch(() => []),
        api.trioLeagueFixtures(state.currentGw, false).catch(() => []),
        api.tierLeagueFixtures(state.currentGw, false).catch(() => []),
      ]);

      const normalized: Omit<NormalizedFixture, 'h2h'>[] = [
        ...leagueFixtures.map((fixture) => ({ key: `league-${fixture.id}`, id: fixture.id, competition: 'league' as const, division: fixture.division, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
        ...masterFixtures.map((fixture) => ({ key: `master-${fixture.id}`, id: fixture.id, competition: 'master' as const, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
        ...trioFixtures.map((fixture) => ({ key: `trio-${fixture.id}`, id: fixture.id, competition: 'trio' as const, division: fixture.division, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
        ...tierFixtures.map((fixture) => ({ key: `tier-${fixture.id}`, id: fixture.id, competition: 'tier' as const, division: fixture.division, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
      ];

      const teamByName = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]));
      const h2hByPair = new Map<string, H2H | null>();
      await Promise.all(Array.from(new Set(normalized.map((fixture) => pairKey(fixture.homeTeam, fixture.awayTeam)))).map(async (key) => {
        const [homeName, awayName] = key.split('|');
        const home = teamByName.get(homeName);
        const away = teamByName.get(awayName);
        if (!home || !away) {
          h2hByPair.set(key, null);
          return;
        }
        const record = await api.headToHeadAllTime(home.id, away.id).catch(() => null);
        h2hByPair.set(key, record);
      }));

      const fixtures: NormalizedFixture[] = normalized.map((fixture) => ({ ...fixture, h2h: h2hByPair.get(pairKey(fixture.homeTeam, fixture.awayTeam)) ?? null }));
      setData({ state, teams, leagueTable, master, trio, tier, allTime, ratings, bookieDor, report, fixtures });
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load command centre.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 45_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const out: Slide[] = [];
    const season = data.state.currentSeason;
    const gw = data.state.currentGw;
    const divisionNames = sortDivisionNames(Object.keys(data.leagueTable), season);
    const leaders = divisionNames.map((division) => data.leagueTable[division]?.[0]).filter(Boolean);

    out.push({
      id: 'overview', kicker: 'BOOKIEBALL LIVE', title: `${season} · ${gw}`, subtitle: 'Live command centre', tone: 'blue',
      metric: String(data.teams.length), metricLabel: 'teams tracked',
      rows: leaders.map((row, index) => ({ rank: index + 1, name: displayDivisionName(row!.division), value: row!.teamName, detail: `${row!.points} pts · ${signed(row!.profit)} profit`, teamId: row!.teamId })),
    });

    divisionNames.forEach((division) => {
      const rows = [...(data.leagueTable[division] ?? [])].sort((a, b) => a.rank - b.rank);
      if (!rows.length) return;
      const fixtures = data.fixtures.filter((fixture) => fixture.competition === 'league' && fixture.division === division);
      out.push({
        id: `league-${division}`, kicker: 'DIVISION FOCUS', title: displayDivisionName(division), subtitle: `${season} ${gw} · standings and this gameweek's fixtures`, tone: 'blue',
        metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`,
        rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
        fixtures,
        story: rows[1] ? `${rows[0].teamName} lead ${rows[1].teamName} by ${rows[0].points - rows[1].points} points.` : undefined,
      });
    });

    if (data.master?.table.length) {
      const rows = [...data.master.table].sort((a, b) => a.rank - b.rank);
      out.push({
        id: 'master', kicker: 'COMPETITION ANALYTICS', title: 'Master League', subtitle: `${season} ${data.master.gw} · standings and this gameweek's fixtures`, tone: 'gold',
        metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`,
        rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
        fixtures: data.fixtures.filter((fixture) => fixture.competition === 'master'),
      });
    }

    if (data.trio?.enabled) {
      Array.from(new Set(data.trio.table.map((row) => row.division))).forEach((division) => {
        const rows = data.trio!.table.filter((row) => row.division === division).sort((a, b) => a.rank - b.rank);
        if (!rows.length) return;
        out.push({
          id: `trio-${division}`, kicker: 'TRIO LEAGUE', title: displayDivisionName(division), subtitle: `${season} ${data.trio!.gw} · standings and this gameweek's fixtures`, tone: 'green',
          metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`, rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
          fixtures: data.fixtures.filter((fixture) => fixture.competition === 'trio' && fixture.division === division),
        });
      });
    }

    if (data.tier?.enabled) {
      Array.from(new Set(data.tier.table.map((row) => row.division))).forEach((division) => {
        const rows = data.tier!.table.filter((row) => row.division === division).sort((a, b) => a.rank - b.rank);
        if (!rows.length) return;
        out.push({
          id: `tier-${division}`, kicker: 'TIER LEAGUE', title: displayDivisionName(division), subtitle: `${season} ${data.tier!.gw} · standings and this gameweek's fixtures`, tone: 'green',
          metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`, rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
          fixtures: data.fixtures.filter((fixture) => fixture.competition === 'tier' && fixture.division === division),
        });
      });
    }

    if (data.allTime) {
      out.push({ id: 'all-time-points', kicker: '16-SEASON ARCHIVE', title: 'All-Time League Table', subtitle: `${data.allTime.fromSeason} ${data.allTime.fromGw} → ${data.allTime.toSeason} ${data.allTime.toGw}`, tone: 'gold', metric: `${data.allTime.pointsTable[0]?.points ?? 0}`, metricLabel: 'record points', rows: rowsFor(data.allTime.pointsTable, (row) => `${row.points} pts`, (row) => `${row.wins} wins · ${signed(row.profit)} profit`) });
      out.push({ id: 'all-time-profit', kicker: '16-SEASON ARCHIVE', title: 'Greatest Profit Makers', subtitle: 'Career profit across every recorded season', tone: 'green', metric: signed(data.allTime.profitTable[0]?.profit ?? 0), metricLabel: data.allTime.profitTable[0]?.teamName ?? '', rows: rowsFor(data.allTime.profitTable, (row) => signed(row.profit), (row) => `${row.played} games · ${row.wins} wins`) });
      out.push({ id: 'all-time-spins', kicker: '16-SEASON ARCHIVE', title: 'Spin Kings', subtitle: 'Most spins across BookieBall history', tone: 'blue', metric: String(data.allTime.spinsTable[0]?.spins ?? 0), metricLabel: data.allTime.spinsTable[0]?.teamName ?? '', rows: rowsFor(data.allTime.spinsTable, (row) => `${row.spins} spins`, (row) => `${row.played} games · ${signed(row.profit)} profit`) });
    }

    if (data.ratings.length) {
      const byRating = [...data.ratings].sort((a, b) => b.rating - a.rating);
      const byProfit = [...data.ratings].sort((a, b) => b.profit - a.profit);
      out.push({ id: 'ratings', kicker: 'CURRENT FORM', title: 'Power Ratings', subtitle: `${season} strength ranking`, tone: 'blue', metric: byRating[0]?.rating.toFixed(3) ?? '—', metricLabel: byRating[0]?.teamName ?? '', rows: rowsFor(byRating, (row) => row.rating.toFixed(3), (row) => `${(row.winRate * 100).toFixed(0)}% win rate · ${signed(row.profit)}`) });
      out.push({ id: 'profit', kicker: 'CURRENT FORM', title: 'Season Profit Race', subtitle: `${season} to date`, tone: 'green', metric: signed(byProfit[0]?.profit ?? 0), metricLabel: byProfit[0]?.teamName ?? '', rows: rowsFor(byProfit, (row) => signed(row.profit), (row) => `${row.entries} entries · ${(row.winRate * 100).toFixed(0)}% win rate`) });
    }

    if (data.bookieDor?.leaderboard.length) {
      out.push({ id: 'bookiedor', kicker: 'MVP RACE', title: 'BookieDor', subtitle: `${data.bookieDor.season} ${data.bookieDor.gw}`, tone: 'gold', metric: data.bookieDor.holder?.score.toFixed(1) ?? '—', metricLabel: data.bookieDor.holder?.teamName ?? '', rows: rowsFor(data.bookieDor.leaderboard, (row) => row.score.toFixed(1), (row) => `${displayDivisionName(row.division)} · league rank ${row.leagueRank}`) });
    }

    data.fixtures.filter((fixture) => fixture.competition === 'league' && fixture.h2h && fixture.h2h.played > 0).slice(0, 5).forEach((fixture, index) => {
      const h2h = fixture.h2h!;
      out.push({
        id: `h2h-${index}`, kicker: 'ALL-TIME HEAD TO HEAD', title: `${fixture.homeTeam} vs ${fixture.awayTeam}`, subtitle: `Every recorded league meeting · ${h2h.played} meetings`, tone: 'red',
        metric: `${h2h.teamAWins} · ${h2h.draws} · ${h2h.teamBWins}`, metricLabel: 'home wins · draws · away wins',
        rows: [
          { rank: 1, name: fixture.homeTeam, value: `${h2h.teamAWins} wins`, detail: `${signed(h2h.teamAProfit)} career profit`, teamId: h2h.teamA.id },
          { rank: 2, name: 'Draws', value: String(h2h.draws) },
          { rank: 3, name: fixture.awayTeam, value: `${h2h.teamBWins} wins`, detail: `${signed(h2h.teamBProfit)} career profit`, teamId: h2h.teamB.id },
        ],
      });
    });

    data.report?.story.storylines.slice(0, 6).forEach((story, index) => {
      out.push({ id: `story-${index}`, kicker: 'LIVE STORYLINE', title: story.headline, subtitle: `${season} ${gw}`, tone: story.tone === 'positive' ? 'green' : story.tone === 'warning' ? 'red' : 'blue', metric: story.metric, story: story.detail });
    });

    return out;
  }, [data]);

  const active = slides[slideIndex] ?? null;
  const isLong = Boolean(active && ((active.rows?.length ?? 0) > 7 || (active.fixtures?.length ?? 0) > 4));
  const duration = isLong ? LONG_MS : NORMAL_MS;

  useEffect(() => {
    if (!active || paused || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      setSlideIndex((index) => (index + 1) % slides.length);
      setCycle((value) => value + 1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [active?.id, paused, slides.length, duration, cycle]);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  const go = (next: number) => {
    if (!slides.length) return;
    setSlideIndex((next + slides.length) % slides.length);
    setCycle((value) => value + 1);
  };

  if (loading && !data) return <section className="page page-wide command-centre-page" style={{ display: 'grid', placeItems: 'center', background: PAGE_BG }}><div style={{ color: MUTED }}>Loading BookieBall command centre…</div></section>;
  if (!active) return <section className="page page-wide command-centre-page" style={{ display: 'grid', placeItems: 'center', background: PAGE_BG }}><div style={{ color: MUTED }}>{error || 'No analytics available.'}</div></section>;

  const color = accent(active.tone);
  const ticker = data?.report?.story.tickerItems ?? [];
  const renderRows = active.rows?.map((row, index) => {
    const team = row.teamId ? teamById.get(row.teamId) : undefined;
    return (
      <div key={`${active.id}-${row.rank}-${row.name}-${index}`} className="command-row">
        <span className="command-row-rank" style={{ color: row.rank === 1 ? color : MUTED }}>#{row.rank}</span>
        <div className="command-row-team">
          {team && <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={24} />}
          <div><strong>{row.name}</strong>{row.detail && <small>{row.detail}</small>}</div>
        </div>
        <strong className="command-row-value" style={{ color: row.rank === 1 ? color : TEXT }}>{row.value}</strong>
      </div>
    );
  });

  return (
    <section className="page page-wide command-centre-page command-centre-v2" style={{ color: TEXT, background: PAGE_BG }}>
      <header className="command-centre-header">
        <div><div className="command-eyebrow">BOOKIEBALL COMMAND CENTRE</div><div className="command-subline">{data?.state.currentSeason} · {data?.state.currentGw} · auto analytics</div></div>
        <div className="command-header-actions">
          <div className="command-controls">
            <button type="button" className="command-nav-btn" onClick={() => window.dispatchEvent(new CustomEvent('bookieball:team-journey'))}>Team Journey</button>
            <button type="button" className="command-nav-btn" onClick={() => go(slideIndex - 1)}>← Prev</button>
            <button type="button" className="command-nav-btn" onClick={() => setPaused((value) => !value)}>{paused ? '▶ Play' : 'Ⅱ Pause'}</button>
            <button type="button" className="command-nav-btn" onClick={() => go(slideIndex + 1)}>Next →</button>
          </div>
          <div className="command-live"><span />LIVE<small>{lastUpdated ? `Updated ${lastUpdated}` : ''}</small></div>
        </div>
      </header>

      <div className="command-centre-stage">
        <article key={`${active.id}-${cycle}`} className="command-slide" style={{ ['--command-accent' as string]: color, background: PANEL_BG, borderTopColor: color }}>
          <div className="command-slide-head">
            <div>
              <div className="command-slide-kicker" style={{ color }}>{active.kicker}</div>
              <h1 className="command-slide-title">{active.title}</h1>
              <p>{active.subtitle}</p>
            </div>
            {active.metric && <div className="command-slide-metric"><strong style={{ color }}>{active.metric}</strong><span>{active.metricLabel}</span></div>}
          </div>

          <div className={`command-slide-body${active.fixtures?.length ? ' has-fixtures' : ''}`}>
            {active.fixtures?.length ? (
              <div className="command-division-layout command-native-layout">
                <section className="command-column">
                  <div className="command-section-label"><span>LIVE TABLE</span><span>{active.rows?.length ?? 0} TEAMS</span></div>
                  <AutoPan className="command-scroll-window command-table-native">{renderRows}</AutoPan>
                </section>
                <section className="command-column">
                  <div className="command-section-label"><span>{data?.state.currentGw} FIXTURES</span><span>{active.fixtures.length} GAMES</span></div>
                  <AutoPan className="command-scroll-window command-fixtures-native">{active.fixtures.map((fixture) => <FixtureCard key={fixture.key} fixture={fixture} color={color} />)}</AutoPan>
                </section>
              </div>
            ) : active.rows?.length ? (
              <section className="command-column command-single-column">
                {isLong && <div className="command-section-label"><span>FULL TABLE</span><span>AUTO-SCROLLING · {active.rows.length} ROWS</span></div>}
                <AutoPan className="command-scroll-window command-table-native">{renderRows}</AutoPan>
              </section>
            ) : active.story ? <div className="command-story">{active.story}</div> : null}
          </div>

          <footer className="command-slide-footer">
            {active.story && active.rows?.length ? <div className="command-slide-story">{active.story}</div> : <span />}
            <div className="command-progress-row"><div className="command-progress-track"><div key={`${active.id}-${cycle}-${paused}`} className="command-progress-fill" style={{ background: color, animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} /></div><span>{slideIndex + 1} / {slides.length}</span></div>
          </footer>
        </article>
      </div>

      <div className="command-ticker">{ticker.length ? <div className="command-ticker-track"><strong>LIVE DESK</strong>{[...ticker, ...ticker].join('   ·   ')}</div> : <span><strong>LIVE DESK</strong> BookieBall command centre running</span>}</div>
    </section>
  );
}
