import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';

const GWS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];

export function EntryManagerPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string; gwLocked: boolean } | null>(null);
  const [teams, setTeams] = useState<
    Array<{ id: number; teamId: string | null; name: string; url: string; division: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>
  >([]);
  const [entry, setEntry] = useState({ teamId: 0, profit: 0, spins: 0, stake: 0, notes: '' });
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [entryLog, setEntryLog] = useState<
    Array<{
      id: number;
      season: string;
      gw: string;
      teamId: number;
      teamName: string;
      entryType: 'free_spins' | 'bonus';
      profit: number;
      spins: number | null;
      stake: number | null;
      notes: string | null;
      noWin: boolean;
      batchId: string | null;
      createdAt: string;
      locked: boolean;
    }>
  >([]);
  const [entryFilters, setEntryFilters] = useState<{ gw: string; teamId: number; type: 'all' | 'free_spins' | 'bonus' }>({
    gw: 'ALL',
    teamId: 0,
    type: 'all',
  });
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<{
    entryType: 'free_spins' | 'bonus';
    profit: number;
    spins: number | null;
    stake: number | null;
    notes: string;
    noWin: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.state(), api.teams()])
      .then(([nextState, nextTeams]) => {
        if (!active) {
          return;
        }
        setState(nextState);
        setTeams(nextTeams);
        setEntry((prev) => (prev.teamId === 0 && nextTeams.length > 0 ? { ...prev, teamId: nextTeams[0].id } : prev));
      })
      .catch(() => {
        if (active) {
          setState(null);
          setTeams([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const reloadEntries = async (nextFilters = entryFilters) => {
    const entries = await api.entries({
      gw: nextFilters.gw === 'ALL' ? undefined : nextFilters.gw,
      teamId: nextFilters.teamId === 0 ? undefined : nextFilters.teamId,
      type: nextFilters.type === 'all' ? undefined : nextFilters.type,
    });
    setEntryLog(entries);
  };

  useEffect(() => {
    void reloadEntries();
  }, [entryFilters]);

  const entryGroups = useMemo(() => {
    const groups = new Map<number, { teamId: number; teamName: string; entries: typeof entryLog }>();
    entryLog.forEach((row) => {
      const existing = groups.get(row.teamId);
      if (existing) {
        existing.entries.push(row);
      } else {
        groups.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, entries: [row] });
      }
    });
    const ordered = Array.from(groups.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
    ordered.forEach((group) => {
      group.entries.sort((a, b) => {
        const aTime = Number.isNaN(new Date(a.createdAt).getTime()) ? 0 : new Date(a.createdAt).getTime();
        const bTime = Number.isNaN(new Date(b.createdAt).getTime()) ? 0 : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
    });
    return ordered;
  }, [entryLog]);

  const formatTimestamp = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  };

  const submitManual = async () => {
    setManualMessage(null);
    try {
      await api.saveEntries([
        {
          teamId: entry.teamId,
          entryType: 'free_spins',
          profit: Number(entry.profit),
          spins: Number(entry.spins),
          stake: Number(entry.stake),
          notes: entry.notes.length ? entry.notes : null,
          noWin: false,
        },
      ]);
      setManualMessage({ type: 'success', text: 'Entry saved.' });
      await reloadEntries();
    } catch (error) {
      setManualMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save entry' });
    }
  };

  const startEditEntry = (row: (typeof entryLog)[number]) => {
    setEditingEntryId(row.id);
    setEditingEntry({
      entryType: row.entryType,
      profit: row.profit,
      spins: row.spins ?? null,
      stake: row.stake ?? null,
      notes: row.notes ?? '',
      noWin: row.noWin,
    });
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditingEntry(null);
  };

  const saveEditEntry = async () => {
    if (!editingEntryId || !editingEntry) {
      return;
    }
    await api.updateEntry(editingEntryId, {
      entryType: editingEntry.entryType,
      profit: Number(editingEntry.profit),
      spins: editingEntry.entryType === 'bonus' ? null : (editingEntry.spins ?? 0),
      stake: editingEntry.stake ?? null,
      notes: editingEntry.notes.length > 0 ? editingEntry.notes : null,
      noWin: editingEntry.noWin,
    });
    cancelEditEntry();
    await reloadEntries();
  };

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);

  return (
    <section className="page">
      <h1>Entry Manager</h1>
      <p className="muted">Current: {state ? `${state.currentSeason} ${state.currentGw}` : 'Loading...'}</p>

      <div className="panel">
        <h3>Manual Add Entry</h3>
        <p className="muted">Use this throughout the day for any team. Entries remain adjustable until you move to the next GW.</p>
        {state?.gwLocked && <p className="muted">This GW is currently locked. Use the Insights &amp; Tools page to unlock it.</p>}
        <div className="grid-row">
          <label>
            Team
            <select value={entry.teamId} onChange={(e) => setEntry((prev) => ({ ...prev, teamId: Number(e.target.value) }))}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label>
            Profit
            <input type="number" value={entry.profit} onChange={(e) => setEntry((prev) => ({ ...prev, profit: Number(e.target.value) }))} />
          </label>
          <label>
            Spins
            <input type="number" value={entry.spins} onChange={(e) => setEntry((prev) => ({ ...prev, spins: Number(e.target.value) }))} />
          </label>
          <label>
            Stake
            <input type="number" value={entry.stake} onChange={(e) => setEntry((prev) => ({ ...prev, stake: Number(e.target.value) }))} />
          </label>
          <label>
            Notes
            <input type="text" value={entry.notes} onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))} />
          </label>
          <button className="action" onClick={submitManual} disabled={state?.gwLocked}>Save Entry</button>
        </div>
        {manualMessage && (
          <p className="muted" style={manualMessage.type === 'error' ? { color: 'var(--danger)' } : undefined}>
            {manualMessage.text}
          </p>
        )}
      </div>

      <div className="panel">
        <h3>Entry Log</h3>
        <p className="muted">Edit any entry while its gameweek is unlocked.</p>
        <div className="grid-row">
          <label>
            GW
            <select value={entryFilters.gw} onChange={(e) => setEntryFilters((prev) => ({ ...prev, gw: e.target.value }))}>
              <option value="ALL">All</option>
              {GWS.map((gw) => <option key={`filter-${gw}`} value={gw}>{gw}</option>)}
            </select>
          </label>
          <label>
            Team
            <select value={entryFilters.teamId} onChange={(e) => setEntryFilters((prev) => ({ ...prev, teamId: Number(e.target.value) }))}>
              <option value={0}>All</option>
              {teams.map((team) => <option key={`filter-team-${team.id}`} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={entryFilters.type} onChange={(e) => setEntryFilters((prev) => ({ ...prev, type: e.target.value as typeof entryFilters.type }))}>
              <option value="all">All</option>
              <option value="free_spins">Free Spins</option>
              <option value="bonus">Bonus</option>
            </select>
          </label>
          <button className="secondary" onClick={() => reloadEntries()}>Refresh</button>
        </div>
        {entryLog.length === 0 ? (
          <p className="muted">No entries yet.</p>
        ) : (
          <div className="entry-group-list">
            {entryGroups.map((group) => {
              const badgeMeta = teamByName.get(group.teamName);
              return (
                <details key={`entry-group-${group.teamId}`} className="entry-group">
                  <summary>
                    <span className="entry-group-title">
                      <TeamBadge
                        name={group.teamName}
                        ballColor={badgeMeta?.ballColor ?? null}
                        ringColor={badgeMeta?.ringColor ?? null}
                        textColor={badgeMeta?.textColor ?? null}
                        size={20}
                      />
                      {group.teamName}
                    </span>
                    <span className="entry-group-meta">{group.entries.length} entries</span>
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>GW</th>
                        <th>Type</th>
                        <th>Profit</th>
                        <th>Spins</th>
                        <th>Stake</th>
                        <th>Notes</th>
                        <th>No Win</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((row) => {
                        const isEditing = editingEntryId === row.id;
                        const locked = row.locked;
                        return (
                          <tr key={row.id}>
                            <td>{formatTimestamp(row.createdAt)}</td>
                            <td>{row.gw}</td>
                            <td>
                              {isEditing && editingEntry ? (
                                <select
                                  value={editingEntry.entryType}
                                  onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, entryType: e.target.value as 'free_spins' | 'bonus' } : prev))}
                                >
                                  <option value="free_spins">Free Spins</option>
                                  <option value="bonus">Bonus</option>
                                </select>
                              ) : (
                                row.entryType === 'free_spins' ? 'Free Spins' : 'Bonus'
                              )}
                            </td>
                            <td>
                              {isEditing && editingEntry ? (
                                <input type="number" value={editingEntry.profit} onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, profit: Number(e.target.value) } : prev))} />
                              ) : (
                                row.profit
                              )}
                            </td>
                            <td>
                              {isEditing && editingEntry ? (
                                <input
                                  type="number"
                                  value={editingEntry.spins ?? ''}
                                  onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, spins: e.target.value === '' ? null : Number(e.target.value) } : prev))}
                                  disabled={editingEntry.entryType === 'bonus'}
                                />
                              ) : (
                                row.spins ?? '-'
                              )}
                            </td>
                            <td>
                              {isEditing && editingEntry ? (
                                <input
                                  type="number"
                                  value={editingEntry.stake ?? ''}
                                  onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, stake: e.target.value === '' ? null : Number(e.target.value) } : prev))}
                                />
                              ) : (
                                row.stake ?? '-'
                              )}
                            </td>
                            <td>
                              {isEditing && editingEntry ? (
                                <input type="text" value={editingEntry.notes} onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} />
                              ) : (
                                row.notes ?? '-'
                              )}
                            </td>
                            <td>
                              {isEditing && editingEntry ? (
                                <input type="checkbox" checked={editingEntry.noWin} onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, noWin: e.target.checked } : prev))} />
                              ) : (
                                row.noWin ? 'Yes' : 'No'
                              )}
                            </td>
                            <td>
                              {locked ? (
                                <span className="muted">Locked</span>
                              ) : isEditing ? (
                                <>
                                  <button className="action" onClick={saveEditEntry}>Save</button>
                                  <button className="secondary" onClick={cancelEditEntry}>Cancel</button>
                                </>
                              ) : (
                                <button className="secondary" onClick={() => startEditEntry(row)}>Edit</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
