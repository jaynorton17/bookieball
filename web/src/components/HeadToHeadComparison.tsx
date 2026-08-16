import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Team = {
  id: number;
  name: string;
  ballColor?: string | null;
  ringColor?: string | null;
  textColor?: string | null;
};

type HeadToHeadComparisonProps = {
  teams: Team[];
};

type H2HData = Awaited<ReturnType<typeof api.headToHeadAllTime>>;

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

export function HeadToHeadComparison({ teams }: HeadToHeadComparisonProps) {
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchH2H = useCallback(async () => {
    if (!teamAId || !teamBId) {
      setH2hData(null);
      return;
    }
    if (teamAId === teamBId) {
      setH2hData(null);
      setError('Please select two different teams');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setH2hData(await api.headToHeadAllTime(Number(teamAId), Number(teamBId)));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch all-time head-to-head comparison');
      setH2hData(null);
    } finally {
      setLoading(false);
    }
  }, [teamAId, teamBId]);

  useEffect(() => {
    void fetchH2H();
  }, [fetchH2H]);

  const teamAInfo = teams.find((team) => team.id === Number(teamAId));
  const teamBInfo = teams.find((team) => team.id === Number(teamBId));

  const percentages = useMemo(() => {
    if (!h2hData || h2hData.played === 0) return { a: 0, d: 0, b: 0 };
    return {
      a: (h2hData.teamAWins / h2hData.played) * 100,
      d: (h2hData.draws / h2hData.played) * 100,
      b: (h2hData.teamBWins / h2hData.played) * 100,
    };
  }, [h2hData]);

  return (
    <div className="h2h-comparison-widget">
      <div className="h2h-selectors">
        <div className="inline-field">
          <span className="muted">Team A:</span>
          <select value={teamAId} onChange={(event) => setTeamAId(event.target.value)}>
            <option value="">Select Team A</option>
            {teams.map((team) => (
              <option key={`a-${team.id}`} value={team.id} disabled={team.id === Number(teamBId)}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h2h-vs-badge font-bold">VS</div>

        <div className="inline-field">
          <span className="muted">Team B:</span>
          <select value={teamBId} onChange={(event) => setTeamBId(event.target.value)}>
            <option value="">Select Team B</option>
            {teams.map((team) => (
              <option key={`b-${team.id}`} value={team.id} disabled={team.id === Number(teamAId)}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>All-time comparison from season 1 onwards.</p>
      {error && <p className="h2h-error">{error}</p>}
      {loading && <p className="h2h-loading">Crunching the full archive...</p>}
      {!loading && !h2hData && !error && <p className="h2h-placeholder">Select two teams to compare their complete history.</p>}

      {!loading && h2hData && teamAInfo && teamBInfo && (
        <div className="h2h-results-panel">
          <div className="h2h-summary-cards">
            <div className="h2h-team-card text-left" style={{ borderColor: teamAInfo.ringColor ?? 'transparent' }}>
              <h3>{teamAInfo.name}</h3>
              <div className="h2h-stat-big">{h2hData.teamAWins}</div>
              <div className="muted small">All-time wins</div>
              <div className="muted small">Career profit vs them: {signed(h2hData.teamAProfit)}</div>
            </div>

            <div className="h2h-middle-stats">
              <div className="h2h-stat-label">All-Time Meetings</div>
              <div className="h2h-matches-count">{h2hData.played}</div>
              <div className="h2h-draws-count"><strong>{h2hData.draws}</strong> draws</div>
            </div>

            <div className="h2h-team-card text-right" style={{ borderColor: teamBInfo.ringColor ?? 'transparent' }}>
              <h3>{teamBInfo.name}</h3>
              <div className="h2h-stat-big">{h2hData.teamBWins}</div>
              <div className="muted small">All-time wins</div>
              <div className="muted small">Career profit vs them: {signed(h2hData.teamBProfit)}</div>
            </div>
          </div>

          <div className="h2h-win-bar-container">
            <div className="h2h-win-bar-labels">
              <span>{percentages.a.toFixed(0)}% {teamAInfo.name}</span>
              <span>{percentages.d.toFixed(0)}% draws</span>
              <span>{percentages.b.toFixed(0)}% {teamBInfo.name}</span>
            </div>
            <div className="h2h-win-bar">
              <div className="h2h-win-segment team-a" style={{ width: `${percentages.a}%`, backgroundColor: teamAInfo.ballColor ?? 'var(--accent)' }} />
              <div className="h2h-win-segment draws" style={{ width: `${percentages.d}%`, backgroundColor: '#6b7280' }} />
              <div className="h2h-win-segment team-b" style={{ width: `${percentages.b}%`, backgroundColor: teamBInfo.ballColor ?? 'var(--accent2)' }} />
            </div>
          </div>

          <div className="h2h-facts">
            {h2hData.firstMeeting && (
              <div className="h2h-fact">
                <span className="h2h-fact-label">First meeting</span>
                <span className="h2h-fact-value">{h2hData.firstMeeting.season} · {h2hData.firstMeeting.gw}</span>
              </div>
            )}
            {h2hData.lastMeeting && (
              <div className="h2h-fact">
                <span className="h2h-fact-label">Most recent meeting</span>
                <span className="h2h-fact-value">{h2hData.lastMeeting.season} · {h2hData.lastMeeting.gw}</span>
              </div>
            )}
            <div className="h2h-fact">
              <span className="h2h-fact-label">Longest winning streak</span>
              <span className="h2h-fact-value">
                {h2hData.longestStreak.count > 0
                  ? `${h2hData.longestStreak.side === 'A' ? teamAInfo.name : teamBInfo.name} · ${h2hData.longestStreak.count}`
                  : '—'}
              </span>
            </div>
          </div>

          <div className="h2h-history-list">
            <h4>Full archive ({h2hData.meetings.length})</h4>
            <div className="table-scroll" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>GW</th>
                    <th>Division</th>
                    <th>Home</th>
                    <th className="text-center">Profit</th>
                    <th>Away</th>
                  </tr>
                </thead>
                <tbody>
                  {h2hData.meetings.map((meeting, index) => (
                    <tr key={`${meeting.season}-${meeting.gw}-${index}`}>
                      <td className="font-bold">{meeting.season}</td>
                      <td>{meeting.gw}</td>
                      <td>{meeting.division}</td>
                      <td>{meeting.homeTeam}</td>
                      <td className="text-center font-mono">{signed(meeting.homeProfit)} · {signed(meeting.awayProfit)}</td>
                      <td>{meeting.awayTeam}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
