import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

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

export function InsightsPage() {
  const [state, setState] = useState<CurrentState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [busyAction, setBusyAction] = useState<'lock' | 'unlock' | 'advance' | 'refresh' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);

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

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const next = await api.state();
        const snapshotRows = await api.snapshots().catch(() => [] as Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>);
        if (active) {
          setState(next);
          setSnapshots(snapshotRows);
          setSelectedSnapshotId(snapshotRows[0]?.id ?? null);
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
  }, []);

  const withAction = async (action: 'lock' | 'unlock' | 'advance' | 'refresh' | 'restore', work: () => Promise<void>) => {
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
      const next = await api.advanceGw();
      await refreshState();
      setNotice({
        type: 'ok',
        text: `Moved to ${next.currentSeason} ${next.currentGw}. Previous gameweek is locked.`,
      });
    });
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
    <section className="page">
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
        <Link to="/sky-sports-news" className="tile">
          <h2>Sky Sports News Live</h2>
          <p>Watch the studio feed at any time with carousel tables and slides.</p>
        </Link>
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
    </section>
  );
}
