import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PenaltyShootoutBoard } from '../components/PenaltyShootoutBoard';
import { getTeamPerformanceHistory, calculateTeamTrends, TeamPerformanceData } from '../lib/teamAnalytics';
import { TeamPerformanceChart } from '../components/TeamPerformanceChart';
import { HeadToHeadComparison } from '../components/HeadToHeadComparison';
import { TeamRatingsLeaderboard } from '../components/TeamRatingsLeaderboard';
import { AchievementsWall } from '../components/AchievementsWall';
import { SeasonProfitChart } from '../components/SeasonProfitChart';

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
  const [busyAction, setBusyAction] = useState<'fixtures' | 'lock' | 'unlock' | 'advance' | 'rewind' | 'refresh' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [penaltyTeams, setPenaltyTeams] = useState<PenaltyTeamMeta[]>([]);
  const [penaltyTieQueue, setPenaltyTieQueue] = useState<PenaltyTieFixture[]>([]);
  const [penaltyTieIndex, setPenaltyTieIndex] = useState(0);
  const [penaltyStep, setPenaltyStep] = useState<'idle' | 'notice' | 'shootout'>('idle');
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  const [penaltySpeed, setPenaltySpeed] = useState(500);
  const [penaltyAutoPlay, setPenaltyAutoPlay] = useState(false);
  const [skipResultWinner, setSkipResultWinner] = useState<{ id: number; name: string } | null>(null);
  const [advanceAfterPenalties, setAdvanceAfterPenalties] = useState(false);
  
  // Team Analytics State
  const [teams, setTeams] = useState<Array<{ id: number; name: string; ballColor?: string | null; ringColor?: string | null; textColor?: string | null }>>([]);
  const [selectedTeamForAnalytics, setSelectedTeamForAnalytics] = useState<string>('');
  const [teamAnalyticsData, setTeamAnalyticsData] = useState<TeamPerformanceData[]>([]);
  const [loadingTeamAnalytics, setLoadingTeamAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'admin'>('analytics');
  const [teamRatings, setTeamRatings] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [seasonProfit, setSeasonProfit] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

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

   const handleLoadTeamAnalytics = useCallback(async () => {
     if (!selectedTeamForAnalytics || !state) return;
     
     setLoadingTeamAnalytics(true);
     try {
       // Find team ID by name
       const team = teams.find(t => t.name === selectedTeamForAnalytics);
       if (!team) {
         setNotice({ type: 'error', text: 'Team not found' });
         return;
       }
       
       const history = await getTeamPerformanceHistory(team.id);
       setTeamAnalyticsData(history);
       
       if (notice?.type === 'error' && notice.text === 'Team not found') {
         setNotice(null);
       }
     } catch (error) {
       console.error('Failed to load team analytics:', error);
       setNotice({ type: 'error', text: 'Failed to load team analytics' });
     } finally {
       setLoadingTeamAnalytics(false);
     }
   }, [selectedTeamForAnalytics, state, teams, setNotice]);

  const loadPenaltyTies = useCallback(async (): Promise<PenaltyTieFixture[]> => {
    return api.penaltyQueue().catch(() => [] as PenaltyTieFixture[]);
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
        const [next, snapshotRows, teamsList, ties, ratings, achievementsList, profitComparison] = await Promise.all([
          api.state(),
          api.snapshots().catch(() => [] as Array<{ id: number; season: string; gw: string; label: string; createdAt: string }>),
          api.teams().catch(() => [] as any[]),
          loadPenaltyTies().catch(() => [] as PenaltyTieFixture[]),
          api.teamRatings().catch(() => []),
          api.achievements().catch(() => []),
          api.seasonProfitComparison().catch(() => null),
        ]);
        if (active) {
          setState(next);
          setSnapshots(snapshotRows);
          setSelectedSnapshotId(snapshotRows[0]?.id ?? null);
          
          // Populate teams state (fixes the bug!)
          setTeams(
            teamsList.map((t) => ({
              id: t.id,
              name: t.name,
              ballColor: t.ballColor ?? null,
              ringColor: t.ringColor ?? null,
              textColor: t.textColor ?? null,
            }))
          );

          setPenaltyTeams(
            teamsList.map((team) => ({
              id: team.id,
              name: team.name,
              ballColor: team.ballColor ?? null,
              ringColor: team.ringColor ?? null,
            }))
          );

          setTeamRatings(ratings);
          setAchievements(achievementsList);
          setSeasonProfit(profitComparison);
          setLoadingDashboard(false);

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

  const withAction = async (action: 'fixtures' | 'lock' | 'unlock' | 'advance' | 'rewind' | 'refresh' | 'restore', work: () => Promise<void>) => {
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
    const prevSeason = state?.currentSeason;
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
      if (prevSeason && next.currentSeason !== prevSeason) {
        window.location.href = '/season-finale';
        return;
      }
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

  const handleCreateFixtures = async () => {
    await withAction('fixtures', async () => {
      const result = await api.generateAllFixtures();
      await refreshState();
      await loadPenaltyTeams();
      const masterCupNote = result.masterCupCreated > 0 ? `, Master Cup GW1-GW6: ${result.masterCupCreated}` : '';
      const trioNote = result.trioCreated > 0 ? `, Trio League GW1-GW6: ${result.trioCreated}` : '';
      const tierNote = result.tierCreated > 0 ? `, Tier League: ${result.tierCreated}` : '';
      const superCupNote = result.superCupCreated > 0 ? `, Super Cup: ${result.superCupCreated}` : '';
      setNotice({
        type: 'ok',
        text: `${result.season} fixtures created. Divisions GW1-GW7: ${result.divisionCreated}, Master League GW1-GW8: ${result.masterCreated}${masterCupNote}${trioNote}${tierNote}${superCupNote}. Bookieball Cup draw stays separate. Total created: ${result.totalCreated}.`,
      });
    });
  };

  const closePenaltyModal = () => {
    setPenaltyStep('idle');
    setPenaltyTieQueue([]);
    setPenaltyTieIndex(0);
    setAdvanceAfterPenalties(false);
    setSkipResultWinner(null);
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
        setSkipResultWinner(null);
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

  const handleSkipToResult = async () => {
    if (!activePenaltyTie || penaltyBusy) return;
    setPenaltyBusy(true);
    try {
      const result = await api.autoResolvePenalty(activePenaltyTie.competition, activePenaltyTie.fixtureId);
      const winnerTeam = result.winnerTeamId === activePenaltyTie.homeTeamId
        ? { id: activePenaltyTie.homeTeamId, name: activePenaltyTie.homeTeamName }
        : { id: activePenaltyTie.awayTeamId, name: activePenaltyTie.awayTeamName };
      setSkipResultWinner(winnerTeam);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to auto-resolve penalty.';
      setNotice({ type: 'error', text: message });
    } finally {
      setPenaltyBusy(false);
    }
  };

  const handleSkipAll = async () => {
    if (penaltyBusy) return;
    setPenaltyBusy(true);
    try {
      const result = await api.autoResolveAllPenalties();
      const refreshedQueue = await loadPenaltyTies();
      if (refreshedQueue.length > 0) {
        setPenaltyTieQueue(refreshedQueue);
        setPenaltyTieIndex(0);
        setPenaltyStep('notice');
        setNotice({
          type: 'ok',
          text: `Auto-resolved ${result.count}/${result.total} tie(s). ${refreshedQueue.length} tie(s) still require penalties.`,
        });
        return;
      }
      closePenaltyModal();
      if (advanceAfterPenalties) {
        const next = await api.advanceGw();
        await refreshState();
        setNotice({
          type: 'ok',
          text: `All penalties resolved. Moved to ${next.currentSeason} ${next.currentGw}.`,
        });
      } else {
        setNotice({
          type: 'ok',
          text: `All ${result.count} penalty tie(s) resolved.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to auto-resolve all penalties.';
      setNotice({ type: 'error', text: message });
    } finally {
      setPenaltyBusy(false);
    }
  };

  const handleComputerTakeAll = async () => {
    if (penaltyBusy) return;
    setPenaltyBusy(true);
    try {
      for (const tie of penaltyTieQueue) {
        const result = await api.autoResolvePenalty(tie.competition, tie.fixtureId);
        const winnerName = result.winnerTeamId === tie.homeTeamId ? tie.homeTeamName : tie.awayTeamName;
        setNotice({ type: 'ok', text: `${tie.homeTeamName} vs ${tie.awayTeamName}: ${winnerName} wins!` });
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      const refreshedQueue = await loadPenaltyTies();
      if (refreshedQueue.length > 0) {
        setPenaltyTieQueue(refreshedQueue);
        setPenaltyTieIndex(0);
        setPenaltyStep('notice');
        setNotice({
          type: 'ok',
          text: `${refreshedQueue.length} tie(s) still require penalties.`,
        });
        return;
      }
      closePenaltyModal();
      if (advanceAfterPenalties) {
        const next = await api.advanceGw();
        await refreshState();
        setNotice({
          type: 'ok',
          text: `All penalties resolved. Moved to ${next.currentSeason} ${next.currentGw}.`,
        });
      } else {
        setNotice({ type: 'ok', text: 'All penalties resolved.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to auto-resolve all penalties.';
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
    <section className="page page-wide font-sans">
      <h1>Insights &amp; Tools</h1>
      <p className="muted">Detailed sports analytics, team ratings, and system controls.</p>

      {/* Tab controls */}
      <div className="insights-tabs">
        <button
          type="button"
          className={`insights-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics Dashboard
        </button>
        <button
          type="button"
          className={`insights-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          Show &amp; Admin Tools
        </button>
      </div>

      {activeTab === 'analytics' ? (
        <div className="analytics-dashboard-grid">
          {/* Top row: Team Performance + Achievements */}
          <div className="dashboard-row-split">
            {/* Team Performance Analytics */}
            <div className="panel">
              <div className="panel-header">
                <h3>Team Performance Trends</h3>
                <span className="muted">Select a team to analyze statistics</span>
              </div>
              {state ? (
                <>
                  <div className="team-analytics-controls" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label className="inline-field" style={{ margin: 0 }}>
                      <span className="muted" style={{ marginRight: 8 }}>Select Team:</span>
                      <select
                        value={selectedTeamForAnalytics ?? ''}
                        onChange={(event) => setSelectedTeamForAnalytics(event.target.value)}
                        disabled={loadingState || teams.length === 0}
                      >
                        <option value="">Select a team to analyze</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.name}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void handleLoadTeamAnalytics()}
                      disabled={busyAction !== null || loadingState || !selectedTeamForAnalytics || teams.length === 0}
                    >
                      Load Analytics
                    </button>
                  </div>
                  {selectedTeamForAnalytics && teamAnalyticsData.length > 0 && (
                    <TeamPerformanceChart
                      teamName={selectedTeamForAnalytics}
                      performanceData={teamAnalyticsData}
                    />
                  )}
                  {!selectedTeamForAnalytics && teams.length > 0 && (
                    <p className="muted">Select a team above to view performance trends, profit history, win rates, and division rankings over time.</p>
                  )}
                  {teams.length === 0 && (
                    <p className="muted">No team data available. Please ensure fixtures have been created and entries recorded.</p>
                  )}
                </>
              ) : (
                <p className="muted">Loading team data...</p>
              )}
            </div>

            {/* Accolades & Achievements */}
            <AchievementsWall achievements={achievements} />
          </div>

          {/* Middle row: Head to Head + Season profit line chart */}
          <div className="dashboard-row-split">
            <HeadToHeadComparison teams={teams} />
            <SeasonProfitChart profitData={seasonProfit} />
          </div>

          {/* Bottom row: Team Ratings Leaderboard */}
          <TeamRatingsLeaderboard ratings={teamRatings} />

          {/* Grid of other screens */}
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
            <Link to="/season-finale" className="tile">
              <h2>Season Finale Show</h2>
              <p>Full-screen broadcast presentation recapping champions, awards, and season highlights.</p>
            </Link>
          </div>
        </div>
      ) : (
        <div className="admin-tools-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
              <h3>Create Fixtures</h3>
              <span className="muted">Season setup</span>
            </div>
            <p className="muted">
              Creates every fixture for the current season except the Bookieball Cup, which is handled by the cup draw.
            </p>
            <div className="grid-row">
              <button
                type="button"
                className="action"
                onClick={() => void handleCreateFixtures()}
                disabled={busyAction !== null || loadingState || !state}
              >
                {busyAction === 'fixtures' ? 'Creating...' : 'Create Fixtures'}
              </button>
              <Link className="secondary" to="/cup-draw">Open Bookieball Cup Draw</Link>
            </div>
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
        </div>
      )}

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
                <div className="penalty-speed-control">
                  <label className="muted">
                    Speed: <span className="penalty-speed-value">{penaltySpeed}ms</span>
                    <span className="penalty-speed-labels"><span>Fast</span><span>Slow</span></span>
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="100"
                    value={penaltySpeed}
                    onChange={(event) => setPenaltySpeed(Number(event.target.value))}
                  />
                </div>
                <div className="grid-row">
                  <button
                    type="button"
                    className="action"
                    onClick={() => { setPenaltyAutoPlay(false); setPenaltyStep('shootout'); }}
                    disabled={penaltyBusy}
                  >
                    Take Penalties
                  </button>
                  <button
                    type="button"
                    className="action"
                    onClick={() => { setPenaltyAutoPlay(true); setPenaltyStep('shootout'); }}
                    disabled={penaltyBusy}
                  >
                    Computer Take
                  </button>
                  <button
                    type="button"
                    className="action"
                    onClick={() => void handleSkipToResult()}
                    disabled={penaltyBusy}
                  >
                    {penaltyBusy ? 'Resolving...' : 'Skip to Result'}
                  </button>
                </div>
                <div className="grid-row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleSkipAll()}
                    disabled={penaltyBusy}
                  >
                    Skip All
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleComputerTakeAll()}
                    disabled={penaltyBusy}
                  >
                    Computer Take All
                  </button>
                  {!activePenaltyIsOverdue && (
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
            ) : skipResultWinner ? (
              <>
                <div className="penalty-result-card">
                  <h3>Result</h3>
                  <p className="winner-name">{skipResultWinner.name} wins!</p>
                  <div className="grid-row">
                    <button
                      type="button"
                      className="action"
                      onClick={() => {
                        void handleConfirmPenaltyWinner(skipResultWinner);
                      }}
                      disabled={penaltyBusy}
                    >
                      {penaltyBusy ? 'Saving...' : 'Confirm Winner'}
                    </button>
                    {!activePenaltyIsOverdue && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => { setSkipResultWinner(null); setPenaltyStep('notice'); }}
                        disabled={penaltyBusy}
                      >
                        Back
                      </button>
                    )}
                  </div>
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
                  speed={penaltySpeed}
                  initialAutoPlay={penaltyAutoPlay}
                  showAutoTake
                  showAutoComplete
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
