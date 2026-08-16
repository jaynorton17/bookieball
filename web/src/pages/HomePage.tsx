import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { displayDivisionName, sortDivisionNames } from '../lib/divisionLabels';

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

type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  metric?: string;
  metricLabel?: string;
  rows?: Row[];
  story?: string;
  tone?: 'blue' | 'gold' | 'green' | 'red';
};

const PAGE_BG = 'radial-gradient(circle at 15% 15%, rgba(22,96,170,.22), transparent 34%), radial-gradient(circle at 85% 5%, rgba(226,176,54,.15), transparent 28%), linear-gradient(145deg, #06111f 0%, #081a2d 54%, #050c16 100%)';
const PANEL_BG = 'linear-gradient(145deg, rgba(13,31,51,.96), rgba(7,19,33,.96))';
const BORDER = '1px solid rgba(168,198,225,.14)';
const TEXT = '#f7fbff';
const MUTED = '#91a8bd';

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

export function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

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
      const currentFixtures = fixtures
        .filter((fixture) => fixture.gw === state.currentGw)
        .slice(0, 5);

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
      subtitle: 'The command centre now runs as an automatic analytics channel — no clicks required.',
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
      next.push({
        id: `division-${division}`,
        kicker: 'DIVISION FOCUS',
        title: displayDivisionName(division),
        subtitle: `${season} ${gw} · live table and title race`,
        metric: leader ? `${leader.points}` : '—',
        metricLabel: leader ? `${leader.teamName} points` : 'points',
        rows: topRows(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
        story: leader && second ? `${leader.teamName} currently lead ${second.teamName} by ${leader.points - second.points} point${Math.abs(leader.points - second.points) === 1 ? '' : 's'}.` : undefined,
        tone: 'blue',
      });
    });

    if (data.master?.table?.length) {
      const rows = [...data.master.table].sort((a, b) => a.rank - b.rank);
      next.push({
        id: 'master-league',
        kicker: 'COMPETITION ANALYTICS',
        title: 'Master League',
        subtitle: `${season} ${data.master.gw} · overall standings`,
        metric: `${rows[0]?.points ?? 0}`,
        metricLabel: `${rows[0]?.teamName ?? 'Leader'} points`,
        rows: topRows(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W · ${signed(row.profit)} profit`),
        tone: 'gold',
      });
    }

    if (data.trio?.enabled && data.trio.table.length) {
      const rows = [...data.trio.table].sort((a, b) => a.rank - b.rank || a.division.localeCompare(b.division));
      next.push({
        id: 'trio-league',
        kicker: 'COMPETITION ANALYTICS',
        title: 'Trio League',
        subtitle: `${season} ${data.trio.gw} · group-by-group picture`,
        metric: String(new Set(rows.map((row) => row.division)).size),
        metricLabel: 'active groups',
        rows: rows.slice(0, 8).map((row) => ({
          rank: row.rank,
          name: `${row.teamName} · ${displayDivisionName(row.division)}`,
          value: `${row.points} pts`,
          detail: `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`,
          teamId: row.teamId,
        })),
        tone: 'green',
      });
    }

    if (data.tier?.enabled && data.tier.table.length) {
      const rows = [...data.tier.table].sort((a, b) => a.rank - b.rank || a.division.localeCompare(b.division));
      next.push({
        id: 'tier-league',
        kicker: 'COMPETITION ANALYTICS',
        title: 'Tier League',
        subtitle: `${season} ${data.tier.gw} · ${data.tier.started ? 'competition live' : 'competition pending'}`,
        metric: String(new Set(rows.map((row) => row.division)).size),
        metricLabel: 'tiers represented',
        rows: rows.slice(0, 8).map((row) => ({
          rank: row.rank,
          name: `${row.teamName} · ${displayDivisionName(row.division)}`,
          value: `${row.points} pts`,
          detail: `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`,
          teamId: row.teamId,
        })),
        tone: 'green',
      });
    }

    if (data.allTime) {
      next.push({
        id: 'all-time-points',
        kicker: '16-SEASON ARCHIVE',
        title: 'All-Time League Table',
        subtitle: `${data.allTime.fromSeason} ${data.allTime.fromGw} → ${data.allTime.toSeason} ${data.allTime.toGw}`,
        metric: `${data.allTime.pointsTable[0]?.points ?? 0}`,
        metricLabel: 'record points total',
        rows: topRows(data.allTime.pointsTable, (row) => `${row.points} pts`, (row) => `${row.wins} wins · ${signed(row.profit)} profit`),
        tone: 'gold',
      });

      next.push({
        id: 'all-time-profit',
        kicker: '16-SEASON ARCHIVE',
        title: 'Greatest Profit Makers',
        subtitle: 'Career profit across the full BookieBall archive',
        metric: signed(data.allTime.profitTable[0]?.profit ?? 0),
        metricLabel: data.allTime.profitTable[0]?.teamName ?? 'career leader',
        rows: topRows(data.allTime.profitTable, (row) => signed(row.profit), (row) => `${row.played} games · ${row.wins} wins`),
        tone: 'green',
      });

      next.push({
        id: 'all-time-spins',
        kicker: '16-SEASON ARCHIVE',
        title: 'Spin Kings',
        subtitle: 'Who has lived on the edge most often across BookieBall history?',
        metric: `${data.allTime.spinsTable[0]?.spins ?? 0}`,
        metricLabel: data.allTime.spinsTable[0]?.teamName ?? 'career leader',
        rows: topRows(data.allTime.spinsTable, (row) => `${row.spins} spins`, (row) => `${row.played} games · ${signed(row.profit)} profit`),
        tone: 'blue',
      });
    }

    if (data.ratings.length) {
      const byRating = [...data.ratings].sort((a, b) => b.rating - a.rating);
      const byProfit = [...data.ratings].sort((a, b) => b.profit - a.profit);
      next.push({
        id: 'power-ratings',
        kicker: 'CURRENT FORM',
        title: 'Power Ratings',
        subtitle: 'Current-season strength combining results and performance',
        metric: byRating[0] ? byRating[0].rating.toFixed(3) : '—',
        metricLabel: byRating[0]?.teamName ?? 'top rated',
        rows: topRows(byRating, (row) => row.rating.toFixed(3), (row) => `${(row.winRate * 100).toFixed(0)}% win rate · ${signed(row.profit)}`),
        tone: 'blue',
      });
      next.push({
        id: 'season-profit',
        kicker: 'CURRENT FORM',
        title: 'Season Profit Race',
        subtitle: `${season} to date`,
        metric: signed(byProfit[0]?.profit ?? 0),
        metricLabel: byProfit[0]?.teamName ?? 'profit leader',
        rows: topRows(byProfit, (row) => signed(row.profit), (row) => `${row.entries} entries · ${(row.winRate * 100).toFixed(0)}% win rate`),
        tone: 'green',
      });
    }

    if (data.bookieDor?.leaderboard?.length) {
      next.push({
        id: 'bookie-dor',
        kicker: 'MVP RACE',
        title: 'BookieDor',
        subtitle: `${data.bookieDor.season} ${data.bookieDor.gw} · league, cup, master and consistency combined`,
        metric: data.bookieDor.holder?.score.toFixed(1) ?? '—',
        metricLabel: data.bookieDor.holder?.teamName ?? 'current leader',
        rows: topRows(data.bookieDor.leaderboard, (row) => row.score.toFixed(1), (row) => `${displayDivisionName(row.division)} · league rank ${row.leagueRank}`),
        tone: 'gold',
      });
    }

    data.h2h.slice(0, 5).forEach((record, index) => {
      const edge = record.teamAWins === record.teamBWins
        ? 'All square'
        : record.teamAWins > record.teamBWins
          ? `${record.teamA.name} lead the series`
          : `${record.teamB.name} lead the series`;
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
        story: record.longestStreak.count > 0
          ? `Longest winning streak: ${record.longestStreak.side === 'A' ? record.teamA.name : record.teamB.name} — ${record.longestStreak.count} straight.`
          : undefined,
        tone: 'red',
      });
    });

    data.report?.story.storylines.slice(0, 6).forEach((story, index) => {
      next.push({
        id: `story-${index}`,
        kicker: 'LIVE STORYLINE',
        title: story.headline,
        subtitle: `${season} ${gw}`,
        metric: story.metric,
        metricLabel: story.metric ? 'key number' : undefined,
        story: story.detail,
        tone: story.tone === 'positive' ? 'green' : story.tone === 'warning' ? 'red' : 'blue',
      });
    });

    return next;
  }, [data]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, 11_000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length > 0) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  const active = slides[slideIndex] ?? null;
  const accent = accentForTone(active?.tone);
  const ticker = data?.report?.story.tickerItems ?? [];

  if (loading && !data) {
    return (
      <section className="page page-wide" style={{ minHeight: '78vh', display: 'grid', placeItems: 'center', background: PAGE_BG }}>
        <div style={{ color: MUTED, fontSize: 18 }}>Loading BookieBall analytics channel…</div>
      </section>
    );
  }

  if (!active) {
    return (
      <section className="page page-wide" style={{ minHeight: '78vh', display: 'grid', placeItems: 'center', background: PAGE_BG }}>
        <div style={{ color: MUTED }}>{error || 'No analytics available yet.'}</div>
      </section>
    );
  }

  return (
    <section
      className="page page-wide"
      style={{
        minHeight: '82vh',
        color: TEXT,
        background: PAGE_BG,
        borderRadius: 24,
        padding: 'clamp(18px, 2.5vw, 34px)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
        <div>
          <div style={{ color: '#6ec5ff', letterSpacing: '.18em', fontSize: 12, fontWeight: 800 }}>BOOKIEBALL COMMAND CENTRE</div>
          <div style={{ color: MUTED, marginTop: 6, fontSize: 13 }}>
            {data?.state.currentSeason} · {data?.state.currentGw} · auto-rotating analytics
          </div>
        </div>
        <div style={{ textAlign: 'right', color: MUTED, fontSize: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#5cd68a', boxShadow: '0 0 14px rgba(92,214,138,.8)' }} />
            LIVE
          </div>
          <div style={{ marginTop: 5 }}>{lastUpdated ? `Updated ${lastUpdated}` : ''}</div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 14, color: '#ff9da6', fontSize: 13 }}>{error}</div>}

      <div
        key={active.id}
        style={{
          background: PANEL_BG,
          border: BORDER,
          borderTop: `3px solid ${accent}`,
          borderRadius: 22,
          padding: 'clamp(22px, 3vw, 42px)',
          minHeight: '58vh',
          boxShadow: '0 28px 70px rgba(0,0,0,.24)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: 28,
        }}
      >
        <div>
          <div style={{ color: accent, letterSpacing: '.16em', fontSize: 12, fontWeight: 900 }}>{active.kicker}</div>
          <div style={{ display: 'grid', gridTemplateColumns: active.metric ? 'minmax(0,1fr) minmax(180px,280px)' : '1fr', gap: 28, alignItems: 'end', marginTop: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(34px, 5.4vw, 72px)', lineHeight: .98, letterSpacing: '-.035em' }}>{active.title}</h1>
              <p style={{ color: MUTED, margin: '14px 0 0', fontSize: 'clamp(14px, 1.5vw, 19px)', maxWidth: 900 }}>{active.subtitle}</p>
            </div>
            {active.metric && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: accent, fontSize: 'clamp(34px, 4.6vw, 64px)', fontWeight: 900, lineHeight: 1 }}>{active.metric}</div>
                {active.metricLabel && <div style={{ color: MUTED, marginTop: 8, fontSize: 13 }}>{active.metricLabel}</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ alignSelf: 'center' }}>
          {active.rows?.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {active.rows.map((row) => {
                const team = row.teamId ? teamById.get(row.teamId) : undefined;
                return (
                  <div
                    key={`${active.id}-${row.rank}-${row.name}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '42px minmax(0,1fr) auto',
                      alignItems: 'center',
                      gap: 14,
                      padding: '11px 14px',
                      borderRadius: 14,
                      background: row.rank === 1 ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)',
                      border: '1px solid rgba(255,255,255,.055)',
                    }}
                  >
                    <div style={{ color: row.rank === 1 ? accent : MUTED, fontWeight: 900, fontSize: 16 }}>#{row.rank}</div>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      {team && (
                        <TeamBadge
                          name={team.name}
                          ballColor={team.ballColor}
                          ringColor={team.ringColor}
                          textColor={team.textColor}
                          size={30}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                        {row.detail && <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>{row.detail}</div>}
                      </div>
                    </div>
                    <div style={{ color: row.rank === 1 ? accent : TEXT, fontWeight: 900, fontSize: 'clamp(15px, 1.8vw, 22px)', textAlign: 'right' }}>{row.value}</div>
                  </div>
                );
              })}
            </div>
          ) : active.story ? (
            <div style={{ fontSize: 'clamp(24px, 3.3vw, 44px)', lineHeight: 1.18, maxWidth: 1050, fontWeight: 750 }}>
              {active.story}
            </div>
          ) : null}
        </div>

        <div>
          {active.story && active.rows?.length ? (
            <div style={{ color: '#c8d7e5', fontSize: 15, paddingTop: 14, borderTop: BORDER }}>{active.story}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 5, marginTop: 18, alignItems: 'center' }}>
            {slides.map((slide, index) => (
              <span
                key={slide.id}
                aria-hidden="true"
                style={{
                  height: 4,
                  flex: 1,
                  maxWidth: 34,
                  borderRadius: 99,
                  background: index === slideIndex ? accent : 'rgba(255,255,255,.11)',
                  transition: 'background .25s ease',
                }}
              />
            ))}
            <span style={{ color: MUTED, fontSize: 11, marginLeft: 8 }}>{slideIndex + 1} / {slides.length}</span>
          </div>
        </div>
      </div>

      {ticker.length > 0 && (
        <div style={{ marginTop: 14, border: BORDER, borderRadius: 14, background: 'rgba(3,10,18,.78)', overflow: 'hidden', padding: '9px 14px', color: '#c5d4e2', fontSize: 12, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <strong style={{ color: '#6ec5ff', marginRight: 12 }}>LIVE DESK</strong>
          {ticker.join('   ·   ')}
        </div>
      )}
    </section>
  );
}
