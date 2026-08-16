// PenaltyShootoutBoard.tsx
// This component orchestrates a penalty shootout between two teams. It
// displays a scoreboard, runs the interactive PenaltyShootoutGame and tracks
// shots, goals, saves and the eventual winner. The board logic is adapted
// from the original project but drives the new canvas‑based game instead of
// relying on random guesses.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PenaltyShootoutGame, ShotResult } from './PenaltyShootoutGame';
import { getKeeperKit } from './kitTheme';

export type PenaltyTeam = {
  id: number;
  name: string;
  ballColor?: string | null;
  ringColor?: string | null;
};

type PenaltyKick = {
  team: 'home' | 'away';
  target: 'left' | 'center' | 'right';
  scored: boolean;
};

export type PenaltyShootoutBoardProps = {
  homeTeam: PenaltyTeam;
  awayTeam: PenaltyTeam;
  resetKey?: string | number;
  autoStart?: boolean;
  startLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  showReset?: boolean;
  showAutoTake?: boolean;
  showAutoComplete?: boolean;
  speed?: number;
  initialAutoPlay?: boolean;
  autoConfirm?: boolean;
  onConfirmWinner?: (winner: PenaltyTeam, kicks: PenaltyKick[]) => void;
  onAutoComplete?: () => void;
};

// Compute shootout status: goals, taken kicks, phase and winner.
function buildShootoutStatus(kicks: PenaltyKick[]) {
  const homeShots = kicks.filter((kick) => kick.team === 'home');
  const awayShots = kicks.filter((kick) => kick.team === 'away');
  const homeGoals = homeShots.filter((kick) => kick.scored).length;
  const awayGoals = awayShots.filter((kick) => kick.scored).length;
  const homeTaken = homeShots.length;
  const awayTaken = awayShots.length;
  let winner: 'home' | 'away' | null = null;
  let phase: 'regular' | 'sudden' = 'regular';
  const regularComplete = homeTaken >= 5 && awayTaken >= 5;
  if (!regularComplete) {
    const homeRemaining = 5 - homeTaken;
    const awayRemaining = 5 - awayTaken;
    if (homeGoals > awayGoals + awayRemaining) {
      winner = 'home';
    } else if (awayGoals > homeGoals + homeRemaining) {
      winner = 'away';
    }
  }
  if (!winner && regularComplete) {
    if (homeTaken !== awayTaken) {
      phase = 'sudden';
    } else if (homeGoals > awayGoals) {
      winner = 'home';
    } else if (awayGoals > homeGoals) {
      winner = 'away';
    } else {
      phase = 'sudden';
    }
  }
  if (!winner && phase === 'sudden') {
    if (homeTaken === awayTaken && homeTaken > 5 && homeGoals !== awayGoals) {
      winner = homeGoals > awayGoals ? 'home' : 'away';
    }
  }
  return {
    homeShots,
    awayShots,
    homeGoals,
    awayGoals,
    homeTaken,
    awayTaken,
    phase,
    winner,
  };
}

