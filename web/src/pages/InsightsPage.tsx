import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PenaltyShootoutBoard } from '../components/PenaltyShootoutBoard';

type CurrentState = {
  currentSeason: string;
  currentGw: string;
  cupDrawStarted: boolean;
  gwLocked: boolean;
};

type Notice = {
  type: 'ok' | 'error';
  text: string;
};

type PenaltyCompetition = 'cup' | 'super_cup' | 'master_cup' | 'gw8_playoff' | 'trio_playoff';

type PenaltyTieFixture = {
  competition: PenaltyCompetition;
  fixtureId: number;
  gw: string;
  roundName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProfit: number;
  awayProfit: number;
  homeSpins: number;
  awaySpins: number;
};

type PenaltyTeamMeta = {
  id: number;
  name: string;
  ballColor: string | null;
  ringColor: string | null;
};

function gwNumericValue(gw: string): number {
  const parsed = Number(gw.replace('GW', ''));
  return Number.isFinite(parsed) ? parsed : 99;
}

export function InsightsPage() {
  const [state, setState] = useState<CurrentState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [busyAction, setBusyAction] = useState<'lock' | 'unlock' | 'advance' | 'rewind' | 'refresh' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [penaltyTeams, setPenaltyTeams] = useState<PenaltyTeamMeta[]>([]);
  const [penaltyTieQueue, setPenaltyTieQueue] = useState<PenaltyTieFixture[]>([]);
  const [penaltyTieIndex, setPenaltyTieIndex] = useState(0);
  const [penaltyStep, setPenaltyStep] = useState<'idle' | 'notice' | 'shootout'>('idle');
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  const [advanceAfterPenalties, setAdvanceAfterPenalties] = useState(false);

  const refreshState = useCallback(async () => {
    const next = await api.state();
    setState(next);
  }, []);

  const refreshSnapshotList = useCallback(async () => {
    setLoadingSnapshots(true);
    try {
      const rows = await api.snapshots();
      setSnapshots(rows);
      setSelectedSnapshotId((prev) => {
        if (!rows.length) {
          return null;
        }
        if (prev && rows.some((row) => row.id === prev)) {
          return prev;
        }
        return rows[0]?.id ?? null;
      });
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

  const loadPenaltyTies = useCallback(async (): Promise<PenaltyTieFixture[]> => {
    return api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]);
  }, []);

  const activePenaltyTie = penaltyTieQueue[penaltyTieIndex] ?? null;
  const activePenaltyIsOverdue = Boolean(
    activePenaltyTie && state && gwNumericValue(activePenaltyTie.gw) < gwNumericValue(state.currentGw),
  );
  const tieSummary = useMemo(() => {
    if (!activePenaltyTie) {
      return '';
    }
    return `${activePenaltyTie.roundName} • ${activePenaltyTie.homeTeamName} vs ${activePenaltyTie.awayTeamName}`;
  }, [activePenaltyTie]);
  const penaltyTeamById = useMemo(
    () => new Map(penaltyTeams.map((team) => [team.id, team])),
    [penaltyTeams],
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const [next, snapshotRows, teams, ties] = await Promise.all([
          api.state(),
          api.snapshots().catch(() => [] as Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>),
          api.teams().catch(() => [] as Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null }>),
          loadPenaltyTies().catch(() => [] as PenaltyTieFixture[]),
        ]);
        if (active) {
          setState(next);
          setSnapshots(snapshotRows);
          setSelectedSnapshotId(snapshotRows[0]?.id ?? null);
          setPenaltyTeams(teams.map((team) => ({
            id: team.id,
            name: team.name,
            ballColor: team.ballColor ?? null,
            ringColor: team.ringColor ?? null,
          })));
          if (ties.length > 0) {
            setPenaltyTieQueue(ties);
            setPenaltyTieIndex(0);
            setPenaltyStep('notice');
            setAdvanceAfterPenalties(false);
            setNotice({ type: 'ok', text: `${ties.length} tie(s) require penalties.` });
          }
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : 'Unable to load current gameweek state.';
          setNotice({ type: 'error', text: message });
        }
      } finally {
        if (active) {
          setLoadingState(false);
          setLoadingSnapshots(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadPenaltyTies]);

  const withAction = async (action: 'lock' | 'unlock' | 'advance' | 'rewind' | 'refresh' | 'restore', work: () => Promise<void>) => {
    setBusyAction(action);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setNotice({ type: 'error', text: message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleLock = async () => {
    await withAction('lock', async () => {
      await api.lockGwSafe();
      await refreshState();
      const ties = await loadPenaltyTies();
      if (ties.length > 0) {
        setPenaltyTieQueue(ties);
        setPenaltyTieIndex(0);
        setPenaltyStep('notice');
        setAdvanceAfterPenalties(false);
        setNotice({ type: 'ok', text: `${ties.length} tie(s) require penalties.` });
        return;
      }
      setNotice({ type: 'ok', text: 'Current gameweek locked and snapshot captured.' });
    });
  };

  const handleUnlock = async () => {
    await withAction('unlock', async () => {
      await api.unlockGw();
      await refreshState();
      setNotice({ type: 'ok', text: 'Current gameweek unlocked.' });
    });
  };

  const handleAdvance = async () => {
    await withAction('advance', async () => {
      if (state && !state.gwLocked) {
        await api.lockGwSafe();
      }
      const ties = await loadPenaltyTies();
      if (ties.length > 0) {
        setPenaltyTieQueue(ties);
        setPenaltyTieIndex(0);
        setPenaltyStep('notice');
        setAdvanceAfterPenalties(true);
        setNotice({
          type: 'ok',
          text: `${ties.length} tie(s) require penalties before advancing.`,
        });
        return;
      }
      const next = await api.advanceGw();
      await refreshState();
      setNotice({
        type: 'ok',
        text: `Moved to ${next.currentSeason} ${next.currentGw}. Previous gameweek is locked.`,
      });
    });
  };

  const canRewind = useMemo(() => {
    if (!state) {
      return false;
    }
    const gwNumber = Number(state.currentGw.replace('GW', ''));
    if (Number.isFinite(gwNumber) && gwNumber > 1) {
      return true;
    }
    const seasonNumber = Number(state.currentSeason.replace('S', ''));
    return Number.isFinite(seasonNumber) && seasonNumber > 1;
  }, [state]);

  const handleRewind = async () => {
    await withAction('rewind', async () => {
      if (!state) {
        return;
      }
      const confirmed = window.confirm(`Lock ${state.currentSeason} ${state.currentGw} and go back one gameweek?`);
      if (!confirmed) {
        return;
      }
      const previous = await api.rewindGw();
      await api.unlockGw();
      await refreshState();
      setNotice({
        type: 'ok',
        text: `Moved back to ${previous.currentSeason} ${previous.currentGw}. ${state.currentSeason} ${state.currentGw} is locked and ${previous.currentSeason} ${previous.currentGw} is unlocked.`,
      });
    });
  };

  const closePenaltyModal = () => {
    setPenaltyStep('idle');
    setPenaltyTieQueue([]);
    setPenaltyTieIndex(0);
    setAdvanceAfterPenalties(false);
  };

  const penaltyCompetitionLabel = (competition: PenaltyCompetition): string => {
    if (competition === 'cup') {
      return 'Cup Tie';
    }
    if (competition === 'super_cup') {
      return 'Super Cup';
    }
    if (competition === 'master_cup') {
      return 'Master Cup';
    }
    if (competition === 'trio_playoff') {
      return 'Trio Playoff';
    }
    return 'GW8 Playoff';
  };

  const handleConfirmPenaltyWinner = async (winner: { id: number; name: string }) => {
    if (penaltyBusy) {
      return;
    }
    if (!activePenaltyTie) {
      return;
    }
    setPenaltyBusy(true);
    try {
      if (activePenaltyTie.competition === 'cup') {
        await api.setCupWinner(activePenaltyTie.fixtureId, winner.id);
      } else if (activePenaltyTie.competition === 'super_cup') {
        await api.setSuperCupWinner(activePenaltyTie.fixtureId, winner.id);
      } else if (activePenaltyTie.competition === 'master_cup') {
        await api.setMasterCupWinner(activePenaltyTie.fixtureId, winner.id);
      } else if (activePenaltyTie.competition === 'trio_playoff') {
        await api.setTrioPlayoffWinner(activePenaltyTie.fixtureId, winner.id);
      } else {
        await api.setGw8PlayoffWinner(activePenaltyTie.fixtureId, winner.id);
      }
      const refreshedQueue = await loadPenaltyTies();
      if (refreshedQueue.length > 0) {
        setPenaltyTieQueue(refreshedQueue);
        setPenaltyTieIndex(0);
        setPenaltyStep('notice');
        setNotice({
          type: 'ok',
          text: `Winner confirmed. ${refreshedQueue.length} tie(s) still require penalties.`,
        });
        return;
      }
      closePenaltyModal();
      if (advanceAfterPenalties) {
        const next = await api.advanceGw();
        await refreshState();
        setNotice({
          type: 'ok',
          text: `Moved to ${next.currentSeason} ${next.currentGw}. Previous gameweek is locked.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to set penalty winner.';
      setNotice({ type: 'error', text: message });
    } finally {
      setPenaltyBusy(false);
    }
  };

  const handleRefreshSnapshots = async () => {
    await withAction('refresh', async () => {
      const result = await api.refreshSnapshots();
      await refreshSnapshotList();
      setNotice({ type: 'ok', text: `Snapshots refreshed (${result.updated} updated, ${result.inserted} inserted).` });
    });
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshotId) {
      setNotice({ type: 'error', text: 'Choose a snapshot first.' });
      return;
    }
    const target = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId);
    if (!target) {
      setNotice({ type: 'error', text: 'Selected snapshot could not be found.' });
      return;
    }
    const ok = window.confirm(`Restore snapshot ${target.season} ${target.gw} (${target.label})?`);
    if (!ok) {
      return;
    }
    await withAction('restore', async () => {
      const result = await api.restoreSnapshot(selectedSnapshotId);
      await refreshState();
      await refreshSnapshotList();
      setNotice({
        type: 'ok',
        text: `Restored ${result.restored.season} ${result.restored.gw}. Backup: ${result.restored.backupPath ?? 'not created'}.`,
      });
    });
  };

  return (
    <section className="page page-wide">
      <h1>Insights &amp; Tools</h1>
      <p className="muted">Quick access to bookieball management pages.</p>

      <div className="panel">
        <div className="panel-header">
          <h3>Gameweek Controls</h3>
          <span className={`lock-chip ${state?.gwLocked ? 'locked' : 'open'}`}>
            {loadingState ? 'Loading...' : state?.gwLocked ? 'Locked' : 'Open'}
          </span>
        </div>
        <p className="muted">
          Current:{' '}
          {state ? `${state.currentSeason} ${state.currentGw}` : 'Loading current season/gameweek...'}
        </p>
        <div className="grid-row">
          <button
            type="button"
            className="secondary"
            onClick={() => void handleLock()}
            disabled={busyAction !== null || !state || state.gwLocked}
          >
            {busyAction === 'lock' ? 'Locking...' : 'Lock Current GW'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void handleUnlock()}
            disabled={busyAction !== null || !state || !state.gwLocked}
          >
            {busyAction === 'unlock' ? 'Unlocking...' : 'Unlock Current GW'}
          </button>
          <button
            type="button"
            className="action"
            onClick={() => void handleAdvance()}
            disabled={busyAction !== null || !state}
          >
            {busyAction === 'advance' ? 'Moving...' : 'Lock + Move to Next GW'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void handleRewind()}
            disabled={busyAction !== null || !state || !canRewind}
          >
            {busyAction === 'rewind' ? 'Rewinding...' : 'Lock + Go Back 1 GW'}
          </button>
        </div>
        {notice && (
          <p className="muted" style={notice.type === 'error' ? { color: 'var(--danger)' } : undefined}>
            {notice.text}
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Snapshot Rollback</h3>
          <span className="muted">{loadingSnapshots ? 'Loading...' : `${snapshots.length} snapshots`}</span>
        </div>
        <p className="muted">
          Restore points are reversible. A database backup is created automatically before restore.
        </p>
        <div className="grid-row">
          <label className="inline-field">
            <span className="muted">Snapshot</span>
            <select
              value={selectedSnapshotId ?? ''}
              onChange={(event) => setSelectedSnapshotId(event.target.value ? Number(event.target.value) : null)}
              disabled={busyAction !== null || snapshots.length === 0}
            >
              {snapshots.length === 0 && <option value="">No snapshots</option>}
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  #{snapshot.id} • {snapshot.season} {snapshot.gw} • {snapshot.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => void handleRefreshSnapshots()}
            disabled={busyAction !== null}
          >
            {busyAction === 'refresh' ? 'Refreshing...' : 'Refresh Snapshots'}
          </button>
          <button
            type="button"
            className="action"
            onClick={() => void handleRestoreSnapshot()}
            disabled={busyAction !== null || !selectedSnapshotId}
          >
            {busyAction === 'restore' ? 'Restoring...' : 'Restore Snapshot'}
          </button>
        </div>
      </div>

      <div className="tile-grid">
        <Link to="/gameshow" className="tile">
          <h2>Kick-Off Show</h2>
          <p>Run the live flow and Step 4 end-of-show recap pages.</p>
        </Link>
        <Link to="/entries" className="tile">
          <h2>Entry Manager</h2>
          <p>Review and adjust entries while gameweek locks allow changes.</p>
        </Link>
        <Link to="/league" className="tile">
          <h2>League View</h2>
          <p>Track division races, cup fixtures, and movement context.</p>
        </Link>
        <Link to="/matchday" className="tile">
          <h2>Matchday Wall</h2>
          <p>Real-time fixture wall with shocks, streaks, and spotlight cards.</p>
        </Link>
        <Link to="/reporting" className="tile">
          <h2>Reporting Desk</h2>
          <p>Build human-style storylines, rivalry desk notes, and report exports.</p>
        </Link>
        <Link to="/master-league" className="tile">
          <h2>Master League</h2>
          <p>Generated fixtures and standings across all teams.</p>
        </Link>
      </div>

      {penaltyStep !== 'idle' && activePenaltyTie && (
        <div className="overlay">
          <div className="penalty-modal-card">
            <div className="penalty-modal-header">
              <div>
                <h3>{penaltyCompetitionLabel(activePenaltyTie.competition)} Alert</h3>
                <p className="muted">{tieSummary}</p>
              </div>
              <span className="penalty-modal-count">
                {penaltyTieIndex + 1} of {penaltyTieQueue.length}
              </span>
            </div>

            {penaltyStep === 'notice' ? (
              <>
                <p className="muted">
                  {activePenaltyTie.competition === 'cup'
                    ? 'This cup tie is level on profit and spins. Penalties decide the winner.'
                    : activePenaltyTie.competition === 'super_cup'
                      ? 'This Super Cup tie is level on profit. Penalties decide the winner.'
                    : activePenaltyTie.competition === 'master_cup'
                      ? /semi-final/i.test(activePenaltyTie.roundName)
                        ? 'This Master Cup semi-final is level on aggregate profit. Penalties decide the winner.'
                        : 'This Master Cup tie is level on profit. Penalties decide the winner.'
                    : activePenaltyTie.competition === 'trio_playoff'
                      ? 'This Trio playoff tie is level on profit. Penalties decide the winner.'
                      : 'This GW8 playoff tie is level on profit. Spins are ignored and penalties decide the winner.'}
                </p>
                <ul className="penalty-tie-list">
                  {penaltyTieQueue.map((tie, index) => (
                    <li
                      key={`${tie.competition}-${tie.fixtureId}`}
                      className={`penalty-tie-item${index === penaltyTieIndex ? ' active' : ''}`}
                    >
                      <strong>{tie.competition === 'gw8_playoff' ? 'GW8 Playoff' : tie.roundName}</strong>
                      <span>{tie.homeTeamName} vs {tie.awayTeamName}</span>
                      <span className="penalty-tie-metrics">
                        {tie.competition === 'cup'
                          ? `Profit ${tie.homeProfit} • ${tie.homeSpins} spins | Profit ${tie.awayProfit} • ${tie.awaySpins} spins`
                          : tie.competition === 'super_cup'
                            ? `Profit ${tie.homeProfit} | Profit ${tie.awayProfit} (penalties required)`
                          : tie.competition === 'master_cup'
                            ? /semi-final/i.test(tie.roundName)
                              ? `Aggregate ${tie.homeProfit} • ${tie.homeSpins} spins | Aggregate ${tie.awayProfit} • ${tie.awaySpins} spins`
                              : `Profit ${tie.homeProfit} • ${tie.homeSpins} spins | Profit ${tie.awayProfit} • ${tie.awaySpins} spins`
                          : tie.competition === 'trio_playoff'
                            ? `Profit ${tie.homeProfit} | Profit ${tie.awayProfit} (penalties required)`
                            : `Profit ${tie.homeProfit} | Profit ${tie.awayProfit} (spins ignored)`}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid-row">
                  <button
                    type="button"
                    className="action"
                    onClick={() => setPenaltyStep('shootout')}
                  >
                    Take penalties
                  </button>
                  {!activePenaltyIsOverdue && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={closePenaltyModal}
                    >
                      Close
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <PenaltyShootoutBoard
                  homeTeam={{
                    id: activePenaltyTie.homeTeamId,
                    name: activePenaltyTie.homeTeamName,
                    ballColor: penaltyTeamById.get(activePenaltyTie.homeTeamId)?.ballColor ?? null,
                    ringColor: penaltyTeamById.get(activePenaltyTie.homeTeamId)?.ringColor ?? null,
                  }}
                  awayTeam={{
                    id: activePenaltyTie.awayTeamId,
                    name: activePenaltyTie.awayTeamName,
                    ballColor: penaltyTeamById.get(activePenaltyTie.awayTeamId)?.ballColor ?? null,
                    ringColor: penaltyTeamById.get(activePenaltyTie.awayTeamId)?.ringColor ?? null,
                  }}
                  resetKey={`${activePenaltyTie.competition}-${activePenaltyTie.fixtureId}-${penaltyTieIndex}`}
                  autoStart
                  startLabel="Take penalties"
                  confirmLabel={penaltyBusy ? 'Saving...' : 'Confirm winner'}
                  confirmDisabled={penaltyBusy}
                  onConfirmWinner={(winner) => {
                    if (penaltyBusy) {
                      return;
                    }
                    void handleConfirmPenaltyWinner(winner);
                  }}
                />
                <div className="penalty-fixture-meta">
                  <span className="muted">
                    {activePenaltyTie.competition === 'cup'
                      ? `Tie on profit/spins: ${activePenaltyTie.homeProfit} (${activePenaltyTie.homeSpins} spins) vs ${activePenaltyTie.awayProfit} (${activePenaltyTie.awaySpins} spins).`
                      : activePenaltyTie.competition === 'master_cup'
                        ? /semi-final/i.test(activePenaltyTie.roundName)
                          ? `Aggregate tie: ${activePenaltyTie.homeProfit} (${activePenaltyTie.homeSpins} spins) vs ${activePenaltyTie.awayProfit} (${activePenaltyTie.awaySpins} spins).`
                          : `Tie on profit/spins: ${activePenaltyTie.homeProfit} (${activePenaltyTie.homeSpins} spins) vs ${activePenaltyTie.awayProfit} (${activePenaltyTie.awaySpins} spins).`
                      : activePenaltyTie.competition === 'trio_playoff'
                        ? `Tie on profit: ${activePenaltyTie.homeProfit} vs ${activePenaltyTie.awayProfit}. Trio playoffs now go straight to penalties.`
                        : `Tie on profit: ${activePenaltyTie.homeProfit} vs ${activePenaltyTie.awayProfit}. Spins do not apply in GW8 playoffs.`}
                  </span>
                </div>
                {!activePenaltyIsOverdue && (
                  <div className="grid-row">
                    <button
                      type="button"
                      className="secondary"
                      onClick={closePenaltyModal}
                      disabled={penaltyBusy}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
