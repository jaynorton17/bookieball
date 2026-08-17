import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { loadAllTimeAnalytics, type RivalryAnalytics } from '../lib/allTimeAnalytics';

type Team = Awaited<ReturnType<typeof api.teams>>[number];
type Rating = Awaited<ReturnType<typeof api.teamRatings>>[number];
type BookieDor = Awaited<ReturnType<typeof api.bookieDor>>;
type HistoryRow = Awaited<ReturnType<typeof api.teamSeasonHistoryBulk>>['histories'][number][number];
type LeagueFixture = Awaited<ReturnType<typeof api.leagueFixtures>>[number];
type Mode = 'overview' | 'races' | 'form' | 'rivalries' | 'history' | 'records';
type RaceMetric = 'profit' | 'wins' | 'bookiedor';
type FormResult = 'W' | 'D' | 'L';

type DataState = {
  season: string;
  gw: string;
  teams: Team[];
  ratings: Rating[];
  archive: Awaited<ReturnType<typeof loadAllTimeAnalytics>>;
  bookieDor: BookieDor | null;
  histories: Record<number, HistoryRow[]>;
  fixtures: LeagueFixture[];
};

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'races', label: 'Races' },
  { id: 'form', label: 'Form' },
  { id: 'rivalries', label: 'Rivalries' },
  { id: 'history', label: 'History' },
  { id: 'records', label: 'Records' },
];

function seasonNumber(value: string): number { return Number(value.replace('S', '')) || 0; }
function gwNumber(value: string): number { return Number(value.replace('GW', '')) || 0; }
function signed(value: number): string { return `${value > 0 ? '+' : ''}${value.toFixed(2)}`; }
function percent(value: number): string { return `${Math.round(value * 100)}%`; }

function meetingWinner(meeting: RivalryAnalytics['recentMeetings'][number]): string | null {
  if (meeting.result === 'home') return meeting.homeTeam;
  if (meeting.result === 'away') return meeting.awayTeam;
  return null;
}

function resultForMeeting(meeting: RivalryAnalytics['recentMeetings'][number], teamName: string): FormResult {
  const winner = meetingWinner(meeting);
  return !winner ? 'D' : winner === teamName ? 'W' : 'L';
}

function badge(team: Team | undefined, size = 32) {
  if (!team) return null;
  return <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={size} />;
}

