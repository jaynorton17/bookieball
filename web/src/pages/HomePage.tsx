import { useCallback, useEffect, useMemo, useState } from 'react';
import { AutoScrollViewport } from '../components/broadcast/AutoScrollViewport';
import {
  CommandFixtureCard,
  type CommandFixture,
  type FixtureH2H,
  type FixtureMarket,
} from '../components/broadcast/CommandFixtureCard';
import { HomeAnalyticsGraphic, isHomeGraphicSlide } from '../components/broadcast/HomeAnalyticsGraphic';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { loadAllTimeAnalytics, type RivalryAnalytics, type TeamAllTimeAnalytics } from '../lib/allTimeAnalytics';
import { onBookieBallEvent } from '../lib/appEvents';
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

type Row = { rank: number; name: string; value: string; detail?: string; teamId?: number };
type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  tone?: 'blue' | 'gold' | 'green' | 'red';
  metric?: string;
  metricLabel?: string;
  rows?: Row[];
  fixtures?: CommandFixture[];
  nextFixtures?: CommandFixture[];
  story?: string;
};
type RawFixture = Omit<CommandFixture, 'h2h' | 'market'>;
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
  fixtures: RawFixture[];
};
type ArchiveAnalytics = { teams: TeamAllTimeAnalytics[]; rivalries: RivalryAnalytics[] };

const PAGE_BG = 'radial-gradient(circle at 15% 15%, rgba(22,96,170,.22), transparent 34%), radial-gradient(circle at 85% 5%, rgba(226,176,54,.15), transparent 28%), linear-gradient(145deg, #06111f 0%, #081a2d 54%, #050c16 100%)';
const PANEL_BG = 'linear-gradient(145deg, rgba(13,31,51,.96), rgba(7,19,33,.96))';
const TEXT = '#f7fbff';
const MUTED = '#91a8bd';
const NORMAL_MS = 11_000;
const LONG_MS = 19_000;
const GAMEWEEKS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

