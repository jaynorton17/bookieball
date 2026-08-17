import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LeagueTabs } from '../components/CompetitionTabs';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';
import { isOfficialDivisionFixture, recentForm } from '../lib/formUtils';

type AllTimeLeagueMode = 'points' | 'spins' | 'profit';

type AllTimeLeagueRow = {
  teamId: number;
  teamName: string;
  ballColor: string | null;
  ringColor: string | null;
  textColor: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  profit: number;
  spins: number;
  rank: number;
};

type AllTimeLeaguesPayload = {
  fromSeason: string; fromGw: string; toSeason: string; toGw: string;
  pointsTable: AllTimeLeagueRow[]; spinsTable: AllTimeLeagueRow[]; profitTable: AllTimeLeagueRow[];
};

const MODE_COPY: Record<AllTimeLeagueMode, { title: string; subtitle: string }> = {
  points: { title: 'All-Time League', subtitle: 'Ranked by total division league points.' },
  spins: { title: 'All-Time Spins League', subtitle: 'Ranked by cumulative spins from division fixtures.' },
  profit: { title: 'All-Time Profit League', subtitle: 'Ranked by cumulative profit from division fixtures.' },
};

function formatProfit(value: number): string { return `${value > 0 ? '+' : ''}${value.toFixed(2)}`; }
function modeValue(mode: AllTimeLeagueMode, row: AllTimeLeagueRow): string {
  if (mode === 'profit') return formatProfit(row.profit);
  if (mode === 'spins') return `${row.spins} spins`;
  return `${row.points} pts`;
}

type AllTimeLeaguesPageProps = { mode: AllTimeLeagueMode };

function ArchiveGraphic({ mode, rows }: { mode: AllTimeLeagueMode; rows: AllTimeLeagueRow[] }) {
  const top = rows.slice(0, 5);
  if (!top.length) return null;
  if (mode === 'profit') {
    const max = Math.max(1, ...top.map((row) => Math.abs(row.profit)));
    return <section className="alltime-profit-graphic panel"><div className="panel-header"><div><h3>Top Profit Makers</h3><p className="muted">Career division profit</p></div></div><div className="alltime-profit-bars">{top.map((row) => <div key={row.teamId}><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={24} /><strong>{row.teamName}</strong><div><i style={{ width: `${Math.max(8, Math.abs(row.profit) / max * 100)}%` }} /></div><b>{formatProfit(row.profit)}</b></div>)}</div></section>;
  }
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  return <section className={`alltime-podium panel is-${mode}`}><div className="alltime-podium-stage">{podium.map((row) => <article key={row.teamId} className={`place-${row.rank}`}><span>#{row.rank}</span><div className={mode === 'spins' ? 'alltime-spin-orb' : ''}><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={row.rank === 1 ? 52 : 42} /></div><strong>{row.teamName}</strong><b>{modeValue(mode, row)}</b><small>{row.wins} wins · {row.played} played</small></article>)}</div></section>;
}

export function AllTimeLeaguesPage({ mode }: AllTimeLeaguesPageProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [payload, setPayload] = useState<AllTimeLeaguesPayload | null>(null);
  const [currentSeason, setCurrentSeason] = useState<string | null>(null);
  const [leagueFixtures, setLeagueFixtures] = useState<Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; result: 'home' | 'away' | 'draw' | 'pending' }>>([]);

  const reload = async () => {
    setLoading(true);
    try {
      const nextState = await api.state();
      const [next, nextFixtures] = await Promise.all([api.allTimeLeagues(), api.leagueFixtures(undefined, true, nextState.currentSeason)]);
      setPayload(next); setCurrentSeason(nextState.currentSeason); setLeagueFixtures(nextFixtures); setMessage('');
    } catch (error) {
      setPayload(null); setCurrentSeason(null); setLeagueFixtures([]);
      setMessage(error instanceof Error ? `All-Time leagues API unavailable: ${error.message}` : 'All-Time leagues API unavailable. Restart the backend and try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const activeRows = useMemo(() => {
    if (!payload) return [];
    if (mode === 'spins') return payload.spinsTable;
    if (mode === 'profit') return payload.profitTable;
    return payload.pointsTable;
  }, [mode, payload]);

  const formForTeam = (teamName: string) => recentForm({
    fixtures: leagueFixtures,
    include: (fixture) => fixture.result !== 'pending' && isOfficialDivisionFixture(fixture.division, fixture.gw) && (fixture.homeTeam === teamName || fixture.awayTeam === teamName),
    resultOf: (fixture) => fixture.result === 'draw' ? 'D' : ((fixture.result === 'home' && fixture.homeTeam === teamName) || (fixture.result === 'away' && fixture.awayTeam === teamName)) ? 'W' : 'L',
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  return (
    <section className="page page-wide alltime-page">
      <div className="alltime-page-head"><div><h1>{MODE_COPY[mode].title}</h1><p className="muted">{payload ? `${payload.fromSeason} ${payload.fromGw} → ${payload.toSeason} ${payload.toGw}` : 'Loading all-time standings...'}</p></div></div>
      <LeagueTabs activeId="all-time" />
      <div className="tab-row"><Link to="/all-time-league" className={`tab-button ${mode === 'points' ? 'active' : ''}`}>Points</Link><Link to="/all-time-spins-league" className={`tab-button ${mode === 'spins' ? 'active' : ''}`}>Spins</Link><Link to="/all-time-profit-league" className={`tab-button ${mode === 'profit' ? 'active' : ''}`}>Profit</Link></div>

      {!loading && activeRows.length ? <ArchiveGraphic mode={mode} rows={activeRows} /> : null}

      <div className="panel"><div className="panel-header"><div><h3>Full Archive Table</h3><p className="muted">{MODE_COPY[mode].subtitle}</p></div><button type="button" className="secondary" onClick={() => void reload()} disabled={loading}>Reload</button></div>{currentSeason && <p className="muted">Form uses {currentSeason} official division fixtures.</p>}{message && <p className="muted">{message}</p>}{loading ? <p className="muted">Loading table...</p> : activeRows.length === 0 ? <p className="muted">No all-time rows yet.</p> : <div className="table-scroll"><table className="scoreboard-table master-league-table"><thead><tr><th>#</th><th>Team</th><th>PLD</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>Spins</th><th>Profit</th><th>Form</th></tr></thead><tbody>{activeRows.map((row) => <tr key={`all-time-${mode}-${row.teamId}`}><td>{row.rank}</td><td><span className="master-team-cell"><TeamBadge name={row.teamName} ballColor={row.ballColor} ringColor={row.ringColor} textColor={row.textColor} size={18} /><span>{row.teamName}</span></span></td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.draws}</td><td>{row.points}</td><td>{row.spins}</td><td>{formatProfit(row.profit)}</td><td><div className="form-mini-row">{formForTeam(row.teamName).map((result, index) => <span key={`all-time-form-${mode}-${row.teamId}-${index}-${result}`} className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}>{result}</span>)}</div></td></tr>)}</tbody></table></div>}</div>
    </section>
  );
}