export function AnalyticsTvPage() {
  const [data, setData] = useState<DataState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('overview');
  const [featureIndex, setFeatureIndex] = useState(0);
  const [raceMetric, setRaceMetric] = useState<RaceMetric>('profit');
  const [rivalryIndex, setRivalryIndex] = useState(0);
  const [eraIndex, setEraIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const state = await api.state();
        const [teams, ratings, archive, bookieDor, fixtures] = await Promise.all([
          api.teams(),
          api.teamRatings(),
          loadAllTimeAnalytics(),
          api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
          api.leagueFixtures(undefined, true, state.currentSeason).catch(() => []),
        ]);
        const history = await api.teamSeasonHistoryBulk(teams.map((team) => team.id)).catch(() => ({ histories: {} as Record<number, HistoryRow[]> }));
        if (!active) return;
        setData({ season: state.currentSeason, gw: state.currentGw, teams, ratings, archive, bookieDor, histories: history.histories, fixtures });
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Analytics unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== 'overview') return;
    const timer = window.setInterval(() => setFeatureIndex((value) => value + 1), 6000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'races') return;
    const order: RaceMetric[] = ['profit', 'wins', 'bookiedor'];
    const timer = window.setInterval(() => setRaceMetric((current) => order[(order.indexOf(current) + 1) % order.length]), 8500);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'rivalries') return;
    const timer = window.setInterval(() => setRivalryIndex((value) => value + 1), 8000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'history') return;
    const timer = window.setInterval(() => setEraIndex((value) => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);
  const teamByName = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.name, team])), [data?.teams]);
  const profitLeaders = useMemo(() => (data?.ratings ?? []).slice().sort((a, b) => b.profit - a.profit), [data?.ratings]);
  const winRateLeaders = useMemo(() => (data?.ratings ?? []).filter((row) => row.entries > 0).slice().sort((a, b) => b.winRate - a.winRate || b.entries - a.entries), [data?.ratings]);
  const allTimeWins = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.wins - a.wins), [data?.archive.teams]);
  const allTimeProfit = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.profit - a.profit), [data?.archive.teams]);
  const allTimePoints = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.points - a.points), [data?.archive.teams]);
  const bounceback = useMemo(() => (data?.archive.teams ?? []).filter((row) => row.bouncebackOpportunities >= 3).slice().sort((a, b) => b.bouncebackRate - a.bouncebackRate), [data?.archive.teams]);
  const rivalries = useMemo(() => (data?.archive.rivalries ?? []).slice().sort((a, b) => b.rivalryScore - a.rivalryScore), [data?.archive.rivalries]);

  const mover = useMemo(() => (data?.teams ?? []).map((team) => ({ team, delta: team.trendCache?.rankDelta ?? 0, profit: team.trendCache?.profitDelta ?? 0 })).sort((a, b) => b.delta - a.delta || b.profit - a.profit)[0] ?? null, [data?.teams]);

  const features = useMemo(() => {
    if (!data) return [];
    const profit = profitLeaders[0];
    const winRate = winRateLeaders[0];
    const dor = data.bookieDor?.holder ?? null;
    return [
      profit ? { label: 'PROFIT LEADER', name: profit.teamName, teamId: profit.teamId, value: signed(profit.profit), detail: 'Current-season profit' } : null,
      winRate ? { label: 'BEST WIN RATE', name: winRate.teamName, teamId: winRate.teamId, value: percent(winRate.winRate), detail: `${winRate.wins} wins from ${winRate.entries}` } : null,
      mover ? { label: 'BIGGEST MOVER', name: mover.team.name, teamId: mover.team.id, value: mover.delta > 0 ? `▲ ${mover.delta}` : mover.delta < 0 ? `▼ ${Math.abs(mover.delta)}` : '—', detail: `${signed(mover.profit)} profit movement` } : null,
      dor ? { label: "BOOKIE D'OR LEADER", name: dor.teamName, teamId: teamByName.get(dor.teamName)?.id ?? 0, value: dor.score.toFixed(1), detail: 'Current award race' } : null,
    ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [data, mover, profitLeaders, teamByName, winRateLeaders]);

  const recentForm = useMemo(() => {
    if (!data) return new Map<number, FormResult[]>();
    const byName = new Map(data.teams.map((team) => [team.name, team.id]));
    const result = new Map<number, FormResult[]>();
    const ordered = data.fixtures.filter((fixture) => fixture.result !== 'pending').slice().sort((a, b) => gwNumber(a.gw) - gwNumber(b.gw) || a.id - b.id);
    for (const fixture of ordered) {
      const homeId = byName.get(fixture.homeTeam);
      const awayId = byName.get(fixture.awayTeam);
      if (!homeId || !awayId) continue;
      const home: FormResult = fixture.result === 'draw' ? 'D' : fixture.result === 'home' ? 'W' : 'L';
      const away: FormResult = fixture.result === 'draw' ? 'D' : fixture.result === 'away' ? 'W' : 'L';
      result.set(homeId, [...(result.get(homeId) ?? []), home].slice(-5));
      result.set(awayId, [...(result.get(awayId) ?? []), away].slice(-5));
    }
    return result;
  }, [data]);

  const formGroups = useMemo(() => {
    if (!data) return { hot: [] as Team[], steady: [] as Team[], cold: [] as Team[] };
    const scored = data.teams.map((team) => {
      const form = recentForm.get(team.id) ?? [];
      const score = form.reduce((sum, item) => sum + (item === 'W' ? 3 : item === 'D' ? 1 : 0), 0);
      return { team, form, score };
    }).sort((a, b) => b.score - a.score);
    return {
      hot: scored.slice(0, 8).map((row) => row.team),
      steady: scored.slice(8, 16).map((row) => row.team),
      cold: scored.slice(-8).reverse().map((row) => row.team),
    };
  }, [data, recentForm]);

  const eraLeaders = useMemo(() => {
    if (!data) return [];
    const maxSeason = Math.max(seasonNumber(data.season), ...Object.values(data.histories).flat().map((row) => seasonNumber(row.season)));
    const eras: Array<{ from: number; to: number }> = [];
    for (let from = 1; from <= maxSeason; from += 4) eras.push({ from, to: Math.min(maxSeason, from + 3) });
    return eras.map((era) => {
      const totals = data.teams.map((team) => ({ teamId: team.id, teamName: team.name, points: (data.histories[team.id] ?? []).filter((row) => { const s = seasonNumber(row.season); return s >= era.from && s <= era.to; }).reduce((sum, row) => sum + row.points, 0) })).sort((a, b) => b.points - a.points);
      return { label: `S${era.from}–S${era.to}`, ...(totals[0] ?? { teamId: 0, teamName: '—', points: 0 }) };
    }).filter((row) => row.teamId);
  }, [data]);

  if (loading) return <section className="analytics-tv"><div className="analytics-tv-empty"><strong>BUILDING THE DATA CHANNEL…</strong></div></section>;
  if (!data) return <section className="analytics-tv"><div className="analytics-tv-empty">{error || 'Analytics unavailable.'}</div></section>;

  const activeFeature = features[featureIndex % Math.max(1, features.length)];
  const activeRivalry = rivalries[rivalryIndex % Math.max(1, Math.min(8, rivalries.length))];
  const activeEra = eraLeaders[eraIndex % Math.max(1, eraLeaders.length)];
  const raceRows = raceMetric === 'profit'
    ? profitLeaders.map((row) => ({ teamId: row.teamId, name: row.teamName, value: row.profit, display: signed(row.profit) }))
    : raceMetric === 'wins'
      ? allTimeWins.map((row) => ({ teamId: row.teamId, name: row.teamName, value: row.wins, display: `${row.wins} wins` }))
      : (data.bookieDor?.leaderboard ?? []).map((row) => ({ teamId: row.teamId, name: row.teamName, value: row.score, display: row.score.toFixed(1) }));
  const topRace = raceRows.slice(0, 12);
  const minRace = Math.min(...topRace.map((row) => row.value), 0);
  const maxRace = Math.max(...topRace.map((row) => row.value), 1);

  const formColumn = (title: string, teams: Team[], tone: string) => <section className="analytics-tv-form-column"><h3>{title}</h3><div className="analytics-tv-form-grid">{teams.map((team) => <article key={`${tone}-${team.id}`} className="analytics-tv-form-card"><div className="analytics-tv-form-head">{badge(team, 25)}<strong>{team.name}</strong></div><div className="analytics-tv-form-badges">{(recentForm.get(team.id) ?? []).map((result, index) => <i key={`${team.id}-${index}`} className={result.toLowerCase()}>{result}</i>)}</div></article>)}</div></section>;

  return (
    <section className="analytics-tv">
      <div className="analytics-tv-shell">
        <header className="analytics-tv-head"><div><h1>BookieBall Analytics</h1><p>{data.season} · {data.gw} · the data channel</p></div><div className="analytics-tv-live"><i /> LIVE DATA</div></header>
        <nav className="analytics-tv-nav" aria-label="Analytics channels">{MODES.map((entry) => <button key={entry.id} type="button" className={mode === entry.id ? 'active' : ''} onClick={() => setMode(entry.id)}>{entry.label}</button>)}</nav>
        <main className="analytics-tv-stage">
          {mode === 'overview' && activeFeature ? <div className="analytics-tv-scene"><div className="analytics-tv-scene-title"><div><span>NOW SHOWING</span><h2>Live Overview</h2></div><p>Headline rotates every 6 seconds</p></div><div className="analytics-tv-kpis"><article className="analytics-tv-kpi"><span>PROFIT LEADER</span><strong>{profitLeaders[0]?.teamName ?? '—'}</strong><small>{profitLeaders[0] ? signed(profitLeaders[0].profit) : '—'}</small></article><article className="analytics-tv-kpi"><span>BEST WIN RATE</span><strong>{winRateLeaders[0]?.teamName ?? '—'}</strong><small>{winRateLeaders[0] ? percent(winRateLeaders[0].winRate) : '—'}</small></article><article className="analytics-tv-kpi"><span>MOST ALL-TIME WINS</span><strong>{allTimeWins[0]?.teamName ?? '—'}</strong><small>{allTimeWins[0]?.wins ?? 0} wins</small></article><article className="analytics-tv-kpi"><span>BOUNCEBACK KING</span><strong>{bounceback[0]?.teamName ?? '—'}</strong><small>{bounceback[0] ? percent(bounceback[0].bouncebackRate) : '—'}</small></article></div><div className="analytics-tv-feature"><div className="analytics-tv-feature-orb">{badge(teamById.get(activeFeature.teamId), 138)}</div><div className="analytics-tv-feature-copy"><span>{activeFeature.label}</span><h2>{activeFeature.name}</h2><strong>{activeFeature.value}</strong><p>{activeFeature.detail}</p></div></div></div> : null}

          {mode === 'races' ? <div className="analytics-tv-scene"><div className="analytics-tv-scene-title"><div><span>LIVE RANKING</span><h2>{raceMetric === 'profit' ? 'Profit Race' : raceMetric === 'wins' ? 'All-Time Win Race' : "Bookie d'Or Race"}</h2></div><div className="analytics-tv-race-controls"><button className={raceMetric === 'profit' ? 'active' : ''} onClick={() => setRaceMetric('profit')}>Profit</button><button className={raceMetric === 'wins' ? 'active' : ''} onClick={() => setRaceMetric('wins')}>Wins</button><button className={raceMetric === 'bookiedor' ? 'active' : ''} onClick={() => setRaceMetric('bookiedor')}>Bookie d'Or</button></div></div><div className="analytics-tv-race">{topRace.map((row, index) => { const width = 18 + ((row.value - minRace) / Math.max(.001, maxRace - minRace)) * 82; return <article className="analytics-tv-race-row" key={`${raceMetric}-${row.teamId}`} style={{ animationDelay: `${index * 45}ms` }}><span>#{index + 1}</span><div className="analytics-tv-race-team">{badge(teamById.get(row.teamId), 24)}<strong>{row.name}</strong></div><div className="analytics-tv-race-track"><i style={{ '--race-width': `${width}%` } as CSSProperties} /></div><b>{row.display}</b></article>; })}</div></div> : null}

          {mode === 'form' ? <div className="analytics-tv-scene"><div className="analytics-tv-scene-title"><div><span>LAST FIVE LEAGUE RESULTS</span><h2>Form Heat</h2></div><p>Teams grouped by actual W/D/L form</p></div><div className="analytics-tv-form-columns">{formColumn('🔥 HOT', formGroups.hot, 'hot')}{formColumn('● STEADY', formGroups.steady, 'steady')}{formColumn('❄ COLD', formGroups.cold, 'cold')}</div></div> : null}

          {mode === 'rivalries' && activeRivalry ? <div className="analytics-tv-scene"><div className="analytics-tv-scene-title"><div><span>RIVALRY THEATRE</span><h2>Biggest Rivalries</h2></div><p>{rivalryIndex % Math.min(8, rivalries.length) + 1} of {Math.min(8, rivalries.length)}</p></div><div className="analytics-tv-rivalry"><div className="analytics-tv-rival-side">{badge(teamById.get(activeRivalry.teamAId), 118)}<h3>{activeRivalry.teamAName}</h3></div><div className="analytics-tv-rival-score"><span>ALL-TIME W · D · W</span><strong>{activeRivalry.teamAWins} · {activeRivalry.draws} · {activeRivalry.teamBWins}</strong><small>{activeRivalry.meetings} meetings · {activeRivalry.currentStreak}</small><div className="analytics-tv-last5">{activeRivalry.recentMeetings.slice(-5).map((meeting, index) => <i key={`${meeting.season}-${meeting.gw}-${index}`}>{resultForMeeting(meeting, activeRivalry.teamAName)}</i>)}</div>{activeRivalry.lastMeeting ? <div className="analytics-tv-last-meeting"><b>PREVIOUS MEETING</b><br />{activeRivalry.lastMeeting.season} {activeRivalry.lastMeeting.gw} · {activeRivalry.lastMeeting.homeTeam} {signed(activeRivalry.lastMeeting.homeProfit)} — {signed(activeRivalry.lastMeeting.awayProfit)} {activeRivalry.lastMeeting.awayTeam}</div> : null}</div><div className="analytics-tv-rival-side">{badge(teamById.get(activeRivalry.teamBId), 118)}<h3>{activeRivalry.teamBName}</h3></div></div></div> : null}

          {mode === 'history' ? <div className="analytics-tv-scene"><div className="analytics-tv-scene-title"><div><span>16-SEASON ARCHIVE</span><h2>BookieBall Eras</h2></div><p>{activeEra ? `${activeEra.label}: ${activeEra.teamName}` : ''}</p></div><div className="analytics-tv-history"><div className="analytics-tv-era-list">{eraLeaders.map((era, index) => <article key={era.label} className={`analytics-tv-era-card ${activeEra?.label === era.label ? 'active' : ''}`} onClick={() => setEraIndex(index)}>{badge(teamById.get(era.teamId), 48)}<span>{era.label}</span><strong>{era.teamName}</strong><b>{era.points} pts</b></article>)}</div><div className="analytics-tv-podium">{allTimePoints.slice(0, 3).map((row, index) => <article key={row.teamId}>{badge(teamById.get(row.teamId), 54)}<strong>#{index + 1} {row.teamName}</strong><b>{row.points} pts</b></article>)}</div></div></div> : null}

          {mode === 'records' ? <div className="analytics-tv-scene"><div className="analytics-tv-scene-title"><div><span>RECORD BOOK</span><h2>Records & Milestones</h2></div><p>Only numbers you can understand at a glance</p></div><div className="analytics-tv-records"><article className="analytics-tv-record"><span className="icon">💰</span><div><strong>ALL-TIME PROFIT KING</strong><small>{allTimeProfit[0]?.teamName ?? '—'}</small></div><b>{allTimeProfit[0] ? signed(allTimeProfit[0].profit) : '—'}</b></article><article className="analytics-tv-record"><span className="icon">🏆</span><div><strong>MOST LEAGUE WINS</strong><small>{allTimeWins[0]?.teamName ?? '—'}</small></div><b>{allTimeWins[0]?.wins ?? 0}</b></article><article className="analytics-tv-record"><span className="icon">📈</span><div><strong>MOST ALL-TIME POINTS</strong><small>{allTimePoints[0]?.teamName ?? '—'}</small></div><b>{allTimePoints[0]?.points ?? 0}</b></article><article className="analytics-tv-record"><span className="icon">↩️</span><div><strong>BEST BOUNCEBACK RATE</strong><small>{bounceback[0]?.teamName ?? '—'}</small></div><b>{bounceback[0] ? percent(bounceback[0].bouncebackRate) : '—'}</b></article><article className="analytics-tv-record"><span className="icon">⚔️</span><div><strong>MOST-PLAYED RIVALRY</strong><small>{rivalries[0] ? `${rivalries[0].teamAName} vs ${rivalries[0].teamBName}` : '—'}</small></div><b>{rivalries[0]?.meetings ?? 0}</b></article><article className="analytics-tv-record"><span className="icon">🔥</span><div><strong>CURRENT RIVALRY STREAK</strong><small>{rivalries.find((row) => /straight win/.test(row.currentStreak))?.currentStreak ?? 'No active streak'}</small></div><b>LIVE</b></article></div></div> : null}
        </main>
      </div>
    </section>
  );
}
