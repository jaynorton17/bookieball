import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

type TombolaBall = {
  id: number;
  name: string;
  initials: string;
  ballColor: string;
  ringColor: string;
  textColor: string;
};

type DrawPool = Awaited<ReturnType<typeof api.gameshowDrawPool>>;
type DrawResult = Awaited<ReturnType<typeof api.drawTeam>>;
type TombolaPhase = 'loading' | 'mixing' | 'picking' | 'picked' | 'error';

type BallStyle = CSSProperties & {
  '--ball-x': string;
  '--ball-y': string;
  '--ball-drift-x': string;
  '--ball-drift-y': string;
  '--ball-duration': string;
  '--ball-delay': string;
  '--ball-color': string;
  '--ball-ring': string;
  '--ball-text': string;
};

type PendingDrawResolver = {
  resolve: (value: DrawResult) => void;
  reject: (reason?: unknown) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function ballsFromPool(groups: DrawPool): TombolaBall[] {
  const unique = new Map<number, TombolaBall>();
  groups.forEach((group) => {
    group.teams.forEach((team) => {
      if (unique.has(team.teamId)) return;
      unique.set(team.teamId, {
        id: team.teamId,
        name: team.teamName,
        initials: initials(team.teamName),
        ballColor: team.ballColor ?? '#5eb7ff',
        ringColor: team.ringColor ?? '#f7fbff',
        textColor: team.textColor ?? '#06101c',
      });
    });
  });
  return [...unique.values()];
}

function deterministicPosition(index: number, total: number) {
  const cols = total >= 20 ? 6 : total >= 12 ? 5 : 4;
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = 11 + (col / Math.max(1, cols - 1)) * 78 + Math.sin(index * 1.61) * 2.7;
  const y = 9 + (row / Math.max(1, rows - 1)) * 63 + Math.cos(index * 1.27) * 2.2;
  const driftX = 68 + (index % 5) * 22;
  const driftY = 48 + (index % 7) * 13;
  const duration = 0.44 + (index % 8) * 0.05;
  return { x, y, driftX, driftY, duration, delay: index * 0.018 };
}

function readSelectedTeam(target: HTMLElement, validNames: Set<string>): string {
  const selectors = [
    '.kickoff-carousel-track-item.locked strong',
    '.kickoff-carousel-spotlight.locked strong',
  ];
  for (const selector of selectors) {
    const label = target.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? '';
    if (validNames.has(label)) return label;
  }
  return '';
}

function TombolaStage({
  balls,
  phase,
  selectedName,
  error,
  onPickBall,
}: {
  balls: TombolaBall[];
  phase: TombolaPhase;
  selectedName: string;
  error: string;
  onPickBall: () => void;
}) {
  const status = phase === 'picked'
    ? selectedName
    : phase === 'picking'
      ? 'Selecting one ball…'
      : phase === 'mixing'
        ? 'Air on — all balls live'
        : phase === 'error'
          ? 'Unable to build the draw pool'
          : 'Loading the remaining team balls…';
  const detail = phase === 'picked'
    ? 'Selected team — draw locked.'
    : phase === 'picking'
      ? 'The plunger is firing now.'
      : phase === 'mixing'
        ? 'Press Pick Ball when you are ready to make the draw.'
        : phase === 'error'
          ? error
          : 'The glass will start mixing as soon as the live pool arrives.';

  return (
    <div className={`tombola-portal-root tombola-centrepiece is-${phase}`} aria-live="polite">
      <div className="tombola-centrepiece-head">
        <div>
          <span>LIVE TEAM DRAW</span>
          <strong>BookieBall draw machine</strong>
        </div>
        <b>{balls.length > 0 ? balls.length : '…'} TEAMS REMAINING</b>
      </div>

      <div className="tombola-centrepiece-stage">
        <div className="tombola-stage-glow" aria-hidden="true" />
        <div className="tombola-machine" aria-label="BookieBall glass tombola">
          <div className="tombola-neck"><i /></div>
          <div className="tombola-glass">
            <div className="tombola-glass-shine" aria-hidden="true" />
            <div className="tombola-air-streams" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="tombola-ball-field">
              {balls.map((ball, index) => {
                const position = deterministicPosition(index, balls.length);
                const style: BallStyle = {
                  '--ball-x': `${position.x}%`,
                  '--ball-y': `${position.y}%`,
                  '--ball-drift-x': `${position.driftX}px`,
                  '--ball-drift-y': `${position.driftY}px`,
                  '--ball-duration': `${position.duration}s`,
                  '--ball-delay': `${position.delay}s`,
                  '--ball-color': ball.ballColor,
                  '--ball-ring': ball.ringColor,
                  '--ball-text': ball.textColor,
                };
                const winner = phase === 'picked' && ball.name === selectedName;
                const loser = phase === 'picked' && ball.name !== selectedName;
                return (
                  <div
                    key={ball.id}
                    className={`tombola-ball${winner ? ' is-winner' : ''}${loser ? ' is-not-winner' : ''}`}
                    style={style}
                    title={ball.name}
                    aria-label={ball.name}
                  >
                    {ball.initials}
                  </div>
                );
              })}
            </div>
            <div className="tombola-pick-chute" aria-hidden="true"><i /></div>
          </div>
          <div className="tombola-base"><span /><strong>BOOKIEBALL</strong><span /></div>
        </div>

        <div className="tombola-status">
          <small>DRAW STATUS</small>
          <strong>{status}</strong>
          <span>{detail}</span>
          {(phase === 'mixing' || phase === 'picking') && (
            <button
              type="button"
              className="tombola-pick-button"
              onClick={onPickBall}
              disabled={phase === 'picking'}
            >
              {phase === 'picking' ? 'Picking…' : 'Pick Ball'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameshowTombolaCentrepiece() {
  const location = useLocation();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [balls, setBalls] = useState<TombolaBall[]>([]);
  const [phase, setPhase] = useState<TombolaPhase>('loading');
  const [selectedName, setSelectedName] = useState('');
  const [error, setError] = useState('');
  const originalDrawTeamRef = useRef<typeof api.drawTeam | null>(null);
  const pendingDrawResolversRef = useRef<PendingDrawResolver[]>([]);
  const pickedResultRef = useRef<DrawResult | null>(null);

  useLayoutEffect(() => {
    if (location.pathname !== '/gameshow') {
      setTarget(null);
      return undefined;
    }

    const syncTarget = () => {
      const next = document.querySelector<HTMLElement>('.kickoff-wheel-overlay-card');
      setTarget((current) => current === next ? current : next);
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!target) return undefined;
    target.classList.add('tombola-react-active');
    return () => target.classList.remove('tombola-react-active');
  }, [target]);

  useEffect(() => {
    if (!target) return undefined;

    const originalDrawTeam = api.drawTeam;
    originalDrawTeamRef.current = originalDrawTeam;
    pickedResultRef.current = null;
    pendingDrawResolversRef.current = [];

    const gatedDrawTeam: typeof api.drawTeam = async () => {
      if (pickedResultRef.current) {
        return pickedResultRef.current;
      }
      return new Promise<DrawResult>((resolve, reject) => {
        pendingDrawResolversRef.current.push({ resolve, reject });
      });
    };

    api.drawTeam = gatedDrawTeam;

    return () => {
      if (api.drawTeam === gatedDrawTeam) {
        api.drawTeam = originalDrawTeam;
      }
      originalDrawTeamRef.current = null;
      pendingDrawResolversRef.current = [];
      pickedResultRef.current = null;
    };
  }, [target]);

  useEffect(() => {
    if (!target) {
      setBalls([]);
      setSelectedName('');
      setPhase('loading');
      setError('');
      return undefined;
    }

    let active = true;
    let mixTimer = 0;
    setBalls([]);
    setSelectedName('');
    setPhase('loading');
    setError('');

    void api.gameshowDrawPool()
      .then((groups) => {
        if (!active) return;
        const nextBalls = ballsFromPool(groups);
        if (nextBalls.length === 0) {
          setError('No undrawn teams were returned for this gameweek.');
          setPhase('error');
          return;
        }
        setBalls(nextBalls);
        mixTimer = window.setTimeout(() => {
          if (active) setPhase('mixing');
        }, 550);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'The draw pool request failed.');
        setPhase('error');
      });

    return () => {
      active = false;
      if (mixTimer) window.clearTimeout(mixTimer);
    };
  }, [target]);

  const handlePickBall = useCallback(() => {
    if (phase !== 'mixing') return;
    const originalDrawTeam = originalDrawTeamRef.current;
    if (!originalDrawTeam) {
      setError('The live draw is not ready yet.');
      setPhase('error');
      return;
    }

    setPhase('picking');
    setError('');
    void originalDrawTeam()
      .then((picked) => {
        pickedResultRef.current = picked;
        setSelectedName(picked.teamName);
        setPhase('picked');
        const waiters = pendingDrawResolversRef.current.splice(0);
        waiters.forEach(({ resolve }) => resolve(picked));
      })
      .catch((reason) => {
        const waiters = pendingDrawResolversRef.current.splice(0);
        waiters.forEach(({ reject }) => reject(reason));
        setError(reason instanceof Error ? reason.message : 'Unable to pick a team ball.');
        setPhase('error');
      });
  }, [phase]);

  const validNames = useMemo(() => new Set(balls.map((ball) => ball.name)), [balls]);

  useEffect(() => {
    if (!target || validNames.size === 0 || phase === 'picked') return undefined;

    const syncWinner = () => {
      const nextSelected = readSelectedTeam(target, validNames);
      if (!nextSelected) return;
      setSelectedName(nextSelected);
      setPhase('picked');
    };

    syncWinner();
    const observer = new MutationObserver(syncWinner);
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [phase, target, validNames]);

  if (!target) return null;

  return createPortal(
    <TombolaStage
      balls={balls}
      phase={phase}
      selectedName={selectedName}
      error={error}
      onPickBall={handlePickBall}
    />,
    target,
  );
}
