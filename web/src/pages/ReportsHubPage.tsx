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

function signed(value: number, digits = 2): string { return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`; }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}
function seasonNumber(value: string): number { return Number(value.replace('S', '')) || 0; }

function TeamLine({ team, value, detail }: { team: Team | undefined; value: string; detail?: string }) {
  if (!team) return null;
  return <div className="analytics-team-line"><TeamBadge name={team.name} ballColor={team.ballColor} ringColor={team.ringColor} textColor={team.textColor} size={22} /><div><strong>{team.name}</strong>{detail && <span>{detail}</span>}</div><b>{value}</b></div>;
}

export function ReportsHubPage() {
  const [data, setData] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const state = await api.state();
        const [teams, ratings, archive, report, bookieDor] = await Promise.all([
          api.teams(), api.teamRatings(), loadAllTimeAnalytics(), api.reportPack(state.currentGw).catch(() => null), api.bookieDor(state.currentSeason, state.currentGw).catch(() => null),
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

  const teamById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data?.teams]);
  const ratingById = useMemo(() => new Map((data?.ratings ?? []).map((row) => [row.teamId, row])), [data?.ratings]);

  const consistency = useMemo(() => {
    if (!data) return [];
    return data.teams.map((team) => {
      const rows = data.histories[team.id] ?? [];
      const points = rows.map((row) => row.points);
      const avg = mean(points);
      const variation = avg > 0 ? stddev(points) / avg : 1;
      const score = 100 * (1 - clamp01(variation));
      return { teamId: team.id, score, seasons: rows.length };
    }).sort((a, b) => b.score - a.score);
  }, [data]);

  const eraLeaders = useMemo(() => {
    if (!data) return [];
    const maxSeason = Math.max(...Object.values(data.histories).flat().map((row) => seasonNumber(row.season)), seasonNumber(data.season));
    const eras: Array<{ from: number; to: number }> = [];
    for (let from = 1; from <= maxSeason; from += 4) eras.push({ from, to: Math.min(maxSeason, from + 3) });
    return eras.map((era) => {
      const totals = data.teams.map((team) => ({
        teamId: team.id,
        points: (data.histories[team.id] ?? []).filter((row) => { const season = seasonNumber(row.season); return season >= era.from && season <= era.to; }).reduce((sum, row) => sum + row.points, 0),
      })).sort((a, b) => b.points - a.points);
      return { label: `S${era.from}–S${era.to}`, ...totals[0] };
    }).filter((row) => row.teamId && row.points > 0);
  }, [data]);

  const momentum = useMemo(() => (data?.teams ?? []).map((team) => ({
    teamId: team.id,
    rankDelta: team.trendCache?.rankDelta ?? 0,
    profitDelta: team.trendCache?.profitDelta ?? 0,
  })).sort((a, b) => b.rankDelta - a.rankDelta || b.profitDelta - a.profitDelta), [data]);

  const clutch = useMemo(() => {
    const rows = data?.bookieDor?.leaderboard ?? [];
    return rows.map((row) => ({ teamId: row.teamId, score: row.weightedCupScore + row.weightedMasterScore, cup: row.cupFinish })).sort((a, b) => b.score - a.score);
  }, [data?.bookieDor]);

  const scatter = useMemo(() => {
    if (!data?.ratings.length) return [];
    const ratings = data.ratings.map((row) => row.rating);
    const profits = data.ratings.map((row) => row.profit);
    const minR = Math.min(...ratings); const maxR = Math.max(...ratings); const minP = Math.min(...profits); const maxP = Math.max(...profits);
    return data.ratings.map((row) => ({
      ...row,
      x: 5 + 90 * (maxR === minR ? 0.5 : (row.rating - minR) / (maxR - minR)),
      y: 94 - 88 * (maxP === minP ? 0.5 : (row.profit - minP) / (maxP - minP)),
    }));
  }, [data?.ratings]);

  if (loading) return <section className="page page-wide analytics-pass"><p className="muted">Building BookieBall analytics…</p></section>;
  if (!data) return <section className="page page-wide analytics-pass"><p className="muted">{error || 'No analytics available.'}</p></section>;

  const topDominance = data.archive.teams[0];
  const giantKillers = data.archive.teams.slice().sort((a, b) => b.giantKillerWins - a.giantKillerWins).slice(0, 5);
  const rivalries = data.archive.rivalries.slice(0, 5);
  const podium = data.bookieDor?.leaderboard.slice(0, 3) ?? [];

  return (
    <section className="page page-wide analytics-pass">
      <header className="analytics-pass-head">
        <div><span>BOOKIEBALL ANALYTICS</span><h1>{data.season} · {data.gw}</h1><p>Power, profit, history, rivalries and form — analysis only. Admin controls remain under Tools.</p></div>
        <div><Link className="secondary" to="/head-to-head">Head to Head</Link><Link className="secondary" to="/reporting">Detailed Reports</Link></div>
      </header>

      <div className="analytics-kpi-row">
        <article><span>Dominance leader</span><strong>{topDominance?.teamName ?? '—'}</strong><b>{topDominance?.dominanceIndex.toFixed(1) ?? '—'}</b></article>
        <article><span>Power leader</span><strong>{data.ratings[0]?.teamName ?? '—'}</strong><b>{[...data.ratings].sort((a,b)=>b.rating-a.rating)[0]?.rating.toFixed(3) ?? '—'}</b></article>
        <article><span>Profit leader</span><strong>{[...data.ratings].sort((a,b)=>b.profit-a.profit)[0]?.teamName ?? '—'}</strong><b>{signed([...data.ratings].sort((a,b)=>b.profit-a.profit)[0]?.profit ?? 0)}</b></article>
        <article><span>Bookie d'Or</span><strong>{data.bookieDor?.holder?.teamName ?? '—'}</strong><b>{data.bookieDor?.holder?.score.toFixed(1) ?? '—'}</b></article>
      </div>

      <div className="analytics-main-grid">
        <section className="panel analytics-scatter-panel">
          <div className="panel-header"><div><h3>Power vs Profit</h3><p className="muted">Right = stronger rating · higher = more season profit</p></div></div>
          <div className="analytics-scatter">
            <span className="analytics-axis-y">PROFIT</span><span className="analytics-axis-x">POWER →</span>
            {scatter.map((row) => {
              const team = teamById.get(row.teamId);
              return <div key={row.teamId} className="analytics-dot" style={{ left: `${row.x}%`, top: `${row.y}%`, background: team?.ballColor ?? '#5eb7ff', borderColor: team?.ringColor ?? '#fff' }} title={`${row.teamName} · rating ${row.rating.toFixed(3)} · profit ${signed(row.profit)}`}><span>{row.teamName.split(/\s+/).map((part) => part[0]).join('').slice(0,2)}</span></div>;
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><h3>Bookie d'Or Podium</h3><p className="muted">League + cups + Master + consistency</p></div></div>
          <div className="analytics-podium">{podium.map((row, index) => <div key={row.teamId} className={`analytics-podium-place place-${index+1}`}><b>#{index+1}</b><TeamBadge name={row.teamName} ballColor={teamById.get(row.teamId)?.ballColor ?? null} ringColor={teamById.get(row.teamId)?.ringColor ?? null} textColor={teamById.get(row.teamId)?.textColor ?? null} size={index===0?42:32} /><strong>{row.teamName}</strong><span>{row.score.toFixed(1)}</span></div>)}</div>
        </section>
      </div>

      <div className="analytics-card-grid">
        <section className="panel"><div className="panel-header"><div><h3>Consistency Index</h3><p className="muted">Stable points output across seasons</p></div></div>{consistency.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={row.score.toFixed(0)} detail={`${row.seasons} seasons`} />)}</section>
        <section className="panel"><div className="panel-header"><div><h3>Giant Killers</h3><p className="muted">Wins while entering 75+ Elo below opponent</p></div></div>{giantKillers.map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={String(row.giantKillerWins)} detail={`${row.wins} total wins`} />)}</section>
        <section className="panel"><div className="panel-header"><div><h3>Momentum</h3><p className="muted">Recent rank and profit movement</p></div></div>{momentum.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={`${row.rankDelta>0?'▲':''}${row.rankDelta}`} detail={`${signed(row.profitDelta)} profit`} />)}</section>
        <section className="panel"><div className="panel-header"><div><h3>Clutch Rating</h3><p className="muted">Current cup + Master contribution</p></div></div>{clutch.slice(0,5).map((row) => <TeamLine key={row.teamId} team={teamById.get(row.teamId)} value={row.score.toFixed(1)} detail={row.cup} />)}</section>
      </div>

      <div className="analytics-bottom-grid">
        <section className="panel"><div className="panel-header"><div><h3>Era Leaders</h3><p className="muted">Four-season blocks</p></div></div><div className="analytics-era-row">{eraLeaders.map((era) => <div key={era.label}><span>{era.label}</span><strong>{teamById.get(era.teamId)?.name ?? '—'}</strong><b>{era.points} pts</b></div>)}</div></section>
        <section className="panel"><div className="panel-header"><div><h3>Biggest Rivalries</h3><p className="muted">Meetings × closeness</p></div></div>{rivalries.map((row,index) => <div key={`${row.teamAId}-${row.teamBId}`} className="analytics-rivalry"><b>#{index+1}</b><strong>{row.teamAName} <span>vs</span> {row.teamBName}</strong><span>{row.teamAWins}–{row.draws}–{row.teamBWins}</span><em>{row.meetings} meetings</em></div>)}</section>
      </div>

      {data.report?.story.storylines?.length ? <section className="panel analytics-story-strip"><strong>LIVE STORYLINES</strong>{data.report.story.storylines.slice(0,4).map((story) => <span key={story.id}>{story.headline}{story.metric ? ` · ${story.metric}` : ''}</span>)}</section> : null}
    </section>
  );
}