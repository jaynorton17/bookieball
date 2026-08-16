import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName, sortDivisionNames } from '../lib/divisionLabels';
import '../command-centre.css';

type AppState = Awaited<ReturnType<typeof api.state>>;
type Team = Awaited<ReturnType<typeof api.teams>>[number];
type LeagueTable = Awaited<ReturnType<typeof api.leagueTable>>;
type MasterTable = Awaited<ReturnType<typeof api.masterLeagueTable>>;
type TrioTable = Awaited<ReturnType<typeof api.trioLeagueTable>>;
type TierTable = Awaited<ReturnType<typeof api.tierLeagueTable>>;
type AllTime = Awaited<ReturnType<typeof api.allTimeLeagues>>;
type Rating = Awaited<ReturnType<typeof api.teamRatings>>[number];
type ReportPack = Awaited<ReturnType<typeof api.reportPack>>;
type BookieDor = Awaited<ReturnType<typeof api.bookieDor>>;
type Fixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];
type H2H = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

type DashboardData = {
  state: AppState;
  teams: Team[];
  leagueTable: LeagueTable;
  master: MasterTable | null;
  trio: TrioTable | null;
  tier: TierTable | null;
  allTime: AllTime | null;
  ratings: Rating[];
  report: ReportPack | null;
  bookieDor: BookieDor | null;
  fixtures: Fixture[];
  h2h: H2H[];
};

type Row = {
  rank: number;
  name: string;
  value: string;
  detail?: string;
  teamId?: number;
};

type SlideFixture = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeProfit: number;
  awayProfit: number;
  result: Fixture['result'];
};

type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  metric?: string;
  metricLabel?: string;
  rows?: Row[];
  fixtures?: SlideFixture[];
  fixturesLabel?: string;
  story?: string;
  tone?: 'blue' | 'gold' | 'green' | 'red';
};

const PAGE_BG = 'radial-gradient(circle at 15% 15%, rgba(22,96,170,.22), transparent 34%), radial-gradient(circle at 85% 5%, rgba(226,176,54,.15), transparent 28%), linear-gradient(145deg, #06111f 0%, #081a2d 54%, #050c16 100%)';
const PANEL_BG = 'linear-gradient(145deg, rgba(13,31,51,.96), rgba(7,19,33,.96))';
const BORDER = '1px solid rgba(168,198,225,.14)';
const TEXT = '#f7fbff';
const MUTED = '#91a8bd';
const AUTO_ADVANCE_MS = 11_000;

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function topRows<T extends { teamId: number; teamName: string }>(
  rows: T[],
  value: (row: T) => string,
  detail?: (row: T) => string,
  limit = 6,
): Row[] {
  return rows.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    name: row.teamName,
    value: value(row),
    detail: detail?.(row),
    teamId: row.teamId,
  }));
}

function accentForTone(tone: Slide['tone']): string {
  if (tone === 'gold') return '#f2c14e';
  if (tone === 'green') return '#5cd68a';
  if (tone === 'red') return '#ff7a84';
  return '#5eb7ff';
}

function fixtureResultLabel(fixture: SlideFixture): string {
  if (fixture.result === 'pending') return 'TO PLAY';
  if (fixture.result === 'draw') return 'DRAW';
  return fixture.result === 'home' ? `${fixture.homeTeam} WIN` : `${fixture.awayTeam} WIN`;
}

