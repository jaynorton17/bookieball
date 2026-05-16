import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PenaltyShootoutBoard } from '../components/PenaltyShootoutBoard';

type CurrentState = {
  currentSeason: string;
  currentGw: string;
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

export function SettingsPage() {
  const [state, setState] = useState<CurrentState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [busyAction, setBusyAction] = useState<'fixtures' | 'lock' | 'advance' | 'rewind' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [penaltyTeams, setPenaltyTeams] = useState<PenaltyTeamMeta[]>([]);
  const [penaltyTieQueue, setPenaltyTieQueue] = useState<PenaltyTieFixture[]>([]);
  const [penaltyTieIndex, setPenaltyTieIndex] = useState(0);
  const [penaltyStep, setPenaltyStep] = useState<'idle' | 'notice' | 'shootout'>('idle');
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  const [advanceAfterPenalties, setAdvanceAfterPenalties] = useState(false);

  const refreshState = useCallback(async () => {
    const nextState = await api.state();
    setState({
      currentSeason: nextState.currentSeason,
      currentGw: nextState.currentGw,
      gwLocked: nextState.gwLocked,
    });
  }, []);

  const loadPenaltyTeams = useCallback(async () => {
    const teams = await api.teams().catch(() => [] as Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null }>);
    setPenaltyTeams(teams.map((team) => ({
      id: team.id,
      name: team.name,
      ballColor: team.ballColor ?? null,
      ringColor: team.ringColor ?? null,
    })));
  }, []);

  const loadPenaltyTies = useCallback(async (): Promise<PenaltyTieFixture[]> => {
    return api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]);
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingState(true);
      setNotice(null);
      try {
        const [nextState, teams, ties] = await Promise.all([
          api.state(),
          api.teams().catch(() => [] as Array<{ id: number; name: string; ballColor: string | null; ringColor: string | null }>),
          loadPenaltyTies().catch(() => [] as PenaltyTieFixture[]),
        ]);
        if (!active) {
          return;
        }
        setState({
          currentSeason: nextState.currentSeason,
          currentGw: nextState.currentGw,
          gwLocked: nextState.gwLocked,
        });
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
      } catch (error) {
        if (active) {
          setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load settings state.' });
        }
      } finally {
        if (active) {
          setLoadingState(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadPenaltyTies]);

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
    if (penaltyBusy || !activePenaltyTie) {
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
        await api.unlockGw();
        await refreshState();
        setNotice({
          type: 'ok',
          text: `Moved to ${next.currentSeason} ${next.currentGw}. Previous gameweek is locked and the new gameweek is unlocked.`,
        });
      } else {
        await refreshState();
        setNotice({ type: 'ok', text: 'Penalty shootouts completed for current gameweek.' });
      }
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to set penalty winner.' });
    } finally {
      setPenaltyBusy(false);
    }
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

  const withAction = async (action: 'fixtures' | 'lock' | 'advance' | 'rewind', work: () => Promise<void>) => {
    setBusyAction(action);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Action failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleLockCurrentGw = async () => {
    if (!state) {
      return;
    }
    await withAction('lock', async () => {
      await api.lockGwSafe();
      await refreshState();
      const ties = await loadPenaltyTies();
      if (ties.length > 0) {
        setPenaltyTieQueue(ties);
        setPenaltyTieIndex(0);
        setPenaltyStep('notice');
        setAdvanceAfterPenalties(false);
        setNotice({
          type: 'ok',
          text: `Locked ${state.currentSeason} ${state.currentGw}. ${ties.length} tie(s) require penalties.`,
        });
        return;
      }
      setNotice({ type: 'ok', text: `Locked ${state.currentSeason} ${state.currentGw}.` });
    });
  };

  const handleLockAndMoveNext = async () => {
    if (!state) {
      return;
    }
    await withAction('advance', async () => {
      if (!state.gwLocked) {
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
      await api.unlockGw();
      await refreshState();
      setNotice({
        type: 'ok',
        text: `Moved to ${next.currentSeason} ${next.currentGw}. Previous gameweek is locked and the new gameweek is unlocked.`,
      });
    });
  };

  const handleRewind = async () => {
    if (!state) {
      return;
    }
    await withAction('rewind', async () => {
      const confirmed = window.confirm(`Lock ${state.currentSeason} ${state.currentGw} and go back one gameweek?`);
      if (!confirmed) {
        return;
      }
      if (!state.gwLocked) {
        await api.lockGwSafe();
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

  const handleGenerateAllFixtures = async () => {
    await withAction('fixtures', async () => {
      const result = await api.generateAllFixtures();
      await refreshState();
      const masterCupNote = result.masterCupCreated > 0 ? `, Master Cup GW1-GW6: ${result.masterCupCreated}` : '';
      const trioNote = result.trioCreated > 0 ? `, Trio regular season: ${result.trioCreated}` : '';
      const tierNote = result.tierCreated > 0 ? `, Tier League GW4-GW8: ${result.tierCreated}` : '';
      await loadPenaltyTeams();
      setNotice({
        type: 'ok',
        text: `${result.season} fixtures generated. Divisions GW1-GW7: ${result.divisionCreated}, Master GW1-GW8: ${result.masterCreated}${masterCupNote}${trioNote}${tierNote}. Bookie Ball Cup draw remains separate. Total created: ${result.totalCreated}.`,
      });
    });
  };

  return (
    <section className="page page-wide">
      <h1>Settings</h1>
      <p className="muted">
        {loadingState
          ? 'Loading settings...'
          : state
            ? `${state.currentSeason} ${state.currentGw} • Fixture generation and gameweek control.`
            : 'Unable to load current state.'}
      </p>

      {notice && (
        <div className="panel">
          <p className="muted" style={notice.type === 'error' ? { color: 'var(--danger)' } : undefined}>
            {notice.text}
          </p>
        </div>
      )}

      <div className="panel">
        <h3>Gameweek Controls</h3>
        <p className="muted">
          Current status: {state ? `${state.currentSeason} ${state.currentGw} (${state.gwLocked ? 'Locked' : 'Open'})` : 'Loading...'}
        </p>
        <span className={`lock-chip ${state?.gwLocked ? 'locked' : 'open'}`}>
          {loadingState ? 'Loading...' : state?.gwLocked ? 'Locked' : 'Open'}
        </span>
        <div className="grid-row">
          <button
            type="button"
            className="secondary"
            onClick={handleLockCurrentGw}
            disabled={loadingState || !state || busyAction !== null || state.gwLocked}
          >
            {busyAction === 'lock' ? 'Locking...' : 'Lock Current GW'}
          </button>
          <button
            type="button"
            className="action"
            onClick={handleLockAndMoveNext}
            disabled={loadingState || !state || busyAction !== null}
          >
            {busyAction === 'advance' ? 'Moving...' : 'Lock + Move to Next GW'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleRewind}
            disabled={loadingState || !state || busyAction !== null || !canRewind}
          >
            {busyAction === 'rewind' ? 'Rewinding...' : 'Lock + Go Back 1 GW'}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Generate Fixtures</h3>
        <p className="muted">This generates division fixtures for GW1-GW7, Master League fixtures for GW1-GW8, Master Cup fixtures for GW1-GW6, and Trio regular-season fixtures for GW1-GW6. Bookie Ball Cup draw stays separate.</p>
        <button
          type="button"
          className="action"
          onClick={handleGenerateAllFixtures}
          disabled={loadingState || busyAction !== null}
        >
          {busyAction === 'fixtures' ? 'Generating...' : 'Generate All League & Division Fixtures'}
        </button>
      </div>

      <div className="panel">
        <h3>Bookie Ball Cup</h3>
        <p className="muted">Cup draw stays separate and manual.</p>
        <Link className="secondary" to="/cup-draw">Open Cup Draw</Link>
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
                  {!advanceAfterPenalties && !activePenaltyIsOverdue && (
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
                <div className="grid-row">
                  {!advanceAfterPenalties && !activePenaltyIsOverdue && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={closePenaltyModal}
                      disabled={penaltyBusy}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
