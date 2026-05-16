// PenaltyShootoutBoard.tsx
// This component orchestrates a penalty shootout between two teams. It
// displays a scoreboard, runs the interactive PenaltyShootoutGame and tracks
// shots, goals, saves and the eventual winner. The board logic is adapted
// from the original project but drives the new canvas‑based game instead of
// relying on random guesses.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  onConfirmWinner?: (winner: PenaltyTeam, kicks: PenaltyKick[]) => void;
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

export function PenaltyShootoutBoard({
  homeTeam,
  awayTeam,
  resetKey,
  autoStart = false,
  startLabel = 'Take penalties',
  confirmLabel = 'Confirm winner',
  confirmDisabled = false,
  showReset = false,
  onConfirmWinner,
}: PenaltyShootoutBoardProps) {
  const [started, setStarted] = useState(autoStart);
  const [kicks, setKicks] = useState<PenaltyKick[]>([]);
  const [lastOutcome, setLastOutcome] = useState<'GOAL' | 'SAVED' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [shotRequest, setShotRequest] = useState<{ dir: 'left' | 'center' | 'right'; id: number } | null>(null);
  const [shotInFlight, setShotInFlight] = useState(false);
  const shotIdRef = useRef(0);
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
  }, [autoStart, homeTeam.id, awayTeam.id, resetKey]);

  // Handler for game shot completion
  const handleShotComplete = (result: ShotResult) => {
    // Determine shooter team based on kick index
    const team: 'home' | 'away' = shooter;
    setKicks((prev) => [...prev, { team, target: result.targetDir, scored: result.scored }]);
    setLastOutcome(result.scored ? 'GOAL' : 'SAVED');
    setShotInFlight(false);
  };

  // Confirm winner callback wrapper
  const handleConfirmWinner = () => {
    if (winnerTeam && onConfirmWinner) {
      onConfirmWinner(winnerTeam, kicks);
    }
  };

  // Kit colours for the keeper are derived from the opposing team's ball colour.
  const keeperTeam = shooter === 'home' ? awayTeam : homeTeam;
  const keeperKit = getKeeperKit(keeperTeam.ballColor ?? keeperTeam.ringColor ?? undefined);

  // Colour for the ball is derived from the shooter's team colours
  const shooterTeam = shooter === 'home' ? homeTeam : awayTeam;
  const ballColour = shooterTeam.ballColor ?? shooterTeam.ringColor ?? '#ffffff';

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