export function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [paused, setPaused] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);

  const reload = useCallback(async () => {
    try {
      const state = await api.state();
      const [teams, leagueTable, master, trio, tier, allTime, ratings, report, bookieDor, fixtures] = await Promise.all([
        api.teams(),
        api.leagueTable(),
        api.masterLeagueTable().catch(() => null),
        api.trioLeagueTable().catch(() => null),
        api.tierLeagueTable().catch(() => null),
        api.allTimeLeagues().catch(() => null),
        api.teamRatings().catch(() => []),
        api.reportPack().catch(() => null),
        api.bookieDor().catch(() => null),
        api.leagueFixtures(undefined, true).catch(() => []),
      ]);

      const teamByName = new Map(teams.map((team) => [team.name, team]));
      const currentFixtures = fixtures.filter((fixture) => fixture.gw === state.currentGw).slice(0, 5);
      const h2h = (await Promise.all(
        currentFixtures.map(async (fixture) => {
          const home = teamByName.get(fixture.homeTeam);
          const away = teamByName.get(fixture.awayTeam);
          if (!home || !away) return null;
          return api.headToHeadAllTime(home.id, away.id).catch(() => null);
        }),
      )).filter((item): item is H2H => item !== null && item.played > 0);

      setData({ state, teams, leagueTable, master, trio, tier, allTime, ratings, report, bookieDor, fixtures, h2h });
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load command centre data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const refresh = window.setInterval(() => void reload(), 60_000);
    return () => window.clearInterval(refresh);
  }, [reload]);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const next: Slide[] = [];
    const season = data.state.currentSeason;
    const gw = data.state.currentGw;
    const divisionNames = sortDivisionNames(Object.keys(data.leagueTable), season);
    const leaders = divisionNames
      .map((division) => data.leagueTable[division]?.[0])
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    next.push({
      id: 'overview',
      kicker: 'BOOKIEBALL LIVE',
      title: `${season} · ${gw}`,
      subtitle: 'Your live BookieBall analytics channel — built to sit on screen and run itself.',
      metric: String(data.teams.length),
      metricLabel: 'teams tracked',
      rows: leaders.map((row, index) => ({
        rank: index + 1,
        name: displayDivisionName(row.division),
        value: row.teamName,
        detail: `${row.points} pts · ${signed(row.profit)} profit`,
        teamId: row.teamId,
      })),
      tone: 'blue',
    });

    divisionNames.forEach((division) => {
      const rows = [...(data.leagueTable[division] ?? [])].sort((a, b) => a.rank - b.rank);
      if (!rows.length) return;
      const leader = rows[0];
      const second = rows[1];
      const divisionFixtures = data.fixtures
        .filter((fixture) => fixture.gw === gw && fixture.division === division)
        .sort((a, b) => a.id - b.id)
        .map((fixture) => ({
          id: fixture.id,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeProfit: fixture.homeProfit,
          awayProfit: fixture.awayProfit,
          result: fixture.result,
        }));
      next.push({
        id: `division-${division}`,
        kicker: 'DIVISION FOCUS',
        title: displayDivisionName(division),
        subtitle: `${season} ${gw} · standings and this gameweek's fixtures`,
        metric: leader ? `${leader.points}` : '—',
        metricLabel: leader ? `${leader.teamName} points` : 'points',
        rows: topRows(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
        fixtures: divisionFixtures,
        fixturesLabel: `${gw} FIXTURES`,
        story: leader && second ? `${leader.teamName} lead ${second.teamName} by ${leader.points - second.points} point${Math.abs(leader.points - second.points) === 1 ? '' : 's'}.` : undefined,
        tone: 'blue',
      });
    });

    if (data.master?.table?.length) {
      const rows = [...data.master.table].sort((a, b) => a.rank - b.rank);
      next.push({ id: 'master-league', kicker: 'COMPETITION ANALYTICS', title: 'Master League', subtitle: `${season} ${data.master.gw} · overall standings`, metric: `${rows[0]?.points ?? 0}`, metricLabel: `${rows[0]?.teamName ?? 'Leader'} points`, rows: topRows(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W · ${signed(row.profit)} profit`), tone: 'gold' });
    }

    if (data.trio?.enabled && data.trio.table.length) {
      const rows = [...data.trio.table].sort((a, b) => a.rank - b.rank || a.division.localeCompare(b.division));
      next.push({ id: 'trio-league', kicker: 'COMPETITION ANALYTICS', title: 'Trio League', subtitle: `${season} ${data.trio.gw} · group-by-group picture`, metric: String(new Set(rows.map((row) => row.division)).size), metricLabel: 'active groups', rows: rows.slice(0, 8).map((row) => ({ rank: row.rank, name: `${row.teamName} · ${displayDivisionName(row.division)}`, value: `${row.points} pts`, detail: `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`, teamId: row.teamId })), tone: 'green' });
    }

    if (data.tier?.enabled && data.tier.table.length) {
      const rows = [...data.tier.table].sort((a, b) => a.rank - b.rank || a.division.localeCompare(b.division));
      next.push({ id: 'tier-league', kicker: 'COMPETITION ANALYTICS', title: 'Tier League', subtitle: `${season} ${data.tier.gw} · ${data.tier.started ? 'competition live' : 'competition pending'}`, metric: String(new Set(rows.map((row) => row.division)).size), metricLabel: 'tiers represented', rows: rows.slice(0, 8).map((row) => ({ rank: row.rank, name: `${row.teamName} · ${displayDivisionName(row.division)}`, value: `${row.points} pts`, detail: `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`, teamId: row.teamId })), tone: 'green' });
    }

    if (data.allTime) {
      next.push({ id: 'all-time-points', kicker: '16-SEASON ARCHIVE', title: 'All-Time League Table', subtitle: `${data.allTime.fromSeason} ${data.allTime.fromGw} → ${data.allTime.toSeason} ${data.allTime.toGw}`, metric: `${data.allTime.pointsTable[0]?.points ?? 0}`, metricLabel: 'record points total', rows: topRows(data.allTime.pointsTable, (row) => `${row.points} pts`, (row) => `${row.wins} wins · ${signed(row.profit)} profit`), tone: 'gold' });
      next.push({ id: 'all-time-profit', kicker: '16-SEASON ARCHIVE', title: 'Greatest Profit Makers', subtitle: 'Career profit across the full BookieBall archive', metric: signed(data.allTime.profitTable[0]?.profit ?? 0), metricLabel: data.allTime.profitTable[0]?.teamName ?? 'career leader', rows: topRows(data.allTime.profitTable, (row) => signed(row.profit), (row) => `${row.played} games · ${row.wins} wins`), tone: 'green' });
      next.push({ id: 'all-time-spins', kicker: '16-SEASON ARCHIVE', title: 'Spin Kings', subtitle: 'Who has lived on the edge most often across BookieBall history?', metric: `${data.allTime.spinsTable[0]?.spins ?? 0}`, metricLabel: data.allTime.spinsTable[0]?.teamName ?? 'career leader', rows: topRows(data.allTime.spinsTable, (row) => `${row.spins} spins`, (row) => `${row.played} games · ${signed(row.profit)} profit`), tone: 'blue' });
    }

    if (data.ratings.length) {
      const byRating = [...data.ratings].sort((a, b) => b.rating - a.rating);
      const byProfit = [...data.ratings].sort((a, b) => b.profit - a.profit);
      next.push({ id: 'power-ratings', kicker: 'CURRENT FORM', title: 'Power Ratings', subtitle: 'Current-season strength combining results and performance', metric: byRating[0] ? byRating[0].rating.toFixed(3) : '—', metricLabel: byRating[0]?.teamName ?? 'top rated', rows: topRows(byRating, (row) => row.rating.toFixed(3), (row) => `${(row.winRate * 100).toFixed(0)}% win rate · ${signed(row.profit)}`), tone: 'blue' });
      next.push({ id: 'season-profit', kicker: 'CURRENT FORM', title: 'Season Profit Race', subtitle: `${season} to date`, metric: signed(byProfit[0]?.profit ?? 0), metricLabel: byProfit[0]?.teamName ?? 'profit leader', rows: topRows(byProfit, (row) => signed(row.profit), (row) => `${row.entries} entries · ${(row.winRate * 100).toFixed(0)}% win rate`), tone: 'green' });
    }

    if (data.bookieDor?.leaderboard?.length) {
      next.push({ id: 'bookie-dor', kicker: 'MVP RACE', title: 'BookieDor', subtitle: `${data.bookieDor.season} ${data.bookieDor.gw} · league, cup, master and consistency combined`, metric: data.bookieDor.holder?.score.toFixed(1) ?? '—', metricLabel: data.bookieDor.holder?.teamName ?? 'current leader', rows: topRows(data.bookieDor.leaderboard, (row) => row.score.toFixed(1), (row) => `${displayDivisionName(row.division)} · league rank ${row.leagueRank}`), tone: 'gold' });
    }

    data.h2h.slice(0, 5).forEach((record, index) => {
      const edge = record.teamAWins === record.teamBWins ? 'All square' : record.teamAWins > record.teamBWins ? `${record.teamA.name} lead the series` : `${record.teamB.name} lead the series`;
      next.push({
        id: `h2h-${index}`,
        kicker: 'ALL-TIME HEAD TO HEAD',
        title: `${record.teamA.name} vs ${record.teamB.name}`,
        subtitle: `Every recorded league meeting from season 1 onwards · ${record.played} meetings`,
        metric: `${record.teamAWins} · ${record.draws} · ${record.teamBWins}`,
        metricLabel: `${record.teamA.name} wins · draws · ${record.teamB.name} wins`,
        rows: [
          { rank: 1, name: record.teamA.name, value: `${record.teamAWins} wins`, detail: `${signed(record.teamAProfit)} career profit vs this opponent`, teamId: record.teamA.id },
          { rank: 2, name: 'Draws', value: String(record.draws), detail: edge },
          { rank: 3, name: record.teamB.name, value: `${record.teamBWins} wins`, detail: `${signed(record.teamBProfit)} career profit vs this opponent`, teamId: record.teamB.id },
        ],
        story: record.longestStreak.count > 0 ? `Longest winning streak: ${record.longestStreak.side === 'A' ? record.teamA.name : record.teamB.name} — ${record.longestStreak.count} straight.` : undefined,
        tone: 'red',
      });
    });

    data.report?.story.storylines.slice(0, 6).forEach((story, index) => {
      next.push({ id: `story-${index}`, kicker: 'LIVE STORYLINE', title: story.headline, subtitle: `${season} ${gw}`, metric: story.metric, metricLabel: story.metric ? 'key number' : undefined, story: story.detail, tone: story.tone === 'positive' ? 'green' : story.tone === 'warning' ? 'red' : 'blue' });
    });

    return next;
  }, [data]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
      setCycleKey((key) => key + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, cycleKey]);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length > 0) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  const goToSlide = (index: number) => {
    if (!slides.length) return;
    setSlideIndex((index + slides.length) % slides.length);
    setCycleKey((key) => key + 1);
  };

  const active = slides[slideIndex] ?? null;
  const accent = accentForTone(active?.tone);
  const ticker = data?.report?.story.tickerItems ?? [];

  if (loading && !data) {
    return <section className="page page-wide command-centre-page" style={{ display: 'grid', placeItems: 'center', background: PAGE_BG }}><div style={{ color: MUTED, fontSize: 18 }}>Loading BookieBall analytics channel…</div></section>;
  }

  if (!active) {
    return <section className="page page-wide command-centre-page" style={{ display: 'grid', placeItems: 'center', background: PAGE_BG }}><div style={{ color: MUTED }}>{error || 'No analytics available yet.'}</div></section>;
  }

  const hasFixtures = Boolean(active.fixtures?.length);

  return (
    <section
      className="page page-wide command-centre-page"
      style={{ color: TEXT, background: PAGE_BG, borderRadius: 22, padding: 'clamp(12px, 1.7vw, 22px)' }}
    >
      <div className="command-centre-header">
        <div>
          <div style={{ color: '#6ec5ff', letterSpacing: '.18em', fontSize: 11, fontWeight: 800 }}>BOOKIEBALL COMMAND CENTRE</div>
          <div style={{ color: MUTED, marginTop: 3, fontSize: 12 }}>{data?.state.currentSeason} · {data?.state.currentGw} · auto analytics</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="command-controls">
            <button type="button" className="command-nav-btn" onClick={() => goToSlide(slideIndex - 1)}>← Prev</button>
            <button type="button" className="command-nav-btn" onClick={() => setPaused((value) => !value)}>{paused ? '▶ Play' : 'Ⅱ Pause'}</button>
            <button type="button" className="command-nav-btn" onClick={() => goToSlide(slideIndex + 1)}>Next →</button>
          </div>
          <div style={{ textAlign: 'right', color: MUTED, fontSize: 11 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: '#5cd68a', boxShadow: '0 0 14px rgba(92,214,138,.8)' }} />LIVE</div>
            <div style={{ marginTop: 3 }}>{lastUpdated ? `Updated ${lastUpdated}` : ''}</div>
          </div>
        </div>
      </div>

      <div className="command-centre-stage">
        <div
          key={`${active.id}-${cycleKey}`}
          className="command-slide"
          style={{ background: PANEL_BG, border: BORDER, borderTop: `3px solid ${accent}`, borderRadius: 20, padding: 'clamp(14px, 2vw, 26px)', boxShadow: '0 28px 70px rgba(0,0,0,.24)', gap: 'clamp(10px, 1.4vh, 18px)', ['--command-accent' as string]: accent }}
        >
          <div>
            <div className="command-slide-kicker" style={{ color: accent, letterSpacing: '.16em', fontSize: 11, fontWeight: 900 }}>{active.kicker}</div>
            <div style={{ display: 'grid', gridTemplateColumns: active.metric ? 'minmax(0,1fr) minmax(150px,240px)' : '1fr', gap: 20, alignItems: 'end', marginTop: 7 }}>
              <div>
                <h1 className="command-slide-title" style={{ margin: 0, fontSize: 'clamp(30px, 4.6vw, 60px)', lineHeight: .98, letterSpacing: '-.035em' }}>{active.title}</h1>
                <p style={{ color: MUTED, margin: '7px 0 0', fontSize: 'clamp(12px, 1.25vw, 16px)', maxWidth: 900 }}>{active.subtitle}</p>
              </div>
              {active.metric && <div className="command-slide-metric" style={{ textAlign: 'right' }}><div style={{ color: accent, fontSize: 'clamp(30px, 4vw, 52px)', fontWeight: 900, lineHeight: 1 }}>{active.metric}</div>{active.metricLabel && <div style={{ color: MUTED, marginTop: 5, fontSize: 11 }}>{active.metricLabel}</div>}</div>}
            </div>
          </div>

          <div className="command-slide-body">
            {hasFixtures ? (
              <div className="command-division-layout">
                <div className="command-table">
                  <div className="command-section-label"><span>LIVE TABLE</span><span>{active.rows?.length ?? 0} teams</span></div>
                  {active.rows?.map((row, index) => {
                    const team = row.teamId ? teamById.get(row.teamId) : undefined;
                    return (
                      <div key={`${active.id}-${row.rank}-${row.name}`} className="command-row" style={{ animationDelay: `${index * 55}ms`, display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 11, background: row.rank === 1 ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.055)' }}>
                        <div style={{ color: row.rank === 1 ? accent : MUTED, fontWeight: 900, fontSize: 13 }}>#{row.rank}</div>
                        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{team && <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={24} />}<div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>{row.name}</div>{row.detail && <div className="command-row-detail" style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{row.detail}</div>}</div></div>
                        <div style={{ color: row.rank === 1 ? accent : TEXT, fontWeight: 900, fontSize: 14, textAlign: 'right' }}>{row.value}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="command-fixtures">
                  <div className="command-section-label"><span>{active.fixturesLabel ?? 'FIXTURES'}</span><span>{active.fixtures?.length ?? 0} games</span></div>
                  {active.fixtures?.map((fixture, index) => (
                    <div key={`${active.id}-fixture-${fixture.id}`} className={`command-fixture${fixture.result === 'pending' ? ' is-pending' : ''}`} style={{ animationDelay: `${(index + 1) * 70}ms`, padding: '10px 12px 10px 15px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}><span style={{ color: fixture.result === 'pending' ? '#f2c14e' : MUTED, fontSize: 9, fontWeight: 900, letterSpacing: '.1em' }}>{fixtureResultLabel(fixture)}</span>{fixture.result !== 'pending' && <span style={{ color: accent, fontSize: 11, fontWeight: 900 }}>{signed(fixture.homeProfit)} : {signed(fixture.awayProfit)}</span>}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 7, fontSize: 13 }}><strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fixture.homeTeam}</strong><span style={{ color: MUTED, fontSize: 10 }}>vs</span><strong style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fixture.awayTeam}</strong></div>
                    </div>
                  ))}
                  {active.fixtures?.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No fixtures in this division for {data?.state.currentGw}.</div>}
                </div>
              </div>
            ) : active.rows?.length ? (
              <div className="command-table" style={{ maxWidth: 980, width: '100%', justifySelf: 'center' }}>
                {active.rows.map((row, index) => {
                  const team = row.teamId ? teamById.get(row.teamId) : undefined;
                  return (
                    <div key={`${active.id}-${row.rank}-${row.name}`} className="command-row" style={{ animationDelay: `${index * 55}ms`, display: 'grid', gridTemplateColumns: '38px minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 12, background: row.rank === 1 ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.055)' }}>
                      <div style={{ color: row.rank === 1 ? accent : MUTED, fontWeight: 900, fontSize: 14 }}>#{row.rank}</div>
                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>{team && <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={27} />}<div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>{row.detail && <div className="command-row-detail" style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{row.detail}</div>}</div></div>
                      <div style={{ color: row.rank === 1 ? accent : TEXT, fontWeight: 900, fontSize: 'clamp(14px, 1.5vw, 19px)', textAlign: 'right' }}>{row.value}</div>
                    </div>
                  );
                })}
              </div>
            ) : active.story ? (
              <div style={{ fontSize: 'clamp(22px, 3vw, 40px)', lineHeight: 1.16, maxWidth: 1050, fontWeight: 750 }}>{active.story}</div>
            ) : null}
          </div>

          <div>
            {active.story && active.rows?.length ? <div style={{ color: '#c8d7e5', fontSize: 12, paddingTop: 8, borderTop: BORDER }}>{active.story}</div> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <div className="command-progress-track"><div key={`progress-${cycleKey}-${slideIndex}-${paused}`} className="command-progress-fill" style={{ background: accent, animationPlayState: paused ? 'paused' : 'running' }} /></div>
              <span style={{ color: MUTED, fontSize: 10 }}>{slideIndex + 1} / {slides.length}</span>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>{slides.slice(Math.max(0, slideIndex - 3), Math.min(slides.length, slideIndex + 4)).map((slide) => <span key={slide.id} style={{ height: 3, width: slide.id === active.id ? 24 : 8, borderRadius: 99, background: slide.id === active.id ? accent : 'rgba(255,255,255,.11)', transition: 'all .25s ease' }} />)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="command-ticker" style={{ border: BORDER, borderRadius: 11, background: 'rgba(3,10,18,.78)', padding: '6px 11px', color: '#c5d4e2', fontSize: 10, whiteSpace: 'nowrap' }}>
        {ticker.length > 0 ? <div className="command-ticker-track"><strong style={{ color: '#6ec5ff', marginRight: 12 }}>LIVE DESK</strong>{[...ticker, ...ticker].join('   ·   ')}</div> : <span><strong style={{ color: '#6ec5ff', marginRight: 10 }}>LIVE DESK</strong>BookieBall command centre running</span>}
      </div>
    </section>
  );
}