function signed(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? '+' : ''}${safe.toFixed(digits)}`;
}
function norm(name: string): string { return name.trim().toLowerCase(); }
function pairKey(home: string, away: string): string { return `${norm(home)}|${norm(away)}`; }
function nextGw(gw: string): string | null {
  const index = GAMEWEEKS.indexOf(gw);
  return index >= 0 && index < GAMEWEEKS.length - 1 ? GAMEWEEKS[index + 1] : null;
}
function accent(tone: Slide['tone']): string {
  if (tone === 'gold') return '#f2c14e';
  if (tone === 'green') return '#5cd68a';
  if (tone === 'red') return '#ff7a84';
  return '#5eb7ff';
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
function analyticsRows(rows: TeamAllTimeAnalytics[], value: (row: TeamAllTimeAnalytics) => string, detail: (row: TeamAllTimeAnalytics) => string): Row[] {
  return rows.map((row, index) => ({ rank: index + 1, name: row.teamName, value: value(row), detail: detail(row), teamId: row.teamId }));
}
function fixtureBelongsToRows(fixture: CommandFixture, rows: Array<{ teamName: string }>): boolean {
  const members = new Set(rows.map((row) => norm(row.teamName)));
  return members.has(norm(fixture.homeTeam)) || members.has(norm(fixture.awayTeam));
}
function buildMarket(h2h: FixtureH2H | null, homeRating: number | null, awayRating: number | null): FixtureMarket {
  const homeWins = h2h?.teamAWins ?? 0;
  const awayWins = h2h?.teamBWins ?? 0;
  const draws = h2h?.draws ?? 0;
  const total = homeWins + awayWins + draws;
  let home = (homeWins + 2.2) / (total + 6.6);
  let draw = (draws + 2.2) / (total + 6.6);
  let away = (awayWins + 2.2) / (total + 6.6);
  if (homeRating !== null && awayRating !== null) {
    const edge = Math.max(-0.075, Math.min(0.075, Math.tanh(homeRating - awayRating) * 0.075));
    home += edge;
    away -= edge;
  }
  home = Math.max(0.08, home);
  draw = Math.max(0.1, draw);
  away = Math.max(0.08, away);
  const sum = home + draw + away;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

export function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [archive, setArchive] = useState<ArchiveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');

  const reload = useCallback(async () => {
    try {
      const state = await api.state();
      const followingGw = nextGw(state.currentGw);
      const [teams, leagueTable, master, trio, tier, allTime, ratings, bookieDor, report,
        leagueNow, masterNow, trioNow, tierNow, leagueNext, masterNext, trioNext, tierNext] = await Promise.all([
        api.teams(),
        api.leagueTable(),
        api.masterLeagueTable(state.currentGw).catch(() => null),
        api.trioLeagueTable(state.currentGw).catch(() => null),
        api.tierLeagueTable(state.currentGw).catch(() => null),
        api.allTimeLeagues().catch(() => null),
        api.teamRatings().catch(() => []),
        api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
        api.reportPack(state.currentGw).catch(() => null),
        api.leagueFixtures(state.currentGw, false).catch(() => []),
        api.masterLeagueFixtures(state.currentGw, false).catch(() => []),
        api.trioLeagueFixtures(state.currentGw, false).catch(() => []),
        api.tierLeagueFixtures(state.currentGw, false).catch(() => []),
        followingGw ? api.leagueFixtures(followingGw, false).catch(() => []) : Promise.resolve([]),
        followingGw ? api.masterLeagueFixtures(followingGw, false).catch(() => []) : Promise.resolve([]),
        followingGw ? api.trioLeagueFixtures(followingGw, false).catch(() => []) : Promise.resolve([]),
        followingGw ? api.tierLeagueFixtures(followingGw, false).catch(() => []) : Promise.resolve([]),
      ]);

      const normalizeSet = (
        band: 'current' | 'next',
        gw: string,
        league: typeof leagueNow,
        masterRows: typeof masterNow,
        trioRows: typeof trioNow,
        tierRows: typeof tierNow,
      ): RawFixture[] => [
        ...league.map((fixture) => ({ key: `${band}-league-${fixture.id}`, id: fixture.id, competition: 'league' as const, division: fixture.division, gw, band, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
        ...masterRows.map((fixture) => ({ key: `${band}-master-${fixture.id}`, id: fixture.id, competition: 'master' as const, gw, band, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
        ...trioRows.map((fixture) => ({ key: `${band}-trio-${fixture.id}`, id: fixture.id, competition: 'trio' as const, division: fixture.division, gw, band, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
        ...tierRows.map((fixture) => ({ key: `${band}-tier-${fixture.id}`, id: fixture.id, competition: 'tier' as const, division: fixture.division, gw, band, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, homeProfit: fixture.homeProfit, awayProfit: fixture.awayProfit, result: fixture.result })),
      ];

      const fixtures = [
        ...normalizeSet('current', state.currentGw, leagueNow, masterNow, trioNow, tierNow),
        ...(followingGw ? normalizeSet('next', followingGw, leagueNext, masterNext, trioNext, tierNext) : []),
      ];

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
    const timer = window.setInterval(() => void reload(), 90_000);
    const offMutation = onBookieBallEvent('data-mutated', () => void reload());
    const offGameweek = onBookieBallEvent('gameweek-changed', () => void reload());
    return () => {
      window.clearInterval(timer);
      offMutation();
      offGameweek();
    };
  }, [reload]);

  useEffect(() => {
    let active = true;
    void loadAllTimeAnalytics().then((result) => { if (active) setArchive(result); }).catch(() => { if (active) setArchive(null); });
    return () => { active = false; };
  }, []);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);
  const ratingByName = useMemo(() => new Map((data?.ratings ?? []).map((row) => [norm(row.teamName), row.rating])), [data?.ratings]);
  const rivalryByPair = useMemo(() => {
    const map = new Map<string, FixtureH2H>();
    archive?.rivalries.forEach((row) => {
      map.set(pairKey(row.teamAName, row.teamBName), { teamAWins: row.teamAWins, teamBWins: row.teamBWins, draws: row.draws });
      map.set(pairKey(row.teamBName, row.teamAName), { teamAWins: row.teamBWins, teamBWins: row.teamAWins, draws: row.draws });
    });
    return map;
  }, [archive]);
  const fixtures = useMemo<CommandFixture[]>(() => (data?.fixtures ?? []).map((fixture) => {
    const h2h = rivalryByPair.get(pairKey(fixture.homeTeam, fixture.awayTeam)) ?? null;
    return {
      ...fixture,
      h2h,
      market: buildMarket(h2h, ratingByName.get(norm(fixture.homeTeam)) ?? null, ratingByName.get(norm(fixture.awayTeam)) ?? null),
    };
  }), [data?.fixtures, ratingByName, rivalryByPair]);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const out: Slide[] = [];
    const season = data.state.currentSeason;
    const gw = data.state.currentGw;
    const followingGw = nextGw(gw);
    const current = (competition: CommandFixture['competition']) => fixtures.filter((fixture) => fixture.competition === competition && fixture.band === 'current');
    const next = (competition: CommandFixture['competition']) => fixtures.filter((fixture) => fixture.competition === competition && fixture.band === 'next');
    const divisionNames = sortDivisionNames(Object.keys(data.leagueTable), season);
    const leaders = divisionNames.map((division) => data.leagueTable[division]?.[0]).filter((row): row is NonNullable<typeof row> => Boolean(row));

    out.push({
      id: 'overview', kicker: 'BOOKIEBALL LIVE', title: `${season} · ${gw}`, subtitle: 'Live command centre', tone: 'blue',
      metric: String(data.teams.length), metricLabel: 'teams tracked',
      rows: leaders.map((row, index) => ({ rank: index + 1, name: displayDivisionName(row.division), value: row.teamName, detail: `${row.points} pts · ${signed(row.profit)} profit`, teamId: row.teamId })),
    });

    divisionNames.forEach((division) => {
      const rows = [...(data.leagueTable[division] ?? [])].sort((a, b) => a.rank - b.rank);
      if (!rows.length) return;
      const nowFixtures = current('league').filter((fixture) => fixtureBelongsToRows(fixture, rows));
      const nextFixtures = next('league').filter((fixture) => fixtureBelongsToRows(fixture, rows));
      out.push({
        id: `league-${division}`, kicker: 'DIVISION', title: displayDivisionName(division), subtitle: `${season} ${gw}`, tone: 'blue',
        metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`,
        rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`),
        fixtures: nowFixtures, nextFixtures,
        story: rows[1] ? `${rows[0].teamName} lead ${rows[1].teamName} by ${rows[0].points - rows[1].points} points.` : undefined,
      });
    });

    if (data.master?.table.length) {
      const rows = [...data.master.table].sort((a, b) => a.rank - b.rank);
      out.push({ id: 'master', kicker: 'MASTER LEAGUE', title: 'Master League', subtitle: `${season} ${data.master.gw}`, tone: 'gold', metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`, rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`), fixtures: current('master'), nextFixtures: next('master') });
    }

    if (data.trio?.enabled) {
      Array.from(new Set(data.trio.table.map((row) => row.division))).forEach((division) => {
        const rows = data.trio!.table.filter((row) => row.division === division).sort((a, b) => a.rank - b.rank);
        if (!rows.length) return;
        out.push({ id: `trio-${division}`, kicker: 'TRIO LEAGUE', title: displayDivisionName(division), subtitle: `${season} ${data.trio!.gw}`, tone: 'green', metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`, rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`), fixtures: current('trio').filter((fixture) => fixtureBelongsToRows(fixture, rows)), nextFixtures: next('trio').filter((fixture) => fixtureBelongsToRows(fixture, rows)) });
      });
    }

    if (data.tier?.enabled) {
      Array.from(new Set(data.tier.table.map((row) => row.division))).forEach((division) => {
        const rows = data.tier!.table.filter((row) => row.division === division).sort((a, b) => a.rank - b.rank);
        if (!rows.length) return;
        out.push({ id: `tier-${division}`, kicker: 'TIER LEAGUE', title: displayDivisionName(division), subtitle: `${season} ${data.tier!.gw}`, tone: 'green', metric: String(rows[0].points), metricLabel: `${rows[0].teamName} points`, rows: rowsFor(rows, (row) => `${row.points} pts`, (row) => `${row.wins}W ${row.draws}D ${row.losses}L · ${signed(row.profit)}`), fixtures: current('tier').filter((fixture) => fixtureBelongsToRows(fixture, rows)), nextFixtures: next('tier').filter((fixture) => fixtureBelongsToRows(fixture, rows)) });
      });
    }

    if (data.allTime) {
      out.push({ id: 'all-time-points', kicker: '16-SEASON ARCHIVE', title: 'All-Time League Table', subtitle: `${data.allTime.fromSeason} ${data.allTime.fromGw} → ${data.allTime.toSeason} ${data.allTime.toGw}`, tone: 'gold', metric: `${data.allTime.pointsTable[0]?.points ?? 0}`, metricLabel: 'record points', rows: rowsFor(data.allTime.pointsTable, (row) => `${row.points} pts`, (row) => `${row.wins} wins · ${signed(row.profit)} profit`) });
      out.push({ id: 'all-time-profit', kicker: '16-SEASON ARCHIVE', title: 'Greatest Profit Makers', subtitle: 'Career profit', tone: 'green', metric: signed(data.allTime.profitTable[0]?.profit ?? 0), metricLabel: data.allTime.profitTable[0]?.teamName ?? '', rows: rowsFor(data.allTime.profitTable, (row) => signed(row.profit), (row) => `${row.played} games · ${row.wins} wins`) });
      out.push({ id: 'all-time-spins', kicker: '16-SEASON ARCHIVE', title: 'Spin Kings', subtitle: 'Most spins in BookieBall history', tone: 'blue', metric: String(data.allTime.spinsTable[0]?.spins ?? 0), metricLabel: data.allTime.spinsTable[0]?.teamName ?? '', rows: rowsFor(data.allTime.spinsTable, (row) => `${row.spins} spins`, (row) => `${row.played} games · ${signed(row.profit)} profit`) });
    }

    if (archive?.teams.length) {
      const byElo = archive.teams.slice().sort((a, b) => b.elo - a.elo);
      const byPeak = archive.teams.slice().sort((a, b) => b.peakElo - a.peakElo);
      out.push({ id: 'dominance', kicker: 'HISTORICAL POWER', title: 'Dominance Index', subtitle: 'Elo · points · win rate · profit', tone: 'gold', metric: archive.teams[0].dominanceIndex.toFixed(1), metricLabel: archive.teams[0].teamName, rows: analyticsRows(archive.teams, (row) => row.dominanceIndex.toFixed(1), (row) => `${row.wins} wins · ${(row.winRate * 100).toFixed(0)}% · ${signed(row.profit)}`) });
      out.push({ id: 'elo', kicker: 'HISTORICAL POWER', title: 'All-Time Elo', subtitle: 'Strength across every season', tone: 'blue', metric: byElo[0].elo.toFixed(0), metricLabel: byElo[0].teamName, rows: analyticsRows(byElo, (row) => row.elo.toFixed(0), (row) => `Peak ${row.peakElo.toFixed(0)} · ${row.played} matches`) });
      out.push({ id: 'peak-elo', kicker: 'HISTORICAL RECORD', title: 'Peak Ratings', subtitle: 'Highest level each team has reached', tone: 'red', metric: byPeak[0].peakElo.toFixed(0), metricLabel: byPeak[0].teamName, rows: analyticsRows(byPeak, (row) => row.peakElo.toFixed(0), (row) => `Current ${row.elo.toFixed(0)} · ${row.wins} wins`) });
    }

    if (archive?.rivalries.length) {
      const top = archive.rivalries.slice(0, 12);
      out.push({ id: 'rivalries', kicker: 'RIVALRY INDEX', title: 'Biggest Rivalries', subtitle: 'Most-played and closest all-time pairings', tone: 'red', metric: String(top[0].meetings), metricLabel: `${top[0].teamAName} vs ${top[0].teamBName}`, rows: top.map((row, index) => ({ rank: index + 1, name: `${row.teamAName} vs ${row.teamBName}`, value: `${row.teamAWins}-${row.draws}-${row.teamBWins}`, detail: `${row.meetings} meetings · ${(row.closeness * 100).toFixed(0)}% closeness` })) });
    }

    if (data.ratings.length) {
      const byRating = [...data.ratings].sort((a, b) => b.rating - a.rating);
      const byProfit = [...data.ratings].sort((a, b) => b.profit - a.profit);
      out.push({ id: 'ratings', kicker: 'CURRENT FORM', title: 'Power Ratings', subtitle: `${season} strength`, tone: 'blue', metric: byRating[0]?.rating.toFixed(3) ?? '—', metricLabel: byRating[0]?.teamName ?? '', rows: rowsFor(byRating, (row) => row.rating.toFixed(3), (row) => `${(row.winRate * 100).toFixed(0)}% win rate · ${signed(row.profit)}`) });
      out.push({ id: 'profit', kicker: 'CURRENT FORM', title: 'Profit Race', subtitle: `${season} to date`, tone: 'green', metric: signed(byProfit[0]?.profit ?? 0), metricLabel: byProfit[0]?.teamName ?? '', rows: rowsFor(byProfit, (row) => signed(row.profit), (row) => `${row.entries} entries · ${(row.winRate * 100).toFixed(0)}% win rate`) });
    }

    if (data.bookieDor?.leaderboard.length) {
      out.push({ id: 'bookiedor', kicker: 'MVP RACE', title: "Bookie d'Or", subtitle: `${data.bookieDor.season} ${data.bookieDor.gw}`, tone: 'gold', metric: data.bookieDor.holder?.score.toFixed(1) ?? '—', metricLabel: data.bookieDor.holder?.teamName ?? '', rows: rowsFor(data.bookieDor.leaderboard, (row) => row.score.toFixed(1), (row) => `${displayDivisionName(row.division)} · league rank ${row.leagueRank}`) });
    }

    data.report?.story.storylines.slice(0, 6).forEach((story, index) => {
      out.push({ id: `story-${index}`, kicker: 'LIVE STORYLINE', title: story.headline, subtitle: `${season} ${gw}`, tone: story.tone === 'positive' ? 'green' : story.tone === 'warning' ? 'red' : 'blue', metric: story.metric, story: story.detail });
    });
    return out;
  }, [data, archive, fixtures]);

  const active = slides[slideIndex] ?? null;
  const fixtureCount = (active?.fixtures?.length ?? 0) + (active?.nextFixtures?.length ?? 0);
  const isLong = Boolean(active && ((active.rows?.length ?? 0) > 7 || fixtureCount > 4));
  const duration = isLong ? LONG_MS : NORMAL_MS;

  useEffect(() => {
    if (!active || paused || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      setSlideIndex((index) => (index + 1) % slides.length);
      setCycle((value) => value + 1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [active?.id, paused, slides.length, duration, cycle]);
  useEffect(() => { if (slideIndex >= slides.length && slides.length) setSlideIndex(0); }, [slideIndex, slides.length]);
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
    return <div key={`${active.id}-${row.rank}-${row.name}-${index}`} className="command-row">
      <span className="command-row-rank" style={{ color: row.rank === 1 ? color : MUTED }}>#{row.rank}</span>
      <div className="command-row-team">{team && <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={24} />}<div><strong>{row.name}</strong>{row.detail && <small>{row.detail}</small>}</div></div>
      <strong className="command-row-value" style={{ color: row.rank === 1 ? color : TEXT }}>{row.value}</strong>
    </div>;
  });

  const graphic = isHomeGraphicSlide(active.id) && active.rows?.length
    ? <HomeAnalyticsGraphic slideId={active.id} rows={active.rows} color={color} teamById={teamById} />
    : null;

  return <section className="page page-wide command-centre-page command-centre-v2" style={{ color: TEXT, background: PAGE_BG }}>
    <header className="command-centre-header">
      <div><div className="command-eyebrow">BOOKIEBALL COMMAND CENTRE</div><div className="command-subline">{data?.state.currentSeason} · {data?.state.currentGw}</div></div>
      <div className="command-header-actions"><div className="command-controls">
        <button type="button" className="command-nav-btn" onClick={() => window.dispatchEvent(new CustomEvent('bookieball:team-journey'))}>Team Journey</button>
        <button type="button" className="command-nav-btn" onClick={() => go(slideIndex - 1)}>← Prev</button>
        <button type="button" className="command-nav-btn" onClick={() => setPaused((value) => !value)}>{paused ? '▶ Play' : 'Ⅱ Pause'}</button>
        <button type="button" className="command-nav-btn" onClick={() => go(slideIndex + 1)}>Next →</button>
      </div><div className="command-live"><span />LIVE<small>{lastUpdated ? `Updated ${lastUpdated}` : ''}</small></div></div>
    </header>

    <div className="command-centre-stage"><article key={`${active.id}-${cycle}`} className="command-slide" style={{ ['--command-accent' as string]: color, background: PANEL_BG, borderTopColor: color }}>
      <div className="command-slide-head"><div><div className="command-slide-kicker" style={{ color }}>{active.kicker}</div><h1 className="command-slide-title">{active.title}</h1><p>{active.subtitle}</p></div>{active.metric && <div className="command-slide-metric"><strong style={{ color }}>{active.metric}</strong><span>{active.metricLabel}</span></div>}</div>
      <div className={`command-slide-body${fixtureCount ? ' has-fixtures' : ''}${graphic ? ' has-graphic' : ''}`}>
        {fixtureCount ? <div className="command-division-layout command-native-layout">
          <section className="command-column"><div className="command-section-label"><span>LIVE TABLE</span><span>{active.rows?.length ?? 0} TEAMS</span></div><AutoScrollViewport className="command-scroll-window command-table-native">{renderRows}</AutoScrollViewport></section>
          <section className="command-column"><AutoScrollViewport className="command-scroll-window command-fixtures-native">
            {active.fixtures?.length ? <><div className="command-section-label command-fixture-band-label"><span>{data?.state.currentGw} FIXTURES</span><span>{active.fixtures.length} GAMES</span></div>{active.fixtures.map((fixture) => <CommandFixtureCard key={fixture.key} fixture={fixture} color={color} />)}</> : null}
            {active.nextFixtures?.length ? <><div className="command-section-label command-fixture-band-label command-next-band"><span>{active.nextFixtures[0]?.gw ?? 'NEXT'} FIXTURES</span><span>{active.nextFixtures.length} GAMES</span></div>{active.nextFixtures.map((fixture) => <CommandFixtureCard key={fixture.key} fixture={fixture} color={color} />)}</> : null}
          </AutoScrollViewport></section>
        </div> : graphic ?? (active.rows?.length ? <section className="command-column command-single-column">{isLong && <div className="command-section-label"><span>FULL TABLE</span><span>AUTO-SCROLLING · {active.rows.length} ROWS</span></div>}<AutoScrollViewport className="command-scroll-window command-table-native">{renderRows}</AutoScrollViewport></section> : active.story ? <div className="command-story">{active.story}</div> : null)}
      </div>
      <footer className="command-slide-footer">{active.story && active.rows?.length ? <div className="command-slide-story">{active.story}</div> : <span />}<div className="command-progress-row"><div className="command-progress-track"><div key={`${active.id}-${cycle}-${paused}`} className="command-progress-fill" style={{ background: color, animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} /></div><span>{slideIndex + 1} / {slides.length}</span></div></footer>
    </article></div>
    <div className="command-ticker">{ticker.length ? <div className="command-ticker-track"><strong>LIVE DESK</strong>{[...ticker, ...ticker].join('   ·   ')}</div> : <span><strong>LIVE DESK</strong> BookieBall command centre running</span>}</div>
  </section>;
}
