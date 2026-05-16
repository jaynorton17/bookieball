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
  const [currentSeason, setCurrentSeason] = useState<string | null>(null);
  const [leagueFixtures, setLeagueFixtures] = useState<
    Array<{ id: number; gw: string; division: string; homeTeam: string; awayTeam: string; result: 'home' | 'away' | 'draw' | 'pending' }>
  >([]);

  const reload = async () => {
    setLoading(true);
    try {
      const nextState = await api.state();
      const [next, nextFixtures] = await Promise.all([
        api.allTimeLeagues(),
        api.leagueFixtures(undefined, true, nextState.currentSeason),
      ]);
      setPayload(next);
      setCurrentSeason(nextState.currentSeason);
      setLeagueFixtures(nextFixtures);
      setMessage('');
    } catch (error) {
      setPayload(null);
      setCurrentSeason(null);
      setLeagueFixtures([]);
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

  const formForTeam = (teamName: string) => recentForm({
    fixtures: leagueFixtures,
    include: (fixture) =>
      fixture.result !== 'pending'
      && isOfficialDivisionFixture(fixture.division, fixture.gw)
      && (fixture.homeTeam === teamName || fixture.awayTeam === teamName),
    resultOf: (fixture) => {
      if (fixture.result === 'draw') {
        return 'D';
      }
      const win = (fixture.result === 'home' && fixture.homeTeam === teamName) || (fixture.result === 'away' && fixture.awayTeam === teamName);
      return win ? 'W' : 'L';
    },
    getGw: (fixture) => fixture.gw,
    getSecondarySort: (fixture) => fixture.id,
  });

  return (
    <section className="page page-wide">
      <h1>{MODE_COPY[mode].title}</h1>
      <p className="muted">
        {payload
          ? `Division fixtures only, from ${payload.fromSeason} ${payload.fromGw} to ${payload.toSeason} ${payload.toGw}.`
          : 'Loading all-time standings...'}
      </p>

      <LeagueTabs activeId="all-time" />

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
        {currentSeason && <p className="muted">Form bubbles use {currentSeason} official division fixtures only.</p>}
        {message && <p className="muted">{message}</p>}
        {loading ? (
          <p className="muted">Loading table...</p>
        ) : activeRows.length === 0 ? (
          <p className="muted">No all-time rows yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="scoreboard-table master-league-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>PLD</th>
                  <th>W</th>
                  <th>L</th>
                  <th>D</th>
                  <th>Pts</th>
                  <th>Spins</th>
                  <th>Profit</th>
                  <th>Form (Last 5)</th>
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
                    <td>{row.losses}</td>
                    <td>{row.draws}</td>
                    <td>{row.points}</td>
                    <td>{row.spins}</td>
                    <td>{formatProfit(row.profit)}</td>
                    <td>
                      <div className="form-mini-row">
                        {formForTeam(row.teamName).map((result, index) => (
                          <span
                            key={`all-time-form-${mode}-${row.teamId}-${index}-${result}`}
                            className={`form-badge ${result === 'W' ? 'form-win' : result === 'D' ? 'form-draw' : 'form-loss'}`}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
