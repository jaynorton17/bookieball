import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { displayDivisionName } from '../lib/divisionLabels';

type CurrentState = {
  currentSeason: string;
  currentGw: string;
};

type TeamOption = {
  id: number;
  name: string;
};

type SnapshotPayloadResponse = Awaited<ReturnType<typeof api.snapshotPayload>>;
type ReportPackResponse = Awaited<ReturnType<typeof api.reportPack>>;

function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeSnapshotTable(payload: SnapshotPayloadResponse | null): Record<string, Array<{ teamName: string; points: number; rank: number }>> {
  if (!payload || typeof payload.payload?.table !== 'object' || payload.payload?.table === null) {
    return {};
  }
  const record = payload.payload.table as Record<string, unknown>;
  const out: Record<string, Array<{ teamName: string; points: number; rank: number }>> = {};
  Object.entries(record).forEach(([division, value]) => {
    if (!Array.isArray(value)) {
      return;
    }
    const rows = value
      .map((row) => {
        const rowRecord = row as Record<string, unknown>;
        const teamName = typeof rowRecord.teamName === 'string' ? rowRecord.teamName : null;
        const points = Number(rowRecord.points);
        const rank = Number(rowRecord.rank);
        if (!teamName || !Number.isFinite(points) || !Number.isFinite(rank)) {
          return null;
        }
        return { teamName, points, rank };
      })
      .filter((row): row is { teamName: string; points: number; rank: number } => row !== null);
    out[division] = rows;
  });
  return out;
}