function PenaltyShootoutBoardInner({
  homeTeam,
  awayTeam,
  resetKey,
  autoStart = false,
  startLabel = 'Take penalties',
  confirmLabel = 'Confirm winner',
  confirmDisabled = false,
  showReset = false,
  showAutoTake = false,
  showAutoComplete = false,
  speed = 500,
  initialAutoPlay = false,
  autoConfirm = false,
  onConfirmWinner,
  onAutoComplete,
}: PenaltyShootoutBoardProps) {
  const [started, setStarted] = useState(autoStart);
  const [kicks, setKicks] = useState<PenaltyKick[]>([]);
  const [lastOutcome, setLastOutcome] = useState<'GOAL' | 'SAVED' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [shotRequest, setShotRequest] = useState<{ dir: 'left' | 'center' | 'right'; id: number } | null>(null);
  const [shotInFlight, setShotInFlight] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(initialAutoPlay);
  const shotIdRef = useRef(0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(null);
  const status = useMemo(() => buildShootoutStatus(kicks), [kicks]);
  const shooter = kicks.length % 2 === 0 ? 'home' : 'away';
  const winnerTeam = status.winner === 'home' ? homeTeam : status.winner === 'away' ? awayTeam : null;

  // Reset shootout when resetKey changes or teams change
  useEffect(() => {
    setKicks([]);
    setStarted(autoStart);
    setLastOutcome(null);
    setAnimKey(0);
    setShotInFlight(false);
    setShotRequest(null);
    setAutoPlaying(false);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, [autoStart, homeTeam.id, awayTeam.id, resetKey]);

  // If initialAutoPlay is set, start auto-play when the board starts
  useEffect(() => {
    if (started && initialAutoPlay && !shotInFlight && !autoPlaying && !winnerTeam) {
      setAutoPlaying(true);
      const dirs: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const nextId = shotIdRef.current + 1;
      shotIdRef.current = nextId;
      setShotInFlight(true);
      setShotRequest({ dir, id: nextId });
    }
  }, [started, initialAutoPlay]);

  // Cleanup auto-play timer on unmount
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, []);

  // Auto-play logic: schedule next shot after current one completes
  const scheduleNextAutoShot = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
    }
    autoPlayTimerRef.current = setTimeout(() => {
      const dirs: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const nextId = shotIdRef.current + 1;
      shotIdRef.current = nextId;
      setShotInFlight(true);
      setShotRequest({ dir, id: nextId });
    }, speed);
  }, [speed]);

  // When a shot completes during auto-play, schedule the next one
  const handleShotComplete = (result: ShotResult) => {
    const team: 'home' | 'away' = shooter;
    setKicks((prev) => [...prev, { team, target: result.targetDir, scored: result.scored }]);
    setLastOutcome(result.scored ? 'GOAL' : 'SAVED');
    setShotInFlight(false);
  };

  // Monitor for auto-play continuation after shot completes
  useEffect(() => {
    if (!autoPlaying || shotInFlight || !started) {
      return;
    }
    if (winnerTeam) {
      setAutoPlaying(false);
      return;
    }
    scheduleNextAutoShot();
  }, [autoPlaying, shotInFlight, started, winnerTeam, scheduleNextAutoShot]);

  // Confirm winner callback wrapper
  const handleConfirmWinner = () => {
    if (winnerTeam && onConfirmWinner) {
      onConfirmWinner(winnerTeam, kicks);
    }
  };

  // Auto-confirm: when autoConfirm is set, submit the winner shortly after
  // the shootout concludes so the queue can advance by itself.
  const autoConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoConfirmTimerRef.current) {
      clearTimeout(autoConfirmTimerRef.current);
      autoConfirmTimerRef.current = null;
    }
    if (autoConfirm && winnerTeam && onConfirmWinner) {
      autoConfirmTimerRef.current = setTimeout(() => {
        handleConfirmWinner();
      }, 1200);
    }
    return () => {
      if (autoConfirmTimerRef.current) {
        clearTimeout(autoConfirmTimerRef.current);
        autoConfirmTimerRef.current = null;
      }
    };
  }, [autoConfirm, winnerTeam, onConfirmWinner]);

  // Kit colours for the keeper are derived from the opposing team's ball colour.
  const keeperTeam = shooter === 'home' ? awayTeam : homeTeam;
  const keeperKit = getKeeperKit(keeperTeam.ballColor ?? keeperTeam.ringColor ?? undefined);

  // Colour for the ball is derived from the shooter's team colours
  const shooterTeam = shooter === 'home' ? homeTeam : awayTeam;
  const ballColour = shooterTeam.ballColor ?? shooterTeam.ringColor ?? '#ffffff';

  // Auto-complete: simulate all kicks instantly without animation
  const handleAutoComplete = useCallback(() => {
    if (!started) {
      setStarted(true);
    }
    // Generate simulated kicks until we have a winner
    const simulatedKicks: PenaltyKick[] = [];
    let winner: 'home' | 'away' | null = null;
    while (!winner) {
      const team: 'home' | 'away' = simulatedKicks.length % 2 === 0 ? 'home' : 'away';
      const dirs: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const scored = Math.random() < 0.65;
      simulatedKicks.push({ team, target: dir, scored });
      const simStatus = buildShootoutStatus(simulatedKicks);
      if (simStatus.winner) {
        winner = simStatus.winner;
      }
    }
    setKicks(simulatedKicks);
    setLastOutcome(simulatedKicks[simulatedKicks.length - 1]?.scored ? 'GOAL' : 'SAVED');
    setAutoPlaying(false);
    if (onAutoComplete && !onConfirmWinner) {
      // If no confirm callback, use auto-complete callback
      Promise.resolve().then(() => onAutoComplete());
    }
  }, [started, onAutoComplete, onConfirmWinner]);

  return (
    <div className="penalty-shootout-board" key={animKey}
      style={{ maxWidth: 640, margin: '0 auto' }}
    >
      <h3 style={{ textAlign: 'center' }}>Penalty Shootout</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <strong>Home</strong>
          <div>{homeTeam.name}</div>
          <div>{status.homeGoals}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.max(5, status.homeShots.length) }).map((_, idx) => {
              const shot = status.homeShots[idx];
              return (
                <div
                  key={idx}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: shot
                      ? shot.scored
                        ? '#4caf50'
                        : '#f44336'
                      : '#bbb',
                  }}
                />
              );
            })}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {status.phase === 'sudden' && !status.winner && (
            <div style={{ fontStyle: 'italic' }}>Sudden death</div>
          )}
          <div style={{ marginTop: 4 }}>
            {lastOutcome && (
              <span
                style={{
                  color: lastOutcome === 'GOAL' ? '#4caf50' : '#f44336',
                  fontWeight: 'bold',
                }}
              >
                {lastOutcome}
              </span>
            )}
          </div>
          <div style={{ marginTop: 4 }}>
            {winnerTeam
              ? `Winner: ${winnerTeam.name}`
              : started
              ? `${shooterTeam.name} to take`
              : 'Ready for penalties'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>Away</strong>
          <div>{awayTeam.name}</div>
          <div>{status.awayGoals}</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            {Array.from({ length: Math.max(5, status.awayShots.length) }).map((_, idx) => {
              const shot = status.awayShots[idx];
              return (
                <div
                  key={idx}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: shot
                      ? shot.scored
                        ? '#4caf50'
                        : '#f44336'
                      : '#bbb',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {started ? (
        <PenaltyShootoutGame
          ballColour={ballColour}
          keeperPrimary={keeperKit.primary}
          keeperTrim={keeperKit.trim}
          onShotComplete={handleShotComplete}
          difficulty={0.33}
          shotRequest={shotRequest}
          allowPointerShots={false}
        />
      ) : (
        <button onClick={() => setStarted(true)} style={{ padding: '8px 16px' }}>
          {startLabel}
        </button>
      )}
      {started && !winnerTeam && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
          {(['left', 'center', 'right'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => {
                if (shotInFlight) return;
                const nextId = shotIdRef.current + 1;
                shotIdRef.current = nextId;
                setShotInFlight(true);
                setShotRequest({ dir, id: nextId });
              }}
              style={{ padding: '6px 12px' }}
              disabled={shotInFlight}
            >
              {dir[0].toUpperCase() + dir.slice(1)}
            </button>
          ))}
        </div>
      )}
      {started && !winnerTeam && showAutoTake && !autoPlaying && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={() => {
              if (shotInFlight) return;
              setAutoPlaying(true);
              const dirs: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
              const dir = dirs[Math.floor(Math.random() * dirs.length)];
              const nextId = shotIdRef.current + 1;
              shotIdRef.current = nextId;
              setShotInFlight(true);
              setShotRequest({ dir, id: nextId });
            }}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            disabled={shotInFlight || autoPlaying}
          >
            {autoPlaying ? 'Auto-playing...' : 'Auto Take (Watch)'}
          </button>
        </div>
      )}
      {started && showAutoComplete && !winnerTeam && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={handleAutoComplete}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            Auto Complete
          </button>
        </div>
      )}
      {winnerTeam && onConfirmWinner && (
        <button
          onClick={handleConfirmWinner}
          style={{ marginTop: 8, padding: '6px 12px' }}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
      )}
      {showReset && (
        <button
          onClick={() => {
            setKicks([]);
            setStarted(autoStart);
            setLastOutcome(null);
            setAnimKey((prev) => prev + 1);
          }}
          style={{ marginTop: 8, padding: '6px 12px' }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

export const PenaltyShootoutBoard = memo(PenaltyShootoutBoardInner);
