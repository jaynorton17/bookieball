import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { TeamBadge } from '../components/TeamBadge';

const GWS = ['GW1', 'GW2', 'GW3', 'GW4', 'GW5', 'GW6', 'GW7', 'GW8'];
const AUTO_STAKE_PROFIT_START_SEASON = 4;
const QUICK_ENTRY_STORAGE_KEY = 'bookieball.quickEntries.v1';
const QUICK_ENTRY_LIMIT = 20;

type EntryType = 'free_spins' | 'bonus';

type ManualEntry = {
  teamId: number;
  entryType: EntryType;
  profit: string;
  spins: string;
  stake: string;
  notes: string;
};

type QuickEntry = ManualEntry & {
  id: string;
  teamName: string;
  savedAt: string;
};

function parseSeasonNumber(season: string): number {
  const numeric = Number(season.replace('S', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function isAutoStakeProfitSeason(season: string): boolean {
  return parseSeasonNumber(season) >= AUTO_STAKE_PROFIT_START_SEASON;
}

function toSafeNumber(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stakeProfitContribution(
  entryType: 'free_spins' | 'bonus',
  spins: number | null | undefined,
  stake: number | null | undefined,
): number {
  const normalizedStake = toSafeNumber(stake);
  if (entryType === 'free_spins') {
    return toSafeNumber(spins) * normalizedStake;
  }
  return normalizedStake;
}

function formatNumberInput(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return Number.isFinite(value) ? String(value) : '';
}

function parseRequiredNumberInput(value: string, fieldLabel: string): number {
  if (value.trim() === '') {
    throw new Error(`${fieldLabel} is required.`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldLabel} must be a number.`);
  }
  return numeric;
}

function parseOptionalNumberInput(value: string, fieldLabel: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldLabel} must be a number.`);
  }
  return numeric;
}

function buildEntryPayload(source: ManualEntry) {
  const profit = parseRequiredNumberInput(source.profit, 'Profit');
  const spins = source.entryType === 'bonus' ? null : parseRequiredNumberInput(source.spins, 'Spins');
  const stake = parseOptionalNumberInput(source.stake, 'Stake');
  if (source.entryType === 'free_spins' && spins !== null && spins <= 0) {
    throw new Error('Spins must be greater than 0 for free spins entries.');
  }
  return {
    teamId: source.teamId,
    entryType: source.entryType,
    profit,
    spins,
    stake,
    notes: source.notes.length ? source.notes : null,
    noWin: false,
  };
}

function quickEntrySignature(source: ManualEntry): string {
  return [
    source.teamId,
    source.entryType,
    source.profit.trim(),
    source.spins.trim(),
    source.stake.trim(),
    source.notes.trim(),
  ].join('|');
}

function makeQuickEntryId(): string {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readQuickEntries(): QuickEntry[] {
  try {
    const raw = window.localStorage.getItem(QUICK_ENTRY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is QuickEntry => {
        if (!item || typeof item !== 'object') {
          return false;
        }
        const candidate = item as Partial<QuickEntry>;
        return (
          typeof candidate.id === 'string'
          && typeof candidate.teamName === 'string'
          && typeof candidate.savedAt === 'string'
          && typeof candidate.teamId === 'number'
          && (candidate.entryType === 'free_spins' || candidate.entryType === 'bonus')
          && typeof candidate.profit === 'string'
          && typeof candidate.spins === 'string'
          && typeof candidate.stake === 'string'
          && typeof candidate.notes === 'string'
        );
      })
      .slice(0, QUICK_ENTRY_LIMIT);
  } catch {
    return [];
  }
}

export function EntryManagerPage() {
  const [state, setState] = useState<{ currentSeason: string; currentGw: string; gwLocked: boolean } | null>(null);
  const [teams, setTeams] = useState<
    Array<{ id: number; teamId: string | null; name: string; url: string; division: string; ballColor: string | null; ringColor: string | null; textColor: string | null }>
  >([]);
  const [entry, setEntry] = useState<ManualEntry>({
    teamId: 0,
    entryType: 'free_spins',
    profit: '',
    spins: '',
    stake: '0.1',
    notes: '',
  });
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveAsQuickEntry, setSaveAsQuickEntry] = useState(false);
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);
  const [quickEntryBusyId, setQuickEntryBusyId] = useState<string | null>(null);
  const [entryLog, setEntryLog] = useState<
    Array<{
      id: number;
      season: string;
      gw: string;
      teamId: number;
      teamName: string;
      entryType: EntryType;
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
    entryType: EntryType;
    profit: string;
    spins: string;
    stake: string;
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

  useEffect(() => {
    setQuickEntries(readQuickEntries());
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

  const persistQuickEntries = (nextEntries: QuickEntry[]) => {
    const limitedEntries = nextEntries.slice(0, QUICK_ENTRY_LIMIT);
    setQuickEntries(limitedEntries);
    try {
      window.localStorage.setItem(QUICK_ENTRY_STORAGE_KEY, JSON.stringify(limitedEntries));
    } catch {
      // Quick entries are a browser convenience; entry saving still works if storage is unavailable.
    }
  };

  const saveQuickEntryTemplate = (source: ManualEntry) => {
    const teamName = teams.find((team) => team.id === source.teamId)?.name ?? `Team ${source.teamId}`;
    const nextQuickEntry: QuickEntry = {
      ...source,
      id: makeQuickEntryId(),
      teamName,
      savedAt: new Date().toISOString(),
    };
    const nextSignature = quickEntrySignature(nextQuickEntry);
    persistQuickEntries([
      nextQuickEntry,
      ...quickEntries.filter((quickEntry) => quickEntrySignature(quickEntry) !== nextSignature),
    ]);
  };

  const removeQuickEntry = (quickEntryId: string) => {
    persistQuickEntries(quickEntries.filter((quickEntry) => quickEntry.id !== quickEntryId));
  };

  const submitQuickEntry = async (quickEntry: QuickEntry) => {
    setManualMessage(null);
    setQuickEntryBusyId(quickEntry.id);
    try {
      await api.saveEntries([buildEntryPayload(quickEntry)]);
      setManualMessage({ type: 'success', text: `Quick entry saved for ${quickEntry.teamName}.` });
      await reloadEntries();
    } catch (error) {
      setManualMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save quick entry' });
    } finally {
      setQuickEntryBusyId(null);
    }
  };

  const submitManual = async () => {
    setManualMessage(null);
    try {
      await api.saveEntries([buildEntryPayload(entry)]);
      if (saveAsQuickEntry) {
        saveQuickEntryTemplate(entry);
      }
      setManualMessage({ type: 'success', text: saveAsQuickEntry ? 'Entry saved and added to quick entries.' : 'Entry saved.' });
      setEntry((prev) => ({
        ...prev,
        profit: '',
        spins: prev.entryType === 'bonus' ? '' : '',
        notes: '',
      }));
      await reloadEntries();
    } catch (error) {
      setManualMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save entry' });
    }
  };

  const startEditEntry = (row: (typeof entryLog)[number]) => {
    const adjustment = isAutoStakeProfitSeason(row.season)
      ? stakeProfitContribution(row.entryType, row.spins, row.stake)
      : 0;
    setEditingEntryId(row.id);
    setEditingEntry({
      entryType: row.entryType,
      profit: formatNumberInput(Number((row.profit - adjustment).toFixed(2))),
      spins: formatNumberInput(row.spins),
      stake: formatNumberInput(row.stake),
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
    try {
      const profit = parseRequiredNumberInput(editingEntry.profit, 'Profit');
      const spins = editingEntry.entryType === 'bonus' ? null : parseRequiredNumberInput(editingEntry.spins, 'Spins');
      const stake = parseOptionalNumberInput(editingEntry.stake, 'Stake');
      if (editingEntry.entryType === 'free_spins' && spins !== null && spins <= 0) {
        throw new Error('Spins must be greater than 0 for free spins entries.');
      }
      await api.updateEntry(editingEntryId, {
        entryType: editingEntry.entryType,
        profit,
        spins,
        stake,
        notes: editingEntry.notes.length > 0 ? editingEntry.notes : null,
        noWin: editingEntry.noWin,
      });
      cancelEditEntry();
      await reloadEntries();
    } catch (error) {
      setManualMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update entry' });
    }
  };

  const teamByName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);

  return (
    <section className="page page-wide">
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
            Type
            <select
              value={entry.entryType}
              onChange={(e) => {
                const nextType = e.target.value as EntryType;
                setEntry((prev) => ({
                  ...prev,
                  entryType: nextType,
                  spins: nextType === 'bonus' ? '' : prev.spins,
                  stake: nextType === 'bonus'
                    ? (prev.stake.trim() === '' ? '0' : prev.stake)
                    : (prev.stake.trim() === '' || prev.stake === '0' ? '0.1' : prev.stake),
                }));
              }}
            >
              <option value="free_spins">Free Spins</option>
              <option value="bonus">Bonus</option>
            </select>
          </label>
          <label>
            Profit
            <input type="number" value={entry.profit} onChange={(e) => setEntry((prev) => ({ ...prev, profit: e.target.value }))} />
          </label>
          <label>
            Spins
            <input
              type="number"
              value={entry.spins}
              onChange={(e) => setEntry((prev) => ({ ...prev, spins: e.target.value }))}
              disabled={entry.entryType === 'bonus'}
            />
          </label>
          <label>
            Stake
            <input type="number" value={entry.stake} onChange={(e) => setEntry((prev) => ({ ...prev, stake: e.target.value }))} />
          </label>
          <label>
            Notes
            <input type="text" value={entry.notes} onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))} />
          </label>
          <label className="quick-entry-checkbox">
            <input
              type="checkbox"
              checked={saveAsQuickEntry}
              onChange={(e) => setSaveAsQuickEntry(e.target.checked)}
            />
            <span>Save as quick entry</span>
          </label>
          <button className="action" onClick={submitManual} disabled={state?.gwLocked}>Save Entry</button>
        </div>
        <div className="quick-entry-section">
          <div className="quick-entry-head">
            <h4>Quick Entries</h4>
            <span>{quickEntries.length} saved</span>
          </div>
          {quickEntries.length === 0 ? (
            <p className="muted">Tick "Save as quick entry" while saving an entry to add it here.</p>
          ) : (
            <div className="quick-entry-list">
              {quickEntries.map((quickEntry) => {
                const teamMeta = teams.find((team) => team.id === quickEntry.teamId);
                const teamName = teamMeta?.name ?? quickEntry.teamName;
                const savingThisEntry = quickEntryBusyId === quickEntry.id;
                return (
                  <div key={quickEntry.id} className="quick-entry-item">
                    <div className="quick-entry-main">
                      <span className="quick-entry-team">
                        <TeamBadge
                          name={teamName}
                          ballColor={teamMeta?.ballColor ?? null}
                          ringColor={teamMeta?.ringColor ?? null}
                          textColor={teamMeta?.textColor ?? null}
                          size={20}
                        />
                        <strong>{teamName}</strong>
                      </span>
                      <span>{quickEntry.entryType === 'free_spins' ? 'Free Spins' : 'Bonus'}</span>
                      <span>Profit {quickEntry.profit || '-'}</span>
                      {quickEntry.entryType === 'free_spins' && <span>Spins {quickEntry.spins || '-'}</span>}
                      <span>Stake {quickEntry.stake || '-'}</span>
                      {quickEntry.notes && <span>Notes: {quickEntry.notes}</span>}
                    </div>
                    <div className="quick-entry-actions">
                      <button
                        type="button"
                        className="action"
                        onClick={() => void submitQuickEntry(quickEntry)}
                        disabled={state?.gwLocked || quickEntryBusyId !== null}
                      >
                        {savingThisEntry ? 'Entering...' : 'Enter Again'}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeQuickEntry(quickEntry.id)}
                        disabled={quickEntryBusyId !== null}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  <div className="table-scroll">
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
                                    onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, entryType: e.target.value as EntryType } : prev))}
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
                                  <input type="number" value={editingEntry.profit} onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, profit: e.target.value } : prev))} />
                                ) : (
                                  row.profit
                                )}
                              </td>
                              <td>
                                {isEditing && editingEntry ? (
                                  <input
                                    type="number"
                                    value={editingEntry.spins}
                                    onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, spins: e.target.value } : prev))}
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
                                    value={editingEntry.stake}
                                    onChange={(e) => setEditingEntry((prev) => (prev ? { ...prev, stake: e.target.value } : prev))}
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
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