export function ReportingPage() {
  const [state, setState] = useState<CurrentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [storylines, setStorylines] = useState<Awaited<ReturnType<typeof api.reportStorylines>> | null>(null);
  const [rivalries, setRivalries] = useState<Awaited<ReturnType<typeof api.reportRivalryDesk>> | null>(null);
  const [snapshotCompare, setSnapshotCompare] = useState<Awaited<ReturnType<typeof api.reportSnapshotCompare>> | null>(null);
  const [achievements, setAchievements] = useState<Awaited<ReturnType<typeof api.achievements>>>([]);
  const [seasonProfit, setSeasonProfit] = useState<Awaited<ReturnType<typeof api.seasonProfitComparison>> | null>(null);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof api.snapshots>>>([]);
  const [entryAudit, setEntryAudit] = useState<Awaited<ReturnType<typeof api.entryAudit>>>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [snapshotPayload, setSnapshotPayload] = useState<SnapshotPayloadResponse | null>(null);

  const [teamA, setTeamA] = useState<number>(0);
  const [teamB, setTeamB] = useState<number>(0);
  const [headToHead, setHeadToHead] = useState<Awaited<ReturnType<typeof api.headToHead>> | null>(null);

  const [packLoading, setPackLoading] = useState(false);
  const [reportPack, setReportPack] = useState<ReportPackResponse | null>(null);

  const loadCore = async () => {
    setLoading(true);
    setError('');
    try {
      const current = await api.state();
      setState({ currentSeason: current.currentSeason, currentGw: current.currentGw });

      const [story, rivalryDesk, compare, achievementsRows, profit, snapshotRows, auditRows, teamsRows] = await Promise.all([
        api.reportStorylines(current.currentGw),
        api.reportRivalryDesk(current.currentGw),
        api.reportSnapshotCompare(undefined, current.currentGw),
        api.achievements(),
        api.seasonProfitComparison(),
        api.snapshots(),
        api.entryAudit(25),
        api.teams(),
      ]);
      setStorylines(story);
      setRivalries(rivalryDesk);
      setSnapshotCompare(compare);
      setAchievements(achievementsRows);
      setSeasonProfit(profit);
      setSnapshots(snapshotRows);
      setEntryAudit(auditRows);
      const options = teamsRows.map((team) => ({ id: team.id, name: team.name }));
      setTeams(options);
      setTeamA((prev) => prev || options[0]?.id || 0);
      setTeamB((prev) => prev || options[1]?.id || options[0]?.id || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reporting data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCore();
  }, []);

  useEffect(() => {
    if (!selectedSnapshotId) {
      setSnapshotPayload(null);
      return;
    }
    let active = true;
    api.snapshotPayload(selectedSnapshotId)
      .then((payload) => {
        if (active) {
          setSnapshotPayload(payload);
        }
      })
      .catch(() => {
        if (active) {
          setSnapshotPayload(null);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedSnapshotId]);

  useEffect(() => {
    if (!teamA || !teamB || teamA === teamB) {
      setHeadToHead(null);
      return;
    }
    let active = true;
    api.headToHead(teamA, teamB)
      .then((rows) => {
        if (active) {
          setHeadToHead(rows);
        }
      })
      .catch(() => {
        if (active) {
          setHeadToHead(null);
        }
      });
    return () => {
      active = false;
    };
  }, [teamA, teamB]);

  const snapshotLeaders = useMemo(() => {
    const table = safeSnapshotTable(snapshotPayload);
    return Object.entries(table)
      .map(([division, rows]) => {
        const leader = rows.find((row) => row.rank === 1) ?? rows[0];
        if (!leader) {
          return null;
        }
        return {
          division,
          teamName: leader.teamName,
          points: leader.points,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [snapshotPayload]);

  const latestProfitTotals = useMemo(() => {
    if (!seasonProfit || !state) {
      return null;
    }
    const row = seasonProfit.gameweeks.find((entry) => entry.gw === state.currentGw) ?? seasonProfit.gameweeks[seasonProfit.gameweeks.length - 1];
    if (!row) {
      return null;
    }
    return Object.entries(row.totals)
      .map(([season, total]) => ({ season, total }))
      .sort((a, b) => b.total - a.total);
  }, [seasonProfit, state]);

  const downloadPack = async (mode: 'txt' | 'json') => {
    if (!state) {
      return;
    }
    setPackLoading(true);
    try {
      const pack = await api.reportPack(state.currentGw);
      setReportPack(pack);
      if (mode === 'txt') {
        downloadBlob(`bookieball-report-${pack.season}-${pack.gw}.txt`, pack.reportText, 'text/plain');
      } else {
        downloadBlob(`bookieball-report-${pack.season}-${pack.gw}.json`, JSON.stringify(pack, null, 2), 'application/json');
      }
    } finally {
      setPackLoading(false);
    }
  };

  return (
    <section className="page page-wide reporting-page">
      <h1>Reporting Desk</h1>
      <p className="muted">
        {state ? `${state.currentSeason} ${state.currentGw} • Storylines, rivalry desk, snapshots, and export pack.` : 'Loading reporting desk...'}
      </p>
      {error && <p className="muted" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="panel">
        <div className="panel-header">
          <h3>Report Pack Export</h3>
          <button type="button" className="secondary" onClick={() => void loadCore()} disabled={loading}>
            Reload
          </button>
        </div>
        <p className="muted">Generate presenter-ready copy and downloadable assets from current standings.</p>
        <div className="grid-row">
          <button type="button" className="action" onClick={() => void downloadPack('txt')} disabled={packLoading || !state}>
            {packLoading ? 'Building...' : 'Download TXT Pack'}
          </button>
          <button type="button" className="secondary" onClick={() => void downloadPack('json')} disabled={packLoading || !state}>
            {packLoading ? 'Building...' : 'Download JSON Pack'}
          </button>
        </div>
        {reportPack && (
          <div className="report-notes">
            <h4>Presenter Notes</h4>
            {reportPack.presenterNotes.slice(0, 6).map((line, idx) => (
              <div key={`note-${idx}`} className="report-note-item">{idx + 1}. {line}</div>
            ))}
          </div>
        )}
      </div>

      <div className="tile-grid">
        <div className="panel">
          <h3>Storylines</h3>
          {loading || !storylines ? (
            <p className="muted">Loading storylines...</p>
          ) : (
            <div className="report-storyline-list">
              {storylines.storylines.map((line) => (
                <article key={line.id} className={`report-storyline tone-${line.tone}`}>
                  <strong>{line.headline}</strong>
                  <p>{line.detail}</p>
                  {line.metric && <span className="storyline-metric">{line.metric}</span>}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Rivalry Desk</h3>
          {!rivalries ? (
            <p className="muted">Loading rivalries...</p>
          ) : rivalries.rivalries.length === 0 ? (
            <p className="muted">No rivalry pairs available yet.</p>
          ) : (
            <div className="report-rivalry-list">
              {rivalries.rivalries.map((item) => (
                <article key={item.id} className="report-rivalry-card">
                  <strong>{item.matchup}</strong>
                  <span>{item.record} • {item.edge}</span>
                  <span>Avg margin {item.avgMargin} • Next {item.nextMeeting}</span>
                  <p>{item.narrative}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tile-grid">
        <div className="panel">
          <h3>Snapshot Comparison</h3>
          {!snapshotCompare ? (
            <p className="muted">Loading snapshot comparison...</p>
          ) : (
            <div className="report-snapshot-grid">
              {snapshotCompare.divisions.map((division) => (
                <article key={division.division} className="report-snapshot-card">
                  <strong>{displayDivisionName(division.division)}</strong>
                  <span>
                    Rise: {division.topRise ? `${division.topRise.teamName} (+${division.topRise.delta})` : 'None'}
                  </span>
                  <span>
                    Drop: {division.topDrop ? `${division.topDrop.teamName} (${division.topDrop.delta})` : 'None'}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Snapshot Browser</h3>
          <div className="grid-row">
            <label>
              Snapshot
              <select
                value={selectedSnapshotId ?? ''}
                onChange={(event) => setSelectedSnapshotId(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Select snapshot</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    #{snapshot.id} • {snapshot.gw} • {snapshot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {snapshotPayload ? (
            <div className="report-snapshot-leaders">
              {snapshotLeaders.map((leader) => (
                <div key={`snapshot-leader-${leader.division}`} className="report-note-item">
                  {displayDivisionName(leader.division)}: {leader.teamName} ({leader.points} pts)
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Select a snapshot to view frozen leaders.</p>
          )}
        </div>
      </div>

      <div className="tile-grid">
        <div className="panel">
          <h3>Achievements</h3>
          {achievements.length === 0 ? (
            <p className="muted">No achievements data yet.</p>
          ) : (
            achievements.map((row) => (
              <div key={row.key} className="report-note-item">
                <strong>{row.label}:</strong> {row.teamName} ({row.value})
              </div>
            ))
          )}
          {latestProfitTotals && latestProfitTotals.length > 0 && (
            <>
              <h4 style={{ marginTop: '0.9rem' }}>Season Profit ({state?.currentGw})</h4>
              {latestProfitTotals.map((row) => (
                <div key={`profit-${row.season}`} className="report-note-item">
                  {row.season}: {row.total.toFixed(2)}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="panel">
          <h3>Head-to-Head Desk</h3>
          <div className="grid-row">
            <label>
              Team A
              <select value={teamA} onChange={(event) => setTeamA(Number(event.target.value))}>
                {teams.map((team) => (
                  <option key={`team-a-${team.id}`} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
            <label>
              Team B
              <select value={teamB} onChange={(event) => setTeamB(Number(event.target.value))}>
                {teams.map((team) => (
                  <option key={`team-b-${team.id}`} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
          </div>
          {headToHead ? (
            <>
              <div className="report-note-item">
                Played {headToHead.played} • {headToHead.teamA.name} {headToHead.teamAWins} - {headToHead.teamBWins} {headToHead.teamB.name} • Draws {headToHead.draws}
              </div>
              <div className="report-rivalry-list">
                {headToHead.meetings.map((meeting, idx) => (
                  <article key={`meeting-${idx}-${meeting.gw}`} className="report-rivalry-card">
                    <strong>{meeting.gw}</strong>
                    <span>{meeting.homeTeam} {meeting.homeProfit.toFixed(2)} - {meeting.awayProfit.toFixed(2)} {meeting.awayTeam}</span>
                    <span>{meeting.result.toUpperCase()}</span>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Select two different teams for head-to-head history.</p>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Recent Entry Audit</h3>
        {entryAudit.length === 0 ? (
          <p className="muted">No audit records found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Team</th>
                <th>GW</th>
                <th>Action</th>
                <th>Profit</th>
                <th>Spins</th>
              </tr>
            </thead>
            <tbody>
              {entryAudit.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.teamName}</td>
                  <td>{row.gw}</td>
                  <td>{row.action}</td>
                  <td>{row.oldProfit} → {row.newProfit}</td>
                  <td>{row.oldSpins ?? '-'} → {row.newSpins ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
