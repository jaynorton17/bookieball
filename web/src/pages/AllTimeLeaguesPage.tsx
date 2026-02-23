import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamBadge } from '../components/TeamBadge';
import { api } from '../lib/api';

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
  fromSeason: string;
  fromGw: string;
  toSeason: string;
  toGw: string;
  pointsTable: AllTimeLeagueRow[];
  spinsTable: AllTimeLeagueRow[];
  profitTable: AllTimeLeagueRow[];
};

const MODE_COPY: Record<AllTimeLeagueMode, { title: string; subtitle: string }> = {
  points: {
    title: 'All-Time League',
    subtitle: 'Ranked by total division league points.',
  },
  spins: {
    title: 'All-Time Spins League',
    subtitle: 'Ranked by cumulative spins from division fixtures.',
  },
  profit: {
    title: 'All-Time Profit League',
    subtitle: 'Ranked by cumulative profit from division fixtures.',
  },
};

function formatProfit(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

type AllTimeLeaguesPageProps = {
  mode: AllTimeLeagueMode;
};

export function AllTimeLeaguesPage({ mode }: AllTimeLeaguesPageProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [payload, setPayload] = useState<AllTimeLeaguesPayload | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const next = await api.allTimeLeagues();
      setPayload(next);
      setMessage('');
    } catch (error) {
      setPayload(null);
      setMessage(
        error instanceof Error
          ? `All-Time leagues API unavailable: ${error.message}`
          : 'All-Time leagues API unavailable. Restart the backend and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const activeRows = useMemo(() => {
    if (!payload) {
      return [];
    }
    if (mode === 'spins') {
      return payload.spinsTable;
    }
    if (mode === 'profit') {
      return payload.profitTable;
    }
    return payload.pointsTable;
  }, [mode, payload]);

  return (
    <section className="page">
      <h1>{MODE_COPY[mode].title}</h1>
      <p className="muted">
        {payload
          ? `Division fixtures only, from ${payload.fromSeason} ${payload.fromGw} to ${payload.toSeason} ${payload.toGw}.`
          : 'Loading all-time standings...'}
      </p>

      <div className="tab-row">
        <Link to="/all-time-league" className={`tab-button ${mode === 'points' ? 'active' : ''}`}>
          All-Time League
        </Link>
        <Link to="/all-time-spins-league" className={`tab-button ${mode === 'spins' ? 'active' : ''}`}>
          All-Time Spins League
        </Link>
        <Link to="/all-time-profit-league" className={`tab-button ${mode === 'profit' ? 'active' : ''}`}>
          All-Time Profit League
        </Link>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>{MODE_COPY[mode].title} Table</h3>
          <button type="button" className="secondary" onClick={() => void reload()} disabled={loading}>
            Reload
          </button>
        </div>
        <p className="muted">{MODE_COPY[mode].subtitle}</p>
        {message && <p className="muted">{message}</p>}
        {loading ? (
          <p className="muted">Loading table...</p>
        ) : activeRows.length === 0 ? (
          <p className="muted">No all-time rows yet.</p>
        ) : (
          <table className="scoreboard-table master-league-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>Pts</th>
                <th>Prof</th>
                <th>Spins</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => (
                <tr key={`all-time-${mode}-${row.teamId}`}>
                  <td>{row.rank}</td>
                  <td>
                    <span className="master-team-cell">
                      <TeamBadge
                        name={row.teamName}
                        ballColor={row.ballColor}
                        ringColor={row.ringColor}
                        textColor={row.textColor}
                        size={18}
                      />
                      <span>{row.teamName}</span>
                    </span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.draws}</td>
                  <td>{row.losses}</td>
                  <td>{row.points}</td>
                  <td>{formatProfit(row.profit)}</td>
                  <td>{row.spins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
