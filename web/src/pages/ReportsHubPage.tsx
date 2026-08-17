import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { loadAllTimeAnalytics, type RivalryAnalytics, type TeamAllTimeAnalytics } from '../lib/allTimeAnalytics';

type Team = Awaited<ReturnType<typeof api.teams>>[number];
type Rating = Awaited<ReturnType<typeof api.teamRatings>>[number];
type ReportPack = Awaited<ReturnType<typeof api.reportPack>>;
type BookieDor = Awaited<ReturnType<typeof api.bookieDor>>;
type HistoryRow = Awaited<ReturnType<typeof api.teamSeasonHistoryBulk>>['histories'][number][number];

type AnalyticsState = {
  season: string;
  gw: string;
  teams: Team[];
  ratings: Rating[];
  archive: { teams: TeamAllTimeAnalytics[]; rivalries: RivalryAnalytics[] };
  report: ReportPack | null;
  bookieDor: BookieDor | null;
  histories: Record<number, HistoryRow[]>;
};

type Mode = 'overview' | 'races' | 'form' | 'rivalries' | 'history' | 'records';
type RaceMetric = 'profit' | 'wins' | 'bookiedor';

type Feature = {
  label: string;
  teamId: number | null;
  teamName: string;
  value: string;
  detail: string;
  accent: string;
};

type TrendRow = {
  teamId: number;
  teamName: string;
  rankDelta: number;
  pointsDelta: number;
  profitDelta: number;
};

type RaceRow = {
  teamId: number;
  teamName: string;
  value: number;
  display: string;
};

const MODES: Array<{ id: Mode; label: string; short: string }> = [
  { id: 'overview', label: 'Overview', short: 'LIVE' },
  { id: 'races', label: 'Races', short: 'RACE' },
  { id: 'form', label: 'Form', short: 'FORM' },
  { id: 'rivalries', label: 'Rivalries', short: 'H2H' },
  { id: 'history', label: 'History', short: 'HIST' },
  { id: 'records', label: 'Records', short: 'REC' },
];

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

