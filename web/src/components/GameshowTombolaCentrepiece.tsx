import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
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
type TombolaPhase = 'loading' | 'mixing' | 'picked' | 'error';

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
  const driftX = 23 + (index % 5) * 10;
  const driftY = 18 + (index % 7) * 7;
  const duration = 1.05 + (index % 8) * 0.075;
  return { x, y, driftX, driftY, duration, delay: index * 0.03 };
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

function TombolaStage({ balls, phase, selectedName, error }: {
  balls: TombolaBall[];
  phase: TombolaPhase;
  selectedName: string;
  error: string;
}) {
  const status = phase === 'picked'
    ? selectedName
    : phase === 'mixing'
      ? 'Air on — mixing every ball'
      : phase === 'error'
        ? 'Unable to build the draw pool'
        : 'Loading the remaining team balls…';
  const detail = phase === 'picked'
    ? 'Selected team — draw locked.'
    : phase === 'mixing'
      ? 'Every remaining team is live in the glass.'
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
        }, 850);
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

  const validNames = useMemo(() => new Set(balls.map((ball) => ball.name)), [balls]);

  useEffect(() => {
    if (!target || validNames.size === 0) return undefined;

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
  }, [target, validNames]);

  if (!target) return null;

  return createPortal(
    <TombolaStage balls={balls} phase={phase} selectedName={selectedName} error={error} />,
    target,
  );
}
