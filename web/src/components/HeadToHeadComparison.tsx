import { useState, useEffect, useCallback } from 'react';
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

type H2HData = {
  teamA: { id: number; name: string };
  teamB: { id: number; name: string };
  played: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  meetings: Array<{
    gw: string;
    homeTeam: string;
    awayTeam: string;
    homeProfit: number;
    awayProfit: number;
    result: 'home' | 'away' | 'draw' | 'pending';
  }>;
};

export function HeadToHeadComparison({ teams }: HeadToHeadComparisonProps) {
  const [teamAId, setTeamAId] = useState<string>('');
  const [teamBId, setTeamBId] = useState<string>('');
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchH2H = useCallback(async () => {
    if (!teamAId || !teamBId) return;
    if (teamAId === teamBId) {
      setH2hData(null);
      setError('Please select two different teams');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.headToHead(Number(teamAId), Number(teamBId));
      setH2hData(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch head-to-head comparison');
      setH2hData(null);
    } finally {
      setLoading(false);
    }
  }, [teamAId, teamBId]);

  useEffect(() => {
    void fetchH2H();
  }, [teamAId, teamBId, fetchH2H]);

  const teamAInfo = teams.find((t) => t.id === Number(teamAId));
  const teamBInfo = teams.find((t) => t.id === Number(teamBId));

  const totalWins = h2hData ? h2hData.teamAWins + h2hData.teamBWins + h2hData.draws : 0;
  const teamAPercent = h2hData && totalWins > 0 ? (h2hData.teamAWins / totalWins) * 100 : 0;
  const teamBPercent = h2hData && totalWins > 0 ? (h2hData.teamBWins / totalWins) * 100 : 0;
  const drawsPercent = h2hData && totalWins > 0 ? (h2hData.draws / totalWins) * 100 : 0;

  // Calculate average profit for both teams in their meetings
  const avgProfitA = h2hData && h2hData.meetings.length > 0
    ? h2hData.meetings.reduce((sum, m) => {
        const isHome = m.homeTeam === h2hData.teamA.name;
        return sum + (isHome ? m.homeProfit : m.awayProfit);
      }, 0) / h2hData.meetings.length
    : 0;

  const avgProfitB = h2hData && h2hData.meetings.length > 0
    ? h2hData.meetings.reduce((sum, m) => {
        const isHome = m.homeTeam === h2hData.teamB.name;
        return sum + (isHome ? m.homeProfit : m.awayProfit);
      }, 0) / h2hData.meetings.length
    : 0;

  return (
    <div className="h2h-comparison-widget">
      <div className="h2h-selectors">
        <div className="inline-field">
          <span className="muted">Team A:</span>
          <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)}>
            <option value="">Select Team A</option>
            {teams.map((t) => (
              <option key={`a-${t.id}`} value={t.id} disabled={t.id === Number(teamBId)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h2h-vs-badge font-bold">VS</div>

        <div className="inline-field">
          <span className="muted">Team B:</span>
          <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)}>
            <option value="">Select Team B</option>
            {teams.map((t) => (
              <option key={`b-${t.id}`} value={t.id} disabled={t.id === Number(teamAId)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="h2h-error">{error}</p>}
      {loading && <p className="h2h-loading">Comparing teams...</p>}

      {!loading && !h2hData && !error && (
        <p className="h2h-placeholder">Select two teams to compare their head-to-head history.</p>
      )}

      {!loading && h2hData && teamAInfo && teamBInfo && (
        <div className="h2h-results-panel">
          <div className="h2h-summary-cards">
            {/* Team A Card */}
            <div
              className="h2h-team-card text-left"
              style={{
                borderColor: teamAInfo.ringColor ?? 'transparent',
                background: `linear-gradient(135deg, rgba(10, 27, 42, 0.8) 0%, ${teamAInfo.ballColor ? teamAInfo.ballColor + '15' : 'rgba(10, 27, 42, 0.8)'} 100%)`,
              }}
            >
              <span
                className="h2h-team-initial"
                style={{
                  backgroundColor: teamAInfo.ballColor ?? 'var(--panel)',
                  borderColor: teamAInfo.ringColor ?? 'white',
                  color: teamAInfo.textColor ?? 'white',
                }}
              >
                {(teamAInfo.name.charAt(0) || '?').toUpperCase()}
              </span>
              <h3>{teamAInfo.name}</h3>
              <div className="h2h-stat-big">{h2hData.teamAWins}</div>
              <div className="muted small">Wins</div>
            </div>

            {/* General Stats summary */}
            <div className="h2h-middle-stats">
              <div className="h2h-stat-label">Total Matches</div>
              <div className="h2h-matches-count">{h2hData.played}</div>
              <div className="h2h-draws-count">
                <strong>{h2hData.draws}</strong> Draws
              </div>
            </div>

            {/* Team B Card */}
            <div
              className="h2h-team-card text-right"
              style={{
                borderColor: teamBInfo.ringColor ?? 'transparent',
                background: `linear-gradient(135deg, rgba(10, 27, 42, 0.8) 0%, ${teamBInfo.ballColor ? teamBInfo.ballColor + '15' : 'rgba(10, 27, 42, 0.8)'} 100%)`,
              }}
            >
              <span
                className="h2h-team-initial"
                style={{
                  backgroundColor: teamBInfo.ballColor ?? 'var(--panel)',
                  borderColor: teamBInfo.ringColor ?? 'white',
                  color: teamBInfo.textColor ?? 'white',
                }}
              >
                {(teamBInfo.name.charAt(0) || '?').toUpperCase()}
              </span>
              <h3>{teamBInfo.name}</h3>
              <div className="h2h-stat-big">{h2hData.teamBWins}</div>
              <div className="muted small">Wins</div>
            </div>
          </div>

          {/* Win percentage meter */}
          <div className="h2h-win-bar-container">
            <div className="h2h-win-bar-labels">
              <span>{teamAPercent.toFixed(0)}% Wins</span>
              <span>{drawsPercent.toFixed(0)}% Draws</span>
              <span>{teamBPercent.toFixed(0)}% Wins</span>
            </div>
            <div className="h2h-win-bar">
              <div
                className="h2h-win-segment team-a"
                style={{
                  width: `${teamAPercent}%`,
                  backgroundColor: teamAInfo.ballColor ?? 'var(--accent)',
                }}
              />
              <div
                className="h2h-win-segment draws"
                style={{
                  width: `${drawsPercent}%`,
                  backgroundColor: '#6b7280',
                }}
              />
              <div
                className="h2h-win-segment team-b"
                style={{
                  width: `${teamBPercent}%`,
                  backgroundColor: teamBInfo.ballColor ?? 'var(--accent2)',
                }}
              />
            </div>
          </div>

          {/* Average Profit Comparison */}
          <div className="h2h-profit-comparison">
            <h4>Average Profit per Meeting</h4>
            <div className="h2h-profit-row">
              <div className="h2h-profit-bar-left">
                <span className="profit-value">{avgProfitA >= 0 ? `+${avgProfitA.toFixed(2)}` : avgProfitA.toFixed(2)}</span>
                <div
                  className="profit-fill"
                  style={{
                    width: `${Math.min(100, Math.max(10, Math.abs(avgProfitA) * 10))}%`,
                    backgroundColor: avgProfitA >= 0 ? 'var(--accent2)' : 'var(--danger)',
                  }}
                />
              </div>
              <div className="h2h-profit-vs">vs</div>
              <div className="h2h-profit-bar-right">
                <div
                  className="profit-fill"
                  style={{
                    width: `${Math.min(100, Math.max(10, Math.abs(avgProfitB) * 10))}%`,
                    backgroundColor: avgProfitB >= 0 ? 'var(--accent2)' : 'var(--danger)',
                  }}
                />
                <span className="profit-value">{avgProfitB >= 0 ? `+${avgProfitB.toFixed(2)}` : avgProfitB.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Meeting history list */}
          <div className="h2h-history-list">
            <h4>Encounters ({h2hData.meetings.length})</h4>
            <div className="table-scroll" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>GW</th>
                    <th>Home Team</th>
                    <th className="text-center">Score (Profit)</th>
                    <th>Away Team</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {h2hData.meetings.map((meeting, i) => {
                    const isWinA = meeting.result === 'home' && meeting.homeTeam === h2hData.teamA.name || 
                                   meeting.result === 'away' && meeting.awayTeam === h2hData.teamA.name;
                    const isWinB = meeting.result === 'home' && meeting.homeTeam === h2hData.teamB.name || 
                                   meeting.result === 'away' && meeting.awayTeam === h2hData.teamB.name;
                    let outcomeLabel = 'Draw';
                    let outcomeClass = 'h2h-draw-tag';
                    if (isWinA) {
                      outcomeLabel = `${h2hData.teamA.name} Win`;
                      outcomeClass = 'h2h-win-a-tag';
                    } else if (isWinB) {
                      outcomeLabel = `${h2hData.teamB.name} Win`;
                      outcomeClass = 'h2h-win-b-tag';
                    }

                    return (
                      <tr key={i}>
                        <td className="font-bold">{meeting.gw}</td>
                        <td>
                          <span className={meeting.homeTeam === h2hData.teamA.name ? 'font-bold' : ''}>
                            {meeting.homeTeam}
                          </span>
                        </td>
                        <td className="text-center font-mono">
                          {meeting.homeProfit.toFixed(2)} - {meeting.awayProfit.toFixed(2)}
                        </td>
                        <td>
                          <span className={meeting.awayTeam === h2hData.teamA.name ? 'font-bold' : ''}>
                            {meeting.awayTeam}
                          </span>
                        </td>
                        <td>
                          <span className={`h2h-tag ${outcomeClass}`}>{outcomeLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
