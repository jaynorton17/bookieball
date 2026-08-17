import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { loadAllTimeAnalytics, type TeamAllTimeAnalytics, type RivalryAnalytics } from '../lib/allTimeAnalytics';

type Team = Awaited<ReturnType<typeof api.teams>>[number];
type Rating = Awaited<ReturnType<typeof api.teamRatings>>[number];
type ReportPack = Awaited<ReturnType<typeof api.reportPack>>;
type BookieDor = Awaited<ReturnType<typeof api.bookieDor>>;
type HistoryRow = Awaited<ReturnType<typeof api.teamSeasonHistoryBulk>>['histories'][number][number];

type AnalyticsState = { season: string; gw: string; teams: Team[]; ratings: Rating[]; archive: { teams: TeamAllTimeAnalytics[]; rivalries: RivalryAnalytics[] }; report: ReportPack | null; bookieDor: BookieDor | null; histories: Record<number, HistoryRow[]> };
type ConsistencyRow = { teamId: number; average: number; best: number; worst: number; seasons: number };

function signed(value: number, digits = 2): string { return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`; }
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function seasonNumber(value: string): number { return Number(value.replace('S', '')) || 0; }
function winRateLabel(value: number): string { return `${Math.round(Math.max(0, value) * 100)}%`; }
function previousMeeting(row: RivalryAnalytics): string { const last = row.lastMeeting; return last ? `${last.season} ${last.gw} · ${last.homeTeam} ${signed(last.homeProfit)} – ${signed(last.awayProfit)} ${last.awayTeam}` : 'No previous meeting'; }
function TeamLine({ team, value, detail }: { team: Team | undefined; value: string; detail?: string }) { if (!team) return null; return <div className="analytics-team-line"><TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={22} /><div><strong>{team.name}</strong>{detail && <span>{detail}</span>}</div><b>{value}</b></div>; }

export function ReportsHubClassicPage() {
  const [data, setData] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const state = await api.state();
        const [teams, ratings, archive, report, bookieDor] = await Promise.all([api.teams(), api.teamRatings(), loadAllTimeAnalytics(), api.reportPack(state.currentGw).catch(() => null), api.bookieDor(state.currentSeason, state.currentGw).catch(() => null)]);
        const historyPayload = await api.teamSeasonHistoryBulk(teams.map((team) => team.id)).catch(() => ({ histories: {} as Record<number, HistoryRow[]> }));
        if (!active) return;
        setData({ season: state.currentSeason, gw: state.currentGw, teams, ratings, archive, report, bookieDor, histories: historyPayload.histories }); setError('');
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load analytics.'); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, []);

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);
  const consistency = useMemo<ConsistencyRow[]>(() => {
    if (!data) return [];
    return data.teams.map((team) => { const rows = data.histories[team.id] ?? []; const points = rows.map((row) => row.points); return { teamId: team.id, average: mean(points), best: points.length ? Math.max(...points) : 0, worst: points.length ? Math.min(...points) : 0, seasons: rows.length }; }).filter((row) => row.seasons > 0).sort((a, b) => (a.best - a.worst) - (b.best - b.worst) || b.average - a.average);
  }, [data]);
  const eraLeaders = useMemo(() => {
    if (!data) return [];
    const maxSeason = Math.max(...Object.values(data.histories).flat().map((row) => seasonNumber(row.season)), seasonNumber(data.season));
    const eras: Array<{ from: number; to: number }> = []; for (let from = 1; from <= maxSeason; from += 4) eras.push({ from, to: Math.min(maxSeason, from + 3) });
    return eras.map((era) => { const totals = data.teams.map((team) => ({ teamId: team.id, points: (data.histories[team.id] ?? []).filter((row) => { const season = seasonNumber(row.season); return season >= era.from && season <= era.to; }).reduce((sum, row) => sum + row.points, 0) })).sort((a, b) => b.points - a.points); return { label: `S${era.from}–S${era.to}`, ...totals[0] }; }).filter((row) => row.teamId && row.points > 0);
  }, [data]);
  const momentum = useMemo(() => (data?.teams ?? []).map((team) => ({ teamId: team.id, teamName: team.name, rankDelta: team.trendCache?.rankDelta ?? 0, profitDelta: team.trendCache?.profitDelta ?? 0 })).sort((a, b) => b.rankDelta - a.rankDelta || b.profitDelta - a.profitDelta), [data?.teams]);
  const mostWins = useMemo(() => (data?.archive.teams ?? []).slice().sort((a, b) => b.wins - a.wins || b.winRate - a.winRate), [data?.archive.teams]);
  const bouncebacks = useMemo(() => (data?.archive.teams ?? []).filter((row) => row.bouncebackOpportunities > 0).slice().sort((a, b) => b.bouncebackRate - a.bouncebackRate || b.bouncebackOpportunities - a.bouncebackOpportunities), [data?.archive.teams]);
  const profitLeaders = useMemo(() => (data?.ratings ?? []).slice().sort((a, b) => b.profit - a.profit), [data?.ratings]);
  const winRateLeaders = useMemo(() => (data?.ratings ?? []).filter((row) => row.entries > 0).slice().sort((a, b) => b.winRate - a.winRate || b.entries - a.entries), [data?.ratings]);
  const scatter = useMemo(() => {
    if (!data?.ratings.length) return [];
    const wins = data.ratings.map((row) => row.winRate); const profits = data.ratings.map((row) => row.profit); const minW = Math.min(...wins); const maxW = Math.max(...wins); const minP = Math.min(...profits); const maxP = Math.max(...profits);
    return data.ratings.map((row) => ({ ...row, x: 5 + 90 * (maxW === minW ? 0.5 : (row.winRate - minW) / (maxW - minW)), y: 94 - 88 * (maxP === minP ? 0.5 : (row.profit - minP) / (maxP - minP)) }));
  }, [data?.ratings]);

  if (loading) return <section className="page page-wide analytics-pass"><p className="muted">Building BookieBall analytics…</p></section>;
  if (!data) return <section className="page page-wide analytics-pass"><p className="muted">{error || 'No analytics available.'}</p></section>;

  const biggestMover = momentum[0] ?? null; const rivalries = data.archive.rivalries.slice(0, 4); const podium = data.bookieDor?.leaderboard.slice(0, 3) ?? []; const profitLeader = profitLeaders[0]; const winRateLeader = winRateLeaders[0];

  return <section className="page page-wide analytics-pass analytics-human-pass">
    <header className="analytics-pass-head"><div><span>BOOKIEBALL ANALYTICS</span><h1>{data.season} · {data.gw}</h1><p>Clear BookieBall records: wins, profit, form, trophies and history.</p></div><div><Link className="secondary" to="/head-to-head">Head to Head</Link><Link className="secondary" to="/reporting">Detailed Reports</Link></div></header>
    <div className="analytics-kpi-row"><article><span>Profit leader</span><strong>{profitLeader?.teamName ?? '—'}</strong><b>{signed(profitLeader?.profit ?? 0)}</b></article><article><span>Best win rate</span><strong>{winRateLeader?.teamName ?? '—'}</strong><b>{winRateLeader ? winRateLabel(winRateLeader.winRate) : '—'}</b></article><article><span>Biggest GW mover</span><strong>{biggestMover?.teamName ?? '—'}</strong><b>{biggestMover ? `${biggestMover.rankDelta > 0 ? '▲' : biggestMover.rankDelta < 0 ? '▼' : '•'}${Math.abs(biggestMover.rankDelta)}` : '—'}</b></article><article><span>Bookie d'Or</span><strong>{data.bookieDor?.holder?.teamName ?? '—'}</strong><b>{data.bookieDor?.holder?.score.toFixed(1) ?? '—'}</b></article></div>
    <div className="analytics-main-grid"><section className="panel analytics-scatter-panel"><div className="panel-header"><div><h3>Win Rate vs Profit</h3><p className="muted">Right = wins more often · higher = more season profit</p></div></div><div className="analytics-scatter analytics-scatter-human"><span className="analytics-axis-y">PROFIT</span><span className="analytics-axis-x">WIN RATE →</span>{scatter.map((row) => { const team = teamById.get(row.teamId); return <div key={row.teamId} className="analytics-dot" style={{ left: `${row.x}%`, top: `${row.y}%`, background: team?.ballColor ?? '#5eb7ff', borderColor: team?.ringColor ?? '#fff' }} title={`${row.teamName} · ${winRateLabel(row.winRate)} win rate · profit ${signed(row.profit)}`}><span>{row.teamName.split(/\s+/).map((part) => part[0]).join('').slice(0,2)}</span></div>; })}</div></section><section className="panel"><div className="panel-header"><div><h3>Bookie d'Or Podium</h3><p className="muted">Current award race</p></div></div><div className="analytics-podium">{podium.map((row, index) => <div key={row.teamId} className={`analytics-podium-place place-${index+1}`}><b>#{index+1}</b><TeamBadge name={row.teamName} ballColor={teamById.get(row.teamId)?.ballColor ?? null} ringColor={teamById.get(row.teamId)?.ringColor ?? null} textColor={teamById.get(row.teamId)?.textColor ?? null} size={index===0?42:32} /><strong>{row.teamName}</strong><span>{row.score.toFixed(1)}</span></div>)}</div></section></div>
    <div className="analytics-card-grid analytics-card-grid-human"><section className="panel"><div className="panel-header"><div><h3>Most Wins</h3><p className="muted">Division wins across BookieBall history</p></div></div>{mostWins.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={String(row.wins)} detail={`${row.played} played · ${winRateLabel(row.winRate)} win rate`} />)}</section><section className="panel"><div className="panel-header"><div><h3>Steadiest Seasons</h3><p className="muted">Smallest best-to-worst points range</p></div></div>{consistency.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={`${row.average.toFixed(1)} avg`} detail={`${row.worst}–${row.best} pts · ${row.seasons} seasons`} />)}</section><section className="panel"><div className="panel-header"><div><h3>Momentum</h3><p className="muted">Latest GW movement</p></div></div>{momentum.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={`${row.rankDelta>0?'▲':row.rankDelta<0?'▼':'•'}${Math.abs(row.rankDelta)}`} detail={`${signed(row.profitDelta)} profit`} />)}</section><section className="panel"><div className="panel-header"><div><h3>Bounceback</h3><p className="muted">Wins immediately after a defeat</p></div></div>{bouncebacks.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={`${(row.bouncebackRate*100).toFixed(0)}%`} detail={`${row.bouncebackWins}/${row.bouncebackOpportunities} chances`} />)}</section></div>
    <div className="analytics-bottom-grid analytics-bottom-grid-human"><section className="panel"><div className="panel-header"><div><h3>Era Leaders</h3><p className="muted">Most division points in each four-season block</p></div></div><div className="analytics-era-row">{eraLeaders.map((era) => <div key={era.label}><span>{era.label}</span><strong>{teamById.get(era.teamId)?.name ?? '—'}</strong><b>{era.points} pts</b></div>)}</div></section><section className="panel"><div className="panel-header"><div><h3>Biggest Rivalries</h3><p className="muted">All-time W-D-W with the previous meeting</p></div></div>{rivalries.map((row,index) => <div key={`${row.teamAId}-${row.teamBId}`} className="analytics-rivalry analytics-rivalry-human"><b>#{index+1}</b><strong>{row.teamAName} <span>vs</span> {row.teamBName}</strong><span>{row.teamAWins}–{row.draws}–{row.teamBWins}</span><em>{previousMeeting(row)}</em></div>)}</section></div>
    {data.report?.story.storylines?.length ? <section className="panel analytics-story-strip"><strong>LIVE STORYLINES</strong>{data.report.story.storylines.slice(0,4).map((story) => <span key={story.id}>{story.headline}{story.metric ? ` · ${story.metric}` : ''}</span>)}</section> : null}
  </section>;
}