function seasonNumber(value: string): number {
  return Number(value.replace('S', '')) || 0;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function meetingWinner(meeting: RivalryAnalytics['recentMeetings'][number]): string | null {
  if (meeting.result === 'home') return meeting.homeTeam;
  if (meeting.result === 'away') return meeting.awayTeam;
  return null;
}

function meetingOutcome(meeting: RivalryAnalytics['recentMeetings'][number], teamName: string): 'W' | 'D' | 'L' {
  const winner = meetingWinner(meeting);
  if (!winner) return 'D';
  return winner === teamName ? 'W' : 'L';
}

function badgeFor(team: Team | undefined, size: number) {
  if (!team) return null;
  return <TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={size} />;
}

function FeatureCard({ feature, team }: { feature: Feature; team: Team | undefined }) {
  return (
    <article className="av2-feature-card" key={`${feature.label}-${feature.teamName}`}>
      <div className="av2-feature-orbit" aria-hidden="true"><i /><i /><i /></div>
      <div className="av2-feature-ball">{badgeFor(team, 112)}</div>
      <div className="av2-feature-copy">
        <span>{feature.label}</span>
        <h2>{feature.teamName}</h2>
        <strong style={{ '--av2-accent': feature.accent } as React.CSSProperties}>{feature.value}</strong>
        <p>{feature.detail}</p>
      </div>
    </article>
  );
}

export function ReportsHubPage() {
  const [data, setData] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('overview');
  const [featureIndex, setFeatureIndex] = useState(0);
  const [raceMetric, setRaceMetric] = useState<RaceMetric>('profit');
  const [rivalryIndex, setRivalryIndex] = useState(0);
  const [eraIndex, setEraIndex] = useState(0);
  const [autoShow, setAutoShow] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const state = await api.state();
        const [teams, ratings, archive, report, bookieDor] = await Promise.all([
          api.teams(),
          api.teamRatings(),
          loadAllTimeAnalytics(),
          api.reportPack(state.currentGw).catch(() => null),
          api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
        ]);
        const historyPayload = await api.teamSeasonHistoryBulk(teams.map((team) => team.id)).catch(() => ({ histories: {} as Record<number, HistoryRow[]> }));
        if (!active) return;
        setData({ season: state.currentSeason, gw: state.currentGw, teams, ratings, archive, report, bookieDor, histories: historyPayload.histories });
        setError('');
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== 'overview') return;
    const timer = window.setInterval(() => setFeatureIndex((value) => value + 1), 6500);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'rivalries') return;
    const timer = window.setInterval(() => setRivalryIndex((value) => value + 1), 8000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'history') return;
    const timer = window.setInterval(() => setEraIndex((value) => value + 1), 4500);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (!autoShow) return;
    const timer = window.setInterval(() => {
      setMode((current) => {
        const index = MODES.findIndex((entry) => entry.id === current);
        return MODES[(index + 1) % MODES.length].id;
      });
    }, 12000);
    return () => window.clearInterval(timer);
  }, [autoShow]);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);
  const teamByName = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.name, team])), [data?.teams]);

  const profitLeaders = useMemo(() => (data?.ratings ?? []).slice().sort((a, b) => b.profit - a.profit), [data?.ratings]);
  const winRateLeaders = useMemo(() => (data?.ratings ?? []).filter((row) => row.entries > 0).slice().sort((a, b) => b.winRate - a.winRate || b.entries - a.entries), [data?.ratings]);
  const mostWins = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.wins - a.wins || b.winRate - a.winRate), [data?.archive.teams]);
  const allTimeProfit = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.profit - a.profit), [data?.archive.teams]);
  const allTimePoints = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.points - a.points), [data?.archive.teams]);
  const bouncebacks = useMemo(() => (data?.archive.teams ?? []).filter((row) => row.bouncebackOpportunities >= 3).slice().sort((a, b) => b.bouncebackRate - a.bouncebackRate || b.bouncebackOpportunities - a.bouncebackOpportunities), [data?.archive.teams]);
  const rivalries = useMemo(() => (data?.archive.rivalries ?? []).slice().sort((a, b) => b.rivalryScore - a.rivalryScore), [data?.archive.rivalries]);

  const trends = useMemo<TrendRow[]>(() => (data?.teams ?? []).map((team) => ({
    teamId: team.id,
    teamName: team.name,
    rankDelta: team.trendCache?.rankDelta ?? 0,
    pointsDelta: team.trendCache?.pointsDelta ?? 0,
    profitDelta: team.trendCache?.profitDelta ?? 0,
  })), [data?.teams]);

  const hotTeams = useMemo(() => trends.filter((row) => row.rankDelta > 0 || row.pointsDelta >= 3 || row.profitDelta > 0.5).sort((a, b) => b.rankDelta - a.rankDelta || b.pointsDelta - a.pointsDelta || b.profitDelta - a.profitDelta), [trends]);
  const coldTeams = useMemo(() => trends.filter((row) => row.rankDelta < 0 || row.profitDelta < -0.5).sort((a, b) => a.rankDelta - b.rankDelta || a.profitDelta - b.profitDelta), [trends]);
  const hotIds = useMemo(() => new Set(hotTeams.map((row) => row.teamId)), [hotTeams]);
  const coldIds = useMemo(() => new Set(coldTeams.map((row) => row.teamId)), [coldTeams]);
  const steadyTeams = useMemo(() => trends.filter((row) => !hotIds.has(row.teamId) && !coldIds.has(row.teamId)).sort((a, b) => Math.abs(a.rankDelta) - Math.abs(b.rankDelta) || Math.abs(a.profitDelta) - Math.abs(b.profitDelta)), [coldIds, hotIds, trends]);

  const consistency = useMemo(() => {
    if (!data) return [];
    return data.teams.map((team) => {
      const rows = data.histories[team.id] ?? [];
      const points = rows.map((row) => row.points);
      return { teamId: team.id, average: mean(points), best: points.length ? Math.max(...points) : 0, worst: points.length ? Math.min(...points) : 0, seasons: rows.length };
    }).filter((row) => row.seasons > 0).sort((a, b) => (a.best - a.worst) - (b.best - b.worst) || b.average - a.average);
  }, [data]);

  const eraLeaders = useMemo(() => {
    if (!data) return [];
    const maxSeason = Math.max(...Object.values(data.histories).flat().map((row) => seasonNumber(row.season)), seasonNumber(data.season));
    const eras: Array<{ from: number; to: number }> = [];
    for (let from = 1; from <= maxSeason; from += 4) eras.push({ from, to: Math.min(maxSeason, from + 3) });
    return eras.map((era) => {
      const totals = data.teams.map((team) => ({
        teamId: team.id,
        points: (data.histories[team.id] ?? []).filter((row) => {
          const season = seasonNumber(row.season);
          return season >= era.from && season <= era.to;
        }).reduce((sum, row) => sum + row.points, 0),
      })).sort((a, b) => b.points - a.points);
      return { label: `S${era.from}–S${era.to}`, ...totals[0] };
    }).filter((row) => row.teamId && row.points > 0);
  }, [data]);

  const biggestMover = useMemo(() => trends.slice().sort((a, b) => b.rankDelta - a.rankDelta || b.profitDelta - a.profitDelta)[0] ?? null, [trends]);

  const features = useMemo<Feature[]>(() => {
    if (!data) return [];
    const profitLeader = profitLeaders[0];
    const winLeader = winRateLeaders[0];
    const dor = data.bookieDor?.holder ?? null;
    return [
      profitLeader ? { label: 'PROFIT LEADER', teamId: profitLeader.teamId, teamName: profitLeader.teamName, value: signed(profitLeader.profit), detail: 'Current season profit', accent: '#55d6ff' } : null,
      winLeader ? { label: 'BEST WIN RATE', teamId: winLeader.teamId, teamName: winLeader.teamName, value: percent(winLeader.winRate), detail: `${winLeader.wins} wins from ${winLeader.entries} entries`, accent: '#54e094' } : null,
      biggestMover ? { label: 'BIGGEST GW MOVER', teamId: biggestMover.teamId, teamName: biggestMover.teamName, value: `${biggestMover.rankDelta > 0 ? '▲' : biggestMover.rankDelta < 0 ? '▼' : '•'}${Math.abs(biggestMover.rankDelta)}`, detail: `${signed(biggestMover.profitDelta)} profit in the trend window`, accent: '#ffca55' } : null,
      dor ? { label: "BOOKIE D'OR LEADER", teamId: teamByName.get(dor.teamName)?.id ?? null, teamName: dor.teamName, value: dor.score.toFixed(1), detail: 'Current award score', accent: '#f4c84d' } : null,
    ].filter((entry): entry is Feature => Boolean(entry));
  }, [biggestMover, data, profitLeaders, teamByName, winRateLeaders]);

  const raceRows = useMemo<RaceRow[]>(() => {
    if (!data) return [];
    if (raceMetric === 'profit') return profitLeaders.map((row) => ({ teamId: row.teamId, teamName: row.teamName, value: row.profit, display: signed(row.profit) }));
    if (raceMetric === 'wins') return mostWins.map((row) => ({ teamId: row.teamId, teamName: row.teamName, value: row.wins, display: `${row.wins} wins` }));
    return (data.bookieDor?.leaderboard ?? []).map((row) => ({ teamId: row.teamId, teamName: row.teamName, value: row.score, display: row.score.toFixed(1) }));
  }, [data, mostWins, profitLeaders, raceMetric]);

  const activeFeature = features.length ? features[featureIndex % features.length] : null;
  const activeRivalry = rivalries.length ? rivalries[rivalryIndex % Math.min(8, rivalries.length)] : null;
  const activeEra = eraLeaders.length ? eraLeaders[eraIndex % eraLeaders.length] : null;

  if (loading) {
    return <section className="page page-wide analytics-v2 analytics-v2-loading"><div className="av2-loader-orbit"><i /><i /><i /></div><strong>BUILDING THE DATA CHANNEL</strong><span>Loading BookieBall history, form and rivalries…</span></section>;
  }

  if (!data) {
    return <section className="page page-wide analytics-v2 analytics-v2-loading"><strong>ANALYTICS UNAVAILABLE</strong><span>{error || 'No analytics available.'}</span></section>;
  }

  const raceValues = raceRows.slice(0, 12).map((row) => row.value);
  const raceMin = raceValues.length ? Math.min(...raceValues) : 0;
  const raceMax = raceValues.length ? Math.max(...raceValues) : 1;
  const raceWidth = (value: number) => 18 + 82 * (raceMax === raceMin ? 0.5 : (value - raceMin) / (raceMax - raceMin));
  const lastStorylines = data.report?.story.storylines ?? [];

  return (
    <section className={`page page-wide analytics-v2 av2-mode-${mode}`}>
      <header className="av2-header">
        <div className="av2-brand"><span>BOOKIEBALL DATA CHANNEL</span><h1>Analytics</h1><b>{data.season} · {data.gw}</b></div>
        <div className="av2-header-actions"><button type="button" className={autoShow ? 'is-live' : ''} onClick={() => setAutoShow((value) => !value)}>{autoShow ? '■ STOP AUTO SHOW' : '▶ AUTO SHOW'}</button><Link to="/head-to-head">H2H</Link><Link to="/reporting">Detailed Reports</Link></div>
      </header>

      <nav className="av2-nav" aria-label="Analytics channel sections">
        {MODES.map((entry) => <button key={entry.id} type="button" className={mode === entry.id ? 'active' : ''} onClick={() => setMode(entry.id)}><i>{entry.short}</i><span>{entry.label}</span></button>)}
      </nav>

      <main className="av2-stage-wrap">
        {mode === 'overview' && activeFeature ? (
          <div className="av2-stage av2-overview-stage">
            <FeatureCard feature={activeFeature} team={activeFeature.teamId ? teamById.get(activeFeature.teamId) : undefined} />
            <aside className="av2-feature-rail">
              {features.map((feature, index) => <button key={feature.label} type="button" className={index === featureIndex % features.length ? 'active' : ''} onClick={() => setFeatureIndex(index)}><span>{feature.label}</span><strong>{feature.teamName}</strong><b>{feature.value}</b></button>)}
            </aside>
          </div>
        ) : null}

        {mode === 'races' ? (
          <div className="av2-stage av2-races-stage">
            <div className="av2-stage-title"><div><span>LIVE RANKING</span><h2>{raceMetric === 'profit' ? 'Profit Race' : raceMetric === 'wins' ? 'All-Time Wins Race' : "Bookie d'Or Race"}</h2></div><div className="av2-race-tabs"><button className={raceMetric === 'profit' ? 'active' : ''} onClick={() => setRaceMetric('profit')}>Profit</button><button className={raceMetric === 'wins' ? 'active' : ''} onClick={() => setRaceMetric('wins')}>Wins</button><button className={raceMetric === 'bookiedor' ? 'active' : ''} onClick={() => setRaceMetric('bookiedor')}>Bookie d'Or</button></div></div>
            <div className="av2-race-board" key={raceMetric}>
              {raceRows.slice(0, 12).map((row, index) => {
                const team = teamById.get(row.teamId);
                return <div key={`${raceMetric}-${row.teamId}`} className="av2-race-row" style={{ '--av2-race-delay': `${index * 70}ms` } as React.CSSProperties}><b>#{index + 1}</b><div className="av2-race-team">{badgeFor(team, 28)}<strong>{row.teamName}</strong></div><div className="av2-race-track"><i style={{ '--av2-race-width': `${raceWidth(row.value)}%`, '--av2-team-color': team?.ballColor ?? '#5eb7ff' } as React.CSSProperties}><span /></i></div><em>{row.display}</em></div>;
              })}
            </div>
          </div>
        ) : null}

        {mode === 'form' ? (
          <div className="av2-stage av2-form-stage">
            <div className="av2-stage-title"><div><span>CURRENT TREND WINDOW</span><h2>Who's Hot. Who's Cold.</h2></div><small>Based on actual rank, points and profit movement — no hidden rating.</small></div>
            <div className="av2-form-zones">
              {([
                { key: 'hot', label: 'HOT', icon: '🔥', rows: hotTeams, note: 'Moving up / making profit' },
                { key: 'steady', label: 'STEADY', icon: '●', rows: steadyTeams, note: 'Holding position' },
                { key: 'cold', label: 'COLD', icon: '❄', rows: coldTeams, note: 'Sliding / losing profit' },
              ] as const).map((zone) => <section key={zone.key} className={`av2-form-zone is-${zone.key}`}><header><b>{zone.icon}</b><div><span>{zone.label}</span><small>{zone.note}</small></div></header><div>{zone.rows.slice(0, 8).map((row, index) => <article key={row.teamId} style={{ '--av2-form-delay': `${index * 80}ms` } as React.CSSProperties}>{badgeFor(teamById.get(row.teamId), 30)}<strong>{row.teamName}</strong><span>{row.rankDelta > 0 ? `▲${row.rankDelta}` : row.rankDelta < 0 ? `▼${Math.abs(row.rankDelta)}` : '•'} rank</span><b>{signed(row.profitDelta)} profit</b></article>)}</div></section>)}
            </div>
          </div>
        ) : null}

        {mode === 'rivalries' && activeRivalry ? (
          <div className="av2-stage av2-rivalry-stage" key={`${activeRivalry.teamAId}-${activeRivalry.teamBId}`}>
            <div className="av2-rivalry-topline"><span>RIVALRY #{(rivalryIndex % Math.min(8, rivalries.length)) + 1}</span><strong>{activeRivalry.meetings} MEETINGS</strong></div>
            <div className="av2-rivalry-fight">
              <div className="av2-rivalry-team left">{badgeFor(teamById.get(activeRivalry.teamAId), 94)}<h2>{activeRivalry.teamAName}</h2><b>{activeRivalry.teamAWins} wins</b></div>
              <div className="av2-rivalry-record"><span>ALL-TIME</span><strong>{activeRivalry.teamAWins}<i>—</i>{activeRivalry.draws}<i>—</i>{activeRivalry.teamBWins}</strong><em>W · D · W</em><b>{activeRivalry.currentStreak}</b></div>
              <div className="av2-rivalry-team right">{badgeFor(teamById.get(activeRivalry.teamBId), 94)}<h2>{activeRivalry.teamBName}</h2><b>{activeRivalry.teamBWins} wins</b></div>
            </div>
            <div className="av2-rivalry-history"><div className="av2-last-five"><span>LAST 5</span>{activeRivalry.recentMeetings.map((meeting, index) => <article key={`${meeting.season}-${meeting.gw}-${index}`} className={`is-${meetingOutcome(meeting, activeRivalry.teamAName).toLowerCase()}`}><b>{meetingOutcome(meeting, activeRivalry.teamAName)}</b><span>{meeting.season} {meeting.gw}</span><strong>{signed(meeting.homeProfit)} — {signed(meeting.awayProfit)}</strong></article>)}</div><div className="av2-previous-meeting"><span>PREVIOUS MEETING</span>{activeRivalry.lastMeeting ? <><strong>{activeRivalry.lastMeeting.homeTeam} <b>{signed(activeRivalry.lastMeeting.homeProfit)} — {signed(activeRivalry.lastMeeting.awayProfit)}</b> {activeRivalry.lastMeeting.awayTeam}</strong><em>{activeRivalry.lastMeeting.season} · {activeRivalry.lastMeeting.gw}</em></> : <strong>No previous meeting</strong>}</div></div>
            <div className="av2-rivalry-dots">{rivalries.slice(0, 8).map((row, index) => <button key={`${row.teamAId}-${row.teamBId}`} className={index === rivalryIndex % Math.min(8, rivalries.length) ? 'active' : ''} onClick={() => setRivalryIndex(index)} aria-label={`Show ${row.teamAName} versus ${row.teamBName}`} />)}</div>
          </div>
        ) : null}

        {mode === 'history' && activeEra ? (
          <div className="av2-stage av2-history-stage">
            <div className="av2-stage-title"><div><span>16-SEASON ARCHIVE</span><h2>BookieBall Through The Eras</h2></div><small>Division points accumulated inside each era.</small></div>
            <div className="av2-history-layout">
              <section className="av2-era-feature" key={activeEra.label}><span>{activeEra.label}</span><div className="av2-era-ball">{badgeFor(teamById.get(activeEra.teamId), 108)}</div><h2>{teamById.get(activeEra.teamId)?.name ?? '—'}</h2><strong>{activeEra.points} pts</strong><p>Era leader</p></section>
              <section className="av2-history-podium"><span>ALL-TIME DIVISION POINTS</span><div>{allTimePoints.slice(0, 3).map((row, index) => <article key={row.teamId} className={`place-${index + 1}`}><b>#{index + 1}</b>{badgeFor(teamById.get(row.teamId), index === 0 ? 58 : 46)}<strong>{row.teamName}</strong><span>{row.points} pts</span></article>)}</div></section>
            </div>
            <div className="av2-era-timeline">{eraLeaders.map((era, index) => <button key={era.label} className={index === eraIndex % eraLeaders.length ? 'active' : ''} onClick={() => setEraIndex(index)}><span>{era.label}</span><strong>{teamById.get(era.teamId)?.name ?? '—'}</strong></button>)}</div>
          </div>
        ) : null}

        {mode === 'records' ? (
          <div className="av2-stage av2-records-stage">
            <div className="av2-stage-title"><div><span>RECORD BOOK</span><h2>Records & Milestones</h2></div><small>Literal BookieBall records — no mystery scores.</small></div>
            <div className="av2-record-grid">
              {[
                { label: 'MOST DIVISION WINS', teamId: mostWins[0]?.teamId, teamName: mostWins[0]?.teamName, value: mostWins[0] ? `${mostWins[0].wins} wins` : '—', detail: mostWins[0] ? `${mostWins[0].played} played` : '' },
                { label: 'ALL-TIME PROFIT', teamId: allTimeProfit[0]?.teamId, teamName: allTimeProfit[0]?.teamName, value: allTimeProfit[0] ? signed(allTimeProfit[0].profit) : '—', detail: 'Career division profit' },
                { label: 'BEST BOUNCEBACK', teamId: bouncebacks[0]?.teamId, teamName: bouncebacks[0]?.teamName, value: bouncebacks[0] ? percent(bouncebacks[0].bouncebackRate) : '—', detail: bouncebacks[0] ? `${bouncebacks[0].bouncebackWins}/${bouncebacks[0].bouncebackOpportunities} wins after defeat` : '' },
                { label: 'MOST MEETINGS', teamId: rivalries[0]?.teamAId, teamName: rivalries[0] ? `${rivalries[0].teamAName} vs ${rivalries[0].teamBName}` : '—', value: rivalries[0] ? `${rivalries[0].meetings}` : '—', detail: 'Rivalry meetings' },
                { label: 'BEST CURRENT WIN RATE', teamId: winRateLeaders[0]?.teamId, teamName: winRateLeaders[0]?.teamName, value: winRateLeaders[0] ? percent(winRateLeaders[0].winRate) : '—', detail: winRateLeaders[0] ? `${winRateLeaders[0].wins}/${winRateLeaders[0].entries}` : '' },
                { label: 'STEADIEST SEASONS', teamId: consistency[0]?.teamId, teamName: consistency[0] ? teamById.get(consistency[0].teamId)?.name ?? '—' : '—', value: consistency[0] ? `${consistency[0].worst}–${consistency[0].best} pts` : '—', detail: consistency[0] ? `${consistency[0].average.toFixed(1)} average across ${consistency[0].seasons} seasons` : '' },
              ].map((record, index) => <article key={record.label} style={{ '--av2-record-delay': `${index * 90}ms` } as React.CSSProperties}><span>{record.label}</span><div>{record.teamId ? badgeFor(teamById.get(record.teamId), 46) : null}<strong>{record.teamName}</strong></div><b>{record.value}</b><small>{record.detail}</small></article>)}
            </div>
            {data.report?.achievements?.length ? <div className="av2-milestone-rail"><strong>RECENT MILESTONES</strong>{data.report.achievements.slice(0, 5).map((item) => <span key={item.key}>{item.teamName} · {item.label} · {item.value}</span>)}</div> : null}
          </div>
        ) : null}
      </main>

      <footer className="av2-ticker"><strong>LIVE</strong><div><span>{lastStorylines.length ? lastStorylines.map((story) => `${story.headline}${story.metric ? ` · ${story.metric}` : ''}`).join('   •   ') : `${data.season} ${data.gw} · BookieBall analytics live`}</span></div></footer>
    </section>
  );
}
