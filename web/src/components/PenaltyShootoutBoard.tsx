import { useEffect, useMemo, useRef, useState } from 'react';

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

type PenaltyShootoutBoardProps = {
  homeTeam: PenaltyTeam;
  awayTeam: PenaltyTeam;
  resetKey?: string | number;
  autoStart?: boolean;
  startLabel?: string;
  confirmLabel?: string;
  showReset?: boolean;
  onConfirmWinner?: (winner: PenaltyTeam, kicks: PenaltyKick[]) => void;
};

const buildShootoutStatus = (kicks: PenaltyKick[]) => {
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
};

export function PenaltyShootoutBoard({
  homeTeam,
  awayTeam,
  resetKey,
  autoStart = false,
  startLabel = 'Take penalties',
  confirmLabel = 'Confirm winner',
  showReset = false,
  onConfirmWinner,
}: PenaltyShootoutBoardProps) {
  const [started, setStarted] = useState(autoStart);
  const [kicks, setKicks] = useState<PenaltyKick[]>([]);
  const [keeperDive, setKeeperDive] = useState<'left' | 'center' | 'right' | null>(null);
  const [ballTarget, setBallTarget] = useState<'left' | 'center' | 'right' | null>(null);
  const [lastOutcome, setLastOutcome] = useState<'GOAL' | 'SAVED' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const diveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setKicks([]);
    setStarted(autoStart);
    setKeeperDive(null);
    setBallTarget(null);
    setLastOutcome(null);
    setAnimKey(0);
    if (diveTimeoutRef.current) {
      window.clearTimeout(diveTimeoutRef.current);
      diveTimeoutRef.current = null;
    }
  }, [autoStart, homeTeam.id, awayTeam.id, resetKey]);

  useEffect(() => {
    return () => {
      if (diveTimeoutRef.current) {
        window.clearTimeout(diveTimeoutRef.current);
        diveTimeoutRef.current = null;
      }
    };
  }, []);

  const status = useMemo(() => buildShootoutStatus(kicks), [kicks]);
  const shooter = kicks.length % 2 === 0 ? 'home' : 'away';
  const winnerTeam = status.winner === 'home' ? homeTeam : status.winner === 'away' ? awayTeam : null;
  const keeperTeam = shooter === 'home' ? awayTeam : homeTeam;
  const keeperColor = keeperTeam.ballColor ?? keeperTeam.ringColor ?? '#f5d47a';
  const keeperTrim = keeperTeam.ringColor ?? keeperTeam.ballColor ?? '#c9973a';
  const homeColor = homeTeam.ballColor ?? homeTeam.ringColor ?? '#6fb4ff';
  const awayColor = awayTeam.ballColor ?? awayTeam.ringColor ?? '#ffb86f';

  const maxSlots = Math.max(5, status.homeShots.length, status.awayShots.length);

  const renderCircles = (shots: PenaltyKick[]) =>
    Array.from({ length: maxSlots }).map((_, index) => {
      const shot = shots[index];
      if (!shot) {
        return <span key={`pending-${index}`} className="penalty-circle pending" />;
      }
      return (
        <span
          key={`${shot.team}-${index}`}
          className={`penalty-circle ${shot.scored ? 'goal' : 'miss'}`}
          title={`${shot.target} • ${shot.scored ? 'Goal' : 'Miss'}`}
        />
      );
    });

  const handleKick = (target: 'left' | 'center' | 'right') => {
    if (!started || status.winner) {
      return;
    }
    const keeperGuess = (['left', 'center', 'right'] as const)[Math.floor(Math.random() * 3)] ?? 'center';
    setKeeperDive(keeperGuess);
    setBallTarget(target);
    setAnimKey((prev) => prev + 1);
    if (diveTimeoutRef.current) {
      window.clearTimeout(diveTimeoutRef.current);
    }
    diveTimeoutRef.current = window.setTimeout(() => {
      setKeeperDive(null);
      setBallTarget(null);
      setLastOutcome(null);
    }, 900);
    const scored = keeperGuess !== target;
    setLastOutcome(scored ? 'GOAL' : 'SAVED');
    setKicks((prev) => [...prev, { team: shooter, target, scored }]);
  };

  const handleReset = () => {
    setKicks([]);
    setStarted(autoStart);
    setKeeperDive(null);
    setBallTarget(null);
    setLastOutcome(null);
    setAnimKey(0);
    if (diveTimeoutRef.current) {
      window.clearTimeout(diveTimeoutRef.current);
      diveTimeoutRef.current = null;
    }
  };

  return (
    <div className="penalty-shootout-card">
      <div className="penalty-header">
        <div>
          <h3>Penalty Shootout</h3>
          <p className="muted">{homeTeam.name} vs {awayTeam.name}</p>
        </div>
        {status.phase === 'sudden' && !status.winner && (
          <span className="penalty-phase">Sudden death</span>
        )}
      </div>

      <div className="penalty-scoreboard">
        <div className="penalty-team-row">
          <div>
            <div className="penalty-team-name">Home</div>
            <div className="penalty-team-sub">{homeTeam.name}</div>
          </div>
          <div className="penalty-team-score">{status.homeGoals}</div>
          <div className="penalty-circles">{renderCircles(status.homeShots)}</div>
        </div>
        <div className="penalty-team-row">
          <div>
            <div className="penalty-team-name">Away</div>
            <div className="penalty-team-sub">{awayTeam.name}</div>
          </div>
          <div className="penalty-team-score">{status.awayGoals}</div>
          <div className="penalty-circles">{renderCircles(status.awayShots)}</div>
        </div>
      </div>

      <div className="penalty-graphic">
        <div
          key={animKey}
          className="penalty-goal"
          data-dive={keeperDive ?? 'idle'}
          data-shot={ballTarget ?? 'idle'}
          data-outcome={lastOutcome ?? 'idle'}
          style={{
            '--keeper-color': keeperColor,
            '--keeper-trim': keeperTrim,
            '--crowd-home': homeColor,
            '--crowd-away': awayColor,
          } as React.CSSProperties}
        >
          <div className="penalty-crowd" />
          <div className="penalty-banners" />
          <div className="penalty-net" />
          <div className="penalty-keeper" />
          <div className="penalty-ball" />
          {lastOutcome && (
            <div className={`penalty-outcome ${lastOutcome === 'GOAL' ? 'goal' : 'saved'}`}>
              {lastOutcome}
            </div>
          )}
        </div>
      </div>

      <div className="penalty-status">
        {winnerTeam
          ? `Winner: ${winnerTeam.name}`
          : started
            ? `${shooter === 'home' ? homeTeam.name : awayTeam.name} to take`
            : 'Ready for penalties'}
      </div>

      <div className="penalty-controls">
        {!started ? (
          <button type="button" className="action" onClick={() => setStarted(true)}>
            {startLabel}
          </button>
        ) : (
          <>
            <button type="button" className="secondary" onClick={() => handleKick('left')} disabled={Boolean(status.winner)}>
              Left
            </button>
            <button type="button" className="secondary" onClick={() => handleKick('center')} disabled={Boolean(status.winner)}>
              Center
            </button>
            <button type="button" className="secondary" onClick={() => handleKick('right')} disabled={Boolean(status.winner)}>
              Right
            </button>
          </>
        )}

        {winnerTeam && onConfirmWinner && (
          <button
            type="button"
            className="action"
            onClick={() => onConfirmWinner(winnerTeam, kicks)}
          >
            {confirmLabel}
          </button>
        )}

        {showReset && (
          <button type="button" className="secondary" onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
